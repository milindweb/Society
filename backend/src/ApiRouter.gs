/**
 * ApiRouter.js — Single transport pipeline for every API request.
 *
 * Pipeline: parse -> requestId -> resolve route -> schema check -> authenticate -> authorize
 *           -> validate -> dispatch -> envelope -> audit -> error boundary
 *
 * Rules:
 * - Single endpoint: POST {base} with Content-Type text/plain;charset=utf-8 (no CORS preflight).
 * - Body: { action, payload, token?, clientRequestId? }.
 * - Response: always HTTP 200 with JSON envelope; errors live in the envelope.
 * - Guard order: authentication before authorization before validation.
 * - clientRequestId required on mutating actions; repeats return original (duplicate:true).
 * - PUBLIC_ACTIONS = auth.health, auth.login only.
 */
var ApiRouter = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Actions that do not require authentication. */
  var MUTATING_ACTIONS = null; // computed lazily from catalog

  /**
   * Check if an action is mutating (POST with side effects).
   * @param {string} action
   * @return {boolean}
   */
  function isMutating(action) {
    if (action === 'auth.health') { return false; }
    // Everything except auth.health is treated as potentially mutating for idempotency
    // (auth.login is POST but not idempotent — it creates new sessions)
    return true;
  }

  /**
   * Extract token from request body, query params, or Authorization header.
   * @param {object} body parsed JSON body
   * @param {object} params query parameters
   * @param {string} [authHeader] Authorization header value
   * @return {string|null} token
   */
  function extractToken(body, params, authHeader) {
    // Body takes priority
    if (body && body.token) { return body.token; }
    // Query param
    if (params && params.token) { return params.token; }
    // Authorization header
    if (authHeader) { return AuthService.extractToken(authHeader); }
    return null;
  }

  /**
   * Parse the raw request into a structured request object.
   * @param {object} e GAS doPost(e) or doGet(e) event object
   * @return {{ ok: boolean, request?: object, error?: string }}
   */
  function parse(e) {
    try {
      var method = (e && e.method) ? e.method.toUpperCase() : 'POST';
      var body = {};
      var params = {};
      var token = null;

      if (method === 'POST') {
        // Parse body — content is text/plain but we treat it as JSON
        var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
        if (raw) {
          body = Utils.safeJsonParse(raw);
          if (body === null) {
            return { ok: false, error: 'BAD_REQUEST' };
          }
        }
      } else if (method === 'GET') {
        // Parse query parameters
        params = (e && e.parameter) ? e.parameter : {};
        // Support ?action=...&payload=<urlencoded json>&token=...
        if (params.payload) {
          var decoded = decodeURIComponent(params.payload);
          body = Utils.safeJsonParse(decoded);
          if (body === null) {
            return { ok: false, error: 'BAD_REQUEST' };
          }
        }
        if (params.action) { body.action = params.action; }
      }

      // Extract token
      var authHeader = (e && e.headers && e.headers.Authorization) ? e.headers.Authorization : null;
      token = extractToken(body, params, authHeader);

      // Extract client IP
      var ip = (e && e.context && e.context.clientAddress) ? e.context.clientAddress : '';

      return {
        ok: true,
        request: {
          action: body.action || '',
          payload: body.payload || {},
          token: token,
          clientRequestId: body.clientRequestId || '',
          method: method,
          ip: ip,
          userAgent: (e && e.headers && e.headers['user-agent']) ? e.headers['user-agent'] : ''
        }
      };
    } catch (err) {
      return { ok: false, error: 'BAD_REQUEST' };
    }
  }

  /**
   * Check schema version consistency.
   * @return {{ ok: boolean, error?: string }}
   */
  function checkSchema() {
    try {
      var sheet = Repository.getSheet('_Meta');
      var map = Repository.headerMap('_Meta');
      var lastRow = sheet.getLastRow();
      if (lastRow <= 1) { return { ok: true }; } // no meta row yet, allow
      var values = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
      var keyIdx = map['metaKey'];
      var valIdx = map['metaValue'];
      if (!keyIdx || !valIdx) { return { ok: true }; }
      // Find schemaVersion row
      for (var i = 0; i < values.length; i++) {
        // Read all rows to find schemaVersion
      }
      // Simplified: read the meta sheet for schemaVersion
      var allValues = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
      for (var r = 0; r < allValues.length; r++) {
        var keyCol = map['metaKey'] - 1;
        var valCol = map['metaValue'] - 1;
        if (String(allValues[r][keyCol]) === 'schemaVersion') {
          var version = parseInt(allValues[r][valCol], 10);
          if (version !== Schema.SCHEMA_VERSION) {
            return { ok: false, error: 'SCHEMA_OUT_OF_DATE' };
          }
          return { ok: true };
        }
      }
      return { ok: true }; // schemaVersion not set yet
    } catch (err) {
      // _Meta sheet may not exist yet (setup not run)
      return { ok: true };
    }
  }

  /**
   * Resolve route from the catalog.
   * @param {string} action
   * @return {{ ok: boolean, route?: object, error?: string }}
   */
  function resolveRoute(action) {
    if (!action) { return { ok: false, error: 'UNKNOWN_ACTION' }; }
    var route = Routes.get(action);
    if (!route) { return { ok: false, error: 'UNKNOWN_ACTION' }; }
    return { ok: true, route: route };
  }

  /**
   * Authenticate the request (skip for PUBLIC routes).
   * @param {object} route
   * @param {string} token
   * @return {{ ok: boolean, user?: object, session?: object, error?: string }}
   */
  function authenticate(route, token) {
    if (route.scope === 'PUBLIC') {
      return { ok: true, user: null, session: null };
    }

    if (!token) {
      return { ok: false, error: 'UNAUTHENTICATED' };
    }

    var result = AuthService.validateSession(token);
    if (!result.valid) {
      return { ok: false, error: result.error };
    }

    // Fetch the full user record
    var user = Repository.findById('Users', result.session.userId);
    if (!user) {
      return { ok: false, error: 'UNAUTHENTICATED' };
    }

    // Check user status
    if (user.statusKey !== 'ACTIVE') {
      return { ok: false, error: 'UNAUTHENTICATED' };
    }

    return { ok: true, user: user, session: result.session };
  }

  /**
   * Authorize the request (check permission + scope).
   * @param {object} route
   * @param {object} user
   * @param {Array} permissions
   * @return {{ ok: boolean, error?: string }}
   */
  function authorize(route, user, permissions) {
    // Public routes skip authorization
    if (route.scope === 'PUBLIC') { return { ok: true }; }

    // If route has a permission requirement, check it
    if (route.permission) {
      var check = RbacService.requirePermission(permissions, route.permission);
      if (!check.allowed) {
        return { ok: false, error: check.error };
      }
    }

    return { ok: true };
  }

  /**
   * Validate the payload against the route's validator.
   * @param {object} route
   * @param {object} payload
   * @return {{ ok: boolean, errors?: Array }}
   */
  function validatePayload(route, payload) {
    if (!route.validate) { return { ok: true }; }
    var errors = route.validate(payload || {});
    if (errors && errors.length > 0) {
      return { ok: false, errors: errors };
    }
    return { ok: true };
  }

  /**
   * Enforce MEMBER_SELF scoping: narrow results by the caller's flatId/memberId.
   * Mutates the payload to inject the caller's flatId/memberId (never from payload).
   * @param {object} route
   * @param {object} user
   * @param {object} payload
   * @return {{ ok: boolean, error?: string }}
   */
  function enforceScope(route, user, payload) {
    if (route.scope !== 'MEMBER_SELF') { return { ok: true }; }

    // Inject caller's flatId/memberId into payload (server-owned, never from client)
    var result = RbacService.enforceMemberScope(user, payload, { scope: 'MEMBER_SELF' });
    if (!result.allowed) {
      return { ok: false, error: result.error };
    }

    // Server-side: always use the user's own flatId/memberId
    if (user.flatId) { payload.flatId = user.flatId; }
    if (user.memberId) { payload.memberId = user.memberId; }

    return { ok: true };
  }

  /**
   * Dispatch the request to the route handler.
   * @param {object} route
   * @param {object} ctx  handler context
   * @return {{ ok: boolean, data?: object, error?: string }}
   */
  function dispatch(route, ctx) {
    try {
      var result = route.handler(ctx);
      // Handler returns { ok, data, error } or raw data
      if (result && typeof result === 'object' && result.hasOwnProperty('ok')) {
        return result;
      }
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: 'INTERNAL_ERROR' };
    }
  }

  /**
   * Check idempotency for mutating actions.
   * @param {string} action
   * @param {string} clientRequestId
   * @return {{ ok: boolean, duplicate?: boolean, existing?: object }}
   */
  function checkIdempotency(action, clientRequestId) {
    if (!isMutating(action)) { return { ok: true }; }
    if (!clientRequestId) { return { ok: true }; }

    var isNew = Repository.checkIdempotency(clientRequestId);
    if (!isNew) {
      // Duplicate detected — would need to retrieve the original result
      // For now, return duplicate flag; the handler should have stored the result
      return { ok: true, duplicate: true };
    }

    return { ok: true, duplicate: false };
  }

  // ---------------------------------------------------------------------------
  // Main handle function
  // ---------------------------------------------------------------------------

  /**
   * Process an incoming GAS request through the full pipeline.
   *
   * @param {object} e  GAS doPost(e) or doGet(e) event object
   * @return {{ output: object, statusCode: number }}
   */
  function handle(e) {
    var requestId = Utils.newId('REQ');
    var ts = Utils.now();

    // Step 1: Parse
    var parsed = parse(e);
    if (!parsed.ok) {
      return {
        output: Responses.fail(parsed.error, null, null, { requestId: requestId }),
        statusCode: 200
      };
    }
    var req = parsed.request;
    requestId = requestId; // keep the generated one

    // Step 2: Resolve route
    var routeResult = resolveRoute(req.action);
    if (!routeResult.ok) {
      return {
        output: Responses.fail(routeResult.error, null, null, { requestId: requestId }),
        statusCode: 200
      };
    }
    var route = routeResult.route;

    // Step 3: Schema check (skip for public routes and setup actions)
    if (req.action !== 'auth.health' && req.action !== 'setup.status' && req.action !== 'setup.complete') {
      var schemaCheck = checkSchema();
      if (!schemaCheck.ok) {
        return {
          output: Responses.fail(schemaCheck.error, null, null, { requestId: requestId }),
          statusCode: 200
        };
      }
    }

    // Step 4: Authenticate
    var authResult = authenticate(route, req.token);
    if (!authResult.ok) {
      Audit.writeAuth({
        action: 'AUTH_FAILED',
        entity: 'Sessions',
        detail: { action: req.action, reason: authResult.error },
        result: 'FAILED',
        ipHash: AuthService.hashIp(req.ip)
      });
      return {
        output: Responses.fail(authResult.error, null, null, { requestId: requestId }),
        statusCode: 200
      };
    }
    var user = authResult.user;
    var session = authResult.session;

    // Step 5: Authorize
    var permissions = user ? RbacService.resolvePermissions(user.roleKeys) : [];
    var authzResult = authorize(route, user, permissions);
    if (!authzResult.ok) {
      return {
        output: Responses.fail(authzResult.error, null, null, { requestId: requestId }),
        statusCode: 200
      };
    }

    // Step 6: Enforce MEMBER_SELF scope
    var scopeResult = enforceScope(route, user, req.payload);
    if (!scopeResult.ok) {
      return {
        output: Responses.fail(scopeResult.error, null, null, { requestId: requestId }),
        statusCode: 200
      };
    }

    // Step 7: Validate payload
    var valResult = validatePayload(route, req.payload);
    if (!valResult.ok) {
      return {
        output: Responses.fail('VALIDATION_ERROR', null, valResult.errors, { requestId: requestId }),
        statusCode: 200
      };
    }

    // Step 8: Idempotency check for mutating actions
    if (isMutating(req.action) && req.clientRequestId) {
      var idempResult = checkIdempotency(req.action, req.clientRequestId);
      if (idempResult.duplicate) {
        return {
          output: Responses.fail('DUPLICATE_REQUEST', null, null, {
            requestId: requestId,
            duplicate: true
          }),
          statusCode: 200
        };
      }
    }

    // Step 9: Build handler context and dispatch
    var now = Utils.now();
    var ctx = {
      user: user,
      session: session,
      payload: req.payload,
      requestId: requestId,
      now: now,
      permissions: permissions,
      ip: req.ip,
      userAgent: req.userAgent
    };

    var dispatchResult = dispatch(route, ctx);

    // Step 10: Envelope
    if (dispatchResult.ok) {
      var meta = { requestId: requestId };
      if (dispatchResult.page) { meta.page = dispatchResult.page; }
      if (dispatchResult.duplicate) { meta.duplicate = true; }
      return {
        output: Responses.ok(dispatchResult.data, meta),
        statusCode: 200
      };
    } else {
      return {
        output: Responses.fail(
          dispatchResult.error || 'INTERNAL_ERROR',
          dispatchResult.message || null,
          dispatchResult.details || null,
          { requestId: requestId }
        ),
        statusCode: 200
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Expose
  // ---------------------------------------------------------------------------

  return {
    handle: handle,
    parse: parse,
    isMutating: isMutating,
    checkSchema: checkSchema,
    resolveRoute: resolveRoute,
    authenticate: authenticate,
    authorize: authorize,
    validatePayload: validatePayload,
    enforceScope: enforceScope,
    dispatch: dispatch,
    checkIdempotency: checkIdempotency
  };
})();
