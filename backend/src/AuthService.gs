/**
 * AuthService.js — login, logout, session/token management, password hashing, lockout.
 *
 * Rules:
 * - Tokens: 32 random bytes, base64url, opaque; only tokenHash (SHA-256) stored in Sessions.
 * - Passwords: salted iterated SHA-256 (SHA256-ITER-<n>, default 10000) + constant-time compare.
 * - Rate limiting per ipHash + username; lockout after LOGIN_MAX_ATTEMPTS for LOGIN_LOCK_MINUTES.
 * - Password policy: min length 4, not equal to username/email, mustChangePassword enforced.
 * - Session re-validated inside the write lock for state-changing actions.
 * - No hardcoded roles/permissions — all rows in the Auth spreadsheet.
 * - Auth_Audit written for every login success/failure/lock/logout.
 */
var AuthService = (function () {
  'use strict';

  // --------------------------------------------------------------------------- Constants

  var MIN_PASSWORD_LENGTH = 4;
  var TOKEN_BYTE_LENGTH = 32;
  var SESSION_TTL_SECONDS = 720 * 60; // TOKEN_TTL_MINUTES default * 60

  // --------------------------------------------------------------------------- Token helpers

  /**
   * Generate a random base64url token (no padding).
   * @return {string} opaque token string
   */
  function generateToken() {
    var raw = [];
    for (var i = 0; i < TOKEN_BYTE_LENGTH; i++) {
      raw.push(Math.floor(Math.random() * 256));
    }
    // Convert to base64url
    var binary = '';
    for (var j = 0; j < raw.length; j++) {
      binary += String.fromCharCode(raw[j]);
    }
    // Use Utilities.base64Encode then convert to base64url
    var b64 = Utilities.base64Encode(binary);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Hash a token for storage (SHA-256 hex).
   * @param {string} token
   * @return {string} hex hash
   */
  function hashToken(token) {
    return Utils.sha256(token);
  }

  // --------------------------------------------------------------------------- IP hash

  /**
   * Hash an IP address for rate limiting (SHA-256 hex, short prefix).
   * @param {string} ip
   * @return {string}
   */
  function hashIp(ip) {
    if (!ip) { return ''; }
    return Utils.sha256(ip).substring(0, 16);
  }

  // --------------------------------------------------------------------------- Rate limiting

  /**
   * Check if the account is locked.
   * @param {object} user record
   * @return {{ locked: boolean, reason: string }}
   */
  function checkLock(user) {
    if (user.lockedUntil && typeof user.lockedUntil === 'string') {
      var lockedUntil = new Date(user.lockedUntil);
      if (lockedUntil > new Date()) {
        return { locked: true, reason: 'ACCOUNT_LOCKED' };
      }
    }
    return { locked: false, reason: '' };
  }

  /**
   * Increment failed attempts and lock if threshold reached.
   * @param {string} userId
   * @param {string} currentAttempts
   * @return {{ locked: boolean }}
   */
  function recordFailedAttempt(userId, currentAttempts) {
    var attempts = Utils.toNumber(currentAttempts, 0) + 1;
    var maxAttempts = CONFIG.num('LOGIN_MAX_ATTEMPTS') || 5;
    var lockMinutes = CONFIG.num('LOGIN_LOCK_MINUTES') || 15;
    var patch = { failedAttempts: String(attempts) };

    if (attempts >= maxAttempts) {
      var lockUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
      patch.lockedUntil = lockUntil.toISOString();
    }

    Repository.withLock(function () {
      Repository.updateById('Users', userId, patch, { userId: 'SYSTEM' });
    }, 'auth:failed-login');

    return { locked: attempts >= maxAttempts };
  }

  /**
   * Reset failed attempts on successful login.
   * @param {string} userId
   */
  function resetFailedAttempts(userId) {
    Repository.withLock(function () {
      Repository.updateById('Users', userId, {
        failedAttempts: '0',
        lockedUntil: ''
      }, { userId: 'SYSTEM' });
    }, 'auth:reset-attempts');
  }

  // --------------------------------------------------------------------------- Password validation

  /**
   * Validate password policy.
   * @param {string} password
   * @param {string} username
   * @param {string} email
   * @return {{ valid: boolean, message: string }}
   */
  function validatePassword(password, username, email) {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return { valid: false, message: 'Password must be at least ' + MIN_PASSWORD_LENGTH + ' characters.' };
    }
    if (username && password.toLowerCase() === username.toLowerCase()) {
      return { valid: false, message: 'Password cannot be the same as your username.' };
    }
    if (email && password.toLowerCase() === email.toLowerCase()) {
      return { valid: false, message: 'Password cannot be the same as your email.' };
    }
    return { valid: true, message: '' };
  }

  /**
   * Verify a password against stored hash.
   * @param {string} password
   * @param {string} storedHash
   * @param {string} storedSalt
   * @param {string} storedAlgo e.g. 'SHA256-ITER-10000'
   * @return {boolean}
   */
  function verifyPassword(password, storedHash, storedSalt, storedAlgo) {
    if (!password || !storedHash || !storedSalt) { return false; }
    var iterations = 10000;
    if (storedAlgo && storedAlgo.indexOf('SHA256-ITER-') === 0) {
      iterations = parseInt(storedAlgo.replace('SHA256-ITER-', ''), 10) || 10000;
    }
    var result = Utils.hashPassword(password, storedSalt, iterations);
    return Utils.constantTimeEqual(result.hash, storedHash);
  }

  // --------------------------------------------------------------------------- User lookup

  /**
   * Find a user by username or email.
   * @param {string} identifier
   * @return {object|null} user record
   */
  function findUser(identifier) {
    var id = Utils.normaliseEmail(identifier);
    // Try username match
    var byUsername = Repository.countBy('Users', { username: id });
    if (byUsername.exists) {
      var sheet = Repository.getSheet('Users');
      var map = Repository.headerMap('Users');
      var lastRow = sheet.getLastRow();
      if (lastRow <= 1) { return null; }
      var columns = Schema.columnsOf('Users');
      var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
      for (var i = 0; i < values.length; i++) {
        var rec = Repository.fromRow('Users', values[i]);
        if (rec.username === id) { return rec; }
      }
    }
    // Try email match
    var byEmail = Repository.countBy('Users', { email: id });
    if (byEmail.exists) {
      var sheet2 = Repository.getSheet('Users');
      var columns2 = Schema.columnsOf('Users');
      var lastRow2 = sheet2.getLastRow();
      if (lastRow2 <= 1) { return null; }
      var values2 = sheet2.getRange(2, 1, lastRow2 - 1, columns2.length).getValues();
      for (var j = 0; j < values2.length; j++) {
        var rec2 = Repository.fromRow('Users', values2[j]);
        if (rec2.email === id) { return rec2; }
      }
    }
    return null;
  }

  // --------------------------------------------------------------------------- Session management

  /**
   * Create a new session for a user.
   * @param {string} userId
   * @param {object} [opts] { deviceInfo, ipHash }
   * @return {{ token: string, session: object }}
   */
  function createSession(userId, opts) {
    var token = generateToken();
    var tokenHashVal = hashToken(token);
    var ts = Utils.now();
    var ttlMinutes = CONFIG.num('TOKEN_TTL_MINUTES') || 720;
    var expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    var session = {
      userId: userId,
      tokenHash: tokenHashVal,
      issuedAt: ts,
      expiresAt: expiresAt,
      lastSeenAt: ts,
      deviceInfo: (opts && opts.deviceInfo) || '',
      ipHash: (opts && opts.ipHash) || '',
      statusKey: 'ACTIVE',
      revokedAt: '',
      revokedBy: ''
    };

    Repository.withLock(function () {
      Repository.insert('Sessions', session, { userId: userId });
    }, 'auth:create-session');

    return { token: token, session: session };
  }

  /**
   * Find and validate a session by token.
   * @param {string} token
   * @return {{ valid: boolean, session: object|null, error: string }}
   */
  function validateSession(token) {
    if (!token) { return { valid: false, session: null, error: 'UNAUTHENTICATED' }; }

    var tokenHashVal = hashToken(token);
    var result = Repository.countBy('Sessions', { tokenHash: tokenHashVal, statusKey: 'ACTIVE' });
    if (!result.exists) {
      return { valid: false, session: null, error: 'UNAUTHENTICATED' };
    }

    // Find the session
    var sheet = Repository.getSheet('Sessions');
    var columns = Schema.columnsOf('Sessions');
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return { valid: false, session: null, error: 'UNAUTHENTICATED' }; }
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    var session = null;
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow('Sessions', values[i]);
      if (rec.tokenHash === tokenHashVal && rec.statusKey === 'ACTIVE') {
        session = rec;
        break;
      }
    }

    if (!session) { return { valid: false, session: null, error: 'UNAUTHENTICATED' }; }

    // Check expiry
    if (session.expiresAt) {
      var expires = new Date(session.expiresAt);
      if (expires < new Date()) {
        return { valid: false, session: null, error: 'TOKEN_EXPIRED' };
      }
    }

    // Check revoked
    if (session.statusKey === 'REVOKED' || session.revokedAt) {
      return { valid: false, session: null, error: 'TOKEN_REVOKED' };
    }

    // Update lastSeenAt
    Repository.withLock(function () {
      Repository.updateById('Sessions', session.sessionId, {
        lastSeenAt: Utils.now()
      }, { userId: session.userId });
    }, 'auth:session-touch');

    return { valid: true, session: session, error: '' };
  }

  /**
   * Revoke a session.
   * @param {string} sessionId
   * @param {string} revokedBy
   */
  function revokeSession(sessionId, revokedBy) {
    Repository.withLock(function () {
      Repository.updateById('Sessions', sessionId, {
        statusKey: 'REVOKED',
        revokedAt: Utils.now(),
        revokedBy: revokedBy || ''
      }, { userId: revokedBy || 'SYSTEM' });
    }, 'auth:revoke-session');
  }

  /**
   * Revoke all sessions for a user.
   * @param {string} userId
   * @param {string} revokedBy
   */
  function revokeAllSessions(userId, revokedBy) {
    var sheet = Repository.getSheet('Sessions');
    var columns = Schema.columnsOf('Sessions');
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return; }
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    var ts = Utils.now();
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow('Sessions', values[i]);
      if (rec.userId === userId && rec.statusKey === 'ACTIVE') {
        Repository.withLock(function (r) {
          Repository.updateById('Sessions', r.sessionId, {
            statusKey: 'REVOKED',
            revokedAt: ts,
            revokedBy: revokedBy || 'SYSTEM'
          }, { userId: revokedBy || 'SYSTEM' });
        }.bind(null, rec), 'auth:revoke-all');
      }
    }
  }

  // --------------------------------------------------------------------------- Login

  /**
   * Authenticate a user and return a session token.
   *
   * @param {object} params
   * @param {string} params.username  username or email
   * @param {string} params.password  plaintext password
   * @param {string} [params.ip]      client IP for rate limiting
   * @param {string} [params.deviceInfo]
   * @return {{ ok: boolean, data?: object, error?: string }}
   */
  function login(params) {
    var ipHashVal = hashIp(params.ip || '');
    var identifier = Utils.normaliseEmail(params.username || '');

    if (!identifier || !params.password) {
      return { ok: false, error: 'BAD_REQUEST' };
    }

    // Lookup user
    var user = findUser(identifier);
    if (!user) {
      Audit.writeAuth({
        action: 'LOGIN_FAILED',
        entity: 'Users',
        detail: { reason: 'USER_NOT_FOUND', username: identifier },
        result: 'FAILED',
        ipHash: ipHashVal
      });
      return { ok: false, error: 'UNAUTHENTICATED' };
    }

    // Check lock
    var lock = checkLock(user);
    if (lock.locked) {
      Audit.writeAuth({
        action: 'LOGIN_FAILED',
        entity: 'Users',
        entityId: user.userId,
        detail: { reason: 'ACCOUNT_LOCKED' },
        result: 'FAILED',
        actorUserId: user.userId,
        ipHash: ipHashVal
      });
      return { ok: false, error: lock.reason };
    }

    // Check user status
    if (user.statusKey !== 'ACTIVE') {
      Audit.writeAuth({
        action: 'LOGIN_FAILED',
        entity: 'Users',
        entityId: user.userId,
        detail: { reason: 'ACCOUNT_' + (user.statusKey || 'INACTIVE') },
        result: 'FAILED',
        actorUserId: user.userId,
        ipHash: ipHashVal
      });
      return { ok: false, error: 'UNAUTHENTICATED' };
    }

    // Verify password
    var passwordValid = verifyPassword(
      params.password,
      user.passwordHash,
      user.passwordSalt,
      user.passwordAlgo
    );

    if (!passwordValid) {
      var lockResult = recordFailedAttempt(user.userId, user.failedAttempts);
      Audit.writeAuth({
        action: 'LOGIN_FAILED',
        entity: 'Users',
        entityId: user.userId,
        detail: { reason: 'INVALID_PASSWORD', failedAttempts: Utils.toNumber(user.failedAttempts, 0) + 1 },
        result: 'FAILED',
        actorUserId: user.userId,
        ipHash: ipHashVal
      });
      if (lockResult.locked) {
        Audit.writeAuth({
          action: 'ACCOUNT_LOCKED',
          entity: 'Users',
          entityId: user.userId,
          detail: { lockedUntil: new Date(Date.now() + (CONFIG.num('LOGIN_LOCK_MINUTES') || 15) * 60 * 1000).toISOString() },
          result: 'SUCCESS',
          actorUserId: user.userId,
          ipHash: ipHashVal
        });
      }
      return { ok: false, error: 'UNAUTHENTICATED' };
    }

    // Password valid — check mustChangePassword
    if (user.mustChangePassword === 'TRUE' || user.mustChangePassword === true) {
      // Still create a session but flag the requirement
      resetFailedAttempts(user.userId);
      var forcedSession = createSession(user.userId, { deviceInfo: params.deviceInfo, ipHash: ipHashVal });

      Audit.writeAuth({
        action: 'LOGIN_SUCCESS',
        entity: 'Users',
        entityId: user.userId,
        detail: { mustChangePassword: true },
        result: 'SUCCESS',
        actorUserId: user.userId,
        ipHash: ipHashVal
      });

      return {
        ok: true,
        data: {
          token: forcedSession.token,
          mustChangePassword: true,
          user: sanitizeUser(user),
          roleKeys: Utils.csvToArray(user.roleKeys)
        }
      };
    }

    // Normal successful login
    resetFailedAttempts(user.userId);
    var session = createSession(user.userId, { deviceInfo: params.deviceInfo, ipHash: ipHashVal });

    // Update lastLoginAt
    Repository.withLock(function () {
      Repository.updateById('Users', user.userId, {
        lastLoginAt: Utils.now()
      }, { userId: user.userId });
    }, 'auth:update-last-login');

    Audit.writeAuth({
      action: 'LOGIN_SUCCESS',
      entity: 'Users',
      entityId: user.userId,
      detail: {},
      result: 'SUCCESS',
      actorUserId: user.userId,
      ipHash: ipHashVal
    });

    // Resolve permissions
    var permissions = RbacService.resolvePermissions(user.roleKeys);

    return {
      ok: true,
      data: {
        token: session.token,
        mustChangePassword: false,
        user: sanitizeUser(user),
        roleKeys: Utils.csvToArray(user.roleKeys),
        permissions: permissions
      }
    };
  }

  // --------------------------------------------------------------------------- Logout

  /**
   * Revoke the current session.
   * @param {object} sessionObj  validated session from validateSession
   * @return {{ ok: boolean }}
   */
  function logout(sessionObj) {
    if (!sessionObj || !sessionObj.sessionId) {
      return { ok: false, error: 'UNAUTHENTICATED' };
    }

    revokeSession(sessionObj.sessionId, sessionObj.userId);

    Audit.writeAuth({
      action: 'LOGOUT',
      entity: 'Sessions',
      entityId: sessionObj.sessionId,
      detail: {},
      result: 'SUCCESS',
      actorUserId: sessionObj.userId,
      ipHash: sessionObj.ipHash || ''
    });

    return { ok: true };
  }

  // --------------------------------------------------------------------------- Password change

  /**
   * Change a user's password.
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.currentPassword
   * @param {string} params.newPassword
   * @return {{ ok: boolean, error?: string }}
   */
  function changePassword(params) {
    var user = Repository.findById('Users', params.userId);
    if (!user) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    // Verify current password
    var currentValid = verifyPassword(
      params.currentPassword,
      user.passwordHash,
      user.passwordSalt,
      user.passwordAlgo
    );

    if (!currentValid) {
      Audit.writeAuth({
        action: 'PASSWORD_CHANGE_FAILED',
        entity: 'Users',
        entityId: params.userId,
        detail: { reason: 'INVALID_CURRENT_PASSWORD' },
        result: 'FAILED',
        actorUserId: params.userId
      });
      // A wrong current password is a VALIDATION failure, not an auth failure:
      // the caller's session is perfectly valid. Returning UNAUTHENTICATED here
      // made the frontend's apiClient treat the session as dead — it cleared
      // auth and bounced the user to the login screen, so one typo ended the
      // session. Report it against the field that was wrong instead.
      return {
        ok: false,
        error: 'VALIDATION_ERROR',
        message: 'Current password is incorrect.',
        details: [{ field: 'currentPassword', message: 'Current password is incorrect.' }]
      };
    }

    // Validate new password
    var validation = validatePassword(params.newPassword, user.username, user.email);
    if (!validation.valid) {
      return { ok: false, error: 'VALIDATION_ERROR', message: validation.message };
    }

    // Hash new password
    var hashResult = Utils.hashPassword(params.newPassword);
    var ts = Utils.now();

    Repository.withLock(function () {
      Repository.updateById('Users', params.userId, {
        passwordHash: hashResult.hash,
        passwordSalt: hashResult.salt,
        passwordAlgo: hashResult.algo,
        mustChangePassword: 'FALSE',
        passwordChangedAt: ts
      }, { userId: params.userId });
    }, 'auth:change-password');

    // Revoke all other sessions
    revokeAllSessions(params.userId, params.userId);

    Audit.writeAuth({
      action: 'PASSWORD_CHANGED',
      entity: 'Users',
      entityId: params.userId,
      detail: {},
      result: 'SUCCESS',
      actorUserId: params.userId
    });

    return { ok: true };
  }

  // --------------------------------------------------------------------------- Get current user

  /**
   * Return the current user profile from a validated session.
   * @param {object} sessionObj  validated session
   * @return {{ ok: boolean, data?: object, error?: string }}
   */
  function me(sessionObj) {
    if (!sessionObj || !sessionObj.userId) {
      return { ok: false, error: 'UNAUTHENTICATED' };
    }

    var user = Repository.findById('Users', sessionObj.userId);
    if (!user) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    var permissions = RbacService.resolvePermissions(user.roleKeys);

    return {
      ok: true,
      data: {
        user: sanitizeUser(user),
        roleKeys: Utils.csvToArray(user.roleKeys),
        permissions: permissions
      }
    };
  }

  // --------------------------------------------------------------------------- Session list

  /**
   * List active sessions for a user.
   * @param {string} userId
   * @return {{ ok: boolean, data: Array }}
   */
  function listSessions(userId) {
    var sheet = Repository.getSheet('Sessions');
    var columns = Schema.columnsOf('Sessions');
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return { ok: true, data: [] }; }
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    var sessions = [];
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow('Sessions', values[i]);
      if (rec.userId === userId && rec.statusKey === 'ACTIVE') {
        sessions.push({
          sessionId: rec.sessionId,
          issuedAt: rec.issuedAt,
          expiresAt: rec.expiresAt,
          lastSeenAt: rec.lastSeenAt,
          deviceInfo: rec.deviceInfo,
          ipHash: rec.ipHash
        });
      }
    }
    return { ok: true, data: sessions };
  }

  // --------------------------------------------------------------------------- Helpers

  /**
   * Remove sensitive fields from a user record before sending to client.
   * @param {object} user
   * @return {object} sanitized user
   */
  function sanitizeUser(user) {
    if (!user) { return null; }
    var safe = {};
    var safeFields = [
      'userId', 'username', 'email', 'mobile', 'fullName',
      'roleKeys', 'memberId', 'employeeId', 'flatId',
      'statusKey', 'mustChangePassword', 'lastLoginAt',
      'createdAt', 'updatedAt'
    ];
    for (var i = 0; i < safeFields.length; i++) {
      if (user.hasOwnProperty(safeFields[i])) {
        safe[safeFields[i]] = user[safeFields[i]];
      }
    }
    return safe;
  }

  /**
   * Extract a Bearer token from an Authorization header value.
   * @param {string} authHeader
   * @return {string|null} token or null
   */
  function extractToken(authHeader) {
    if (!authHeader || typeof authHeader !== 'string') { return null; }
    var parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') { return null; }
    return parts[1] || null;
  }

  // --------------------------------------------------------------------------- Health

  /**
   * Public health/version probe.
   * @return {{ ok: boolean, data: object }}
   */
  function health() {
    var isConfigured = false;
    try {
      if (typeof ConfigService !== 'undefined' && ConfigService.get) {
        isConfigured = !!ConfigService.get().isConfigured;
      }
    } catch (e) { /* not installed yet */ }
    return {
      ok: true,
      data: {
        status: 'ok',
        schemaVersion: typeof Schema !== 'undefined' ? Schema.SCHEMA_VERSION : 0,
        appVersion: typeof Schema !== 'undefined' ? Schema.APP_VERSION : '',
        isConfigured: isConfigured
      }
    };
  }

  // --------------------------------------------------------------------------- User management

  /** Build a client-safe user view (roleKeys as array, no secrets). */
  function userView(user) {
    var safe = sanitizeUser(user);
    safe.roleKeys = Utils.csvToArray(user.roleKeys);
    safe.mustChangePassword = user.mustChangePassword === 'TRUE' || user.mustChangePassword === true;
    return safe;
  }

  /**
   * List users (never password fields).
   * @param {object} ctx
   * @return {{ ok: boolean, data: Array, page: object }}
   */
  function listUsers(ctx) {
    var p = ctx.payload || {};
    var filter = {};
    if (p.statusKey) { filter.statusKey = p.statusKey; }
    if (p.roleKey) { filter.roleKey = p.roleKey; }

    var result = Repository.readSheet('Users', {
      page: p.page || 1,
      pageSize: p.pageSize || CONFIG.pageSizeDefault(),
      search: p.search || '',
      searchFields: ['username', 'email', 'fullName', 'mobile'],
      sort: p.sort || 'createdAt',
      sortDir: p.sortDir || 'desc',
      filter: filter
    });

    // If roleKey filter is requested, match against CSV roleKeys
    var rows = result.rows;
    if (p.roleKey) {
      rows = rows.filter(function (u) {
        return Utils.csvToArray(u.roleKeys).indexOf(p.roleKey) !== -1;
      });
    }

    return { ok: true, data: rows.map(userView), page: result.page };
  }

  /**
   * Get a single user + roles + linked member/employee.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function getUser(ctx) {
    var p = ctx.payload || {};
    var user = Repository.findById('Users', p.userId);
    if (!user) { return { ok: false, error: 'NOT_FOUND' }; }

    var view = userView(user);
    view.permissions = RbacService.resolvePermissions(user.roleKeys);

    // Linked member / employee summaries
    if (user.memberId) {
      var member = Repository.findById('Members', user.memberId);
      if (member) { view.member = { memberId: member.memberId, fullName: member.fullName, flatId: member.flatId }; }
    }
    if (user.employeeId) {
      var emp = Repository.findById('Employees', user.employeeId);
      if (emp) { view.employee = { employeeId: emp.employeeId, fullName: emp.fullName, employeeCode: emp.employeeCode }; }
    }

    return { ok: true, data: view };
  }

  /**
   * Create a user with a temporary password (mustChangePassword=TRUE).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function createUser(ctx) {
    var p = ctx.payload || {};

    var username = String(p.username || '').trim();
    var email = Utils.normaliseEmail(p.email || '');
    if (!username) { return { ok: false, error: 'VALIDATION_ERROR', message: 'Username is required.' }; }
    if (!Utils.isEmail(email)) { return { ok: false, error: 'VALIDATION_ERROR', message: 'Invalid email.' }; }

    // Uniqueness
    if (Repository.countBy('Users', { username: username }).exists) {
      return { ok: false, error: 'CONFLICT_ERROR', message: 'Username already exists.' };
    }
    if (email && Repository.countBy('Users', { email: email }).exists) {
      return { ok: false, error: 'CONFLICT_ERROR', message: 'Email already exists.' };
    }

    var tempPassword = p.temporaryPassword || '';
    var validation = validatePassword(tempPassword, username, email);
    if (!validation.valid) {
      return { ok: false, error: 'VALIDATION_ERROR', message: validation.message };
    }

    var roleKeys = Array.isArray(p.roleKeys) ? p.roleKeys : Utils.csvToArray(p.roleKeys);
    if (roleKeys.length === 0) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'At least one role is required.' };
    }

    var hashed = Utils.hashPassword(tempPassword);

    var created = Repository.withLock(function () {
      return Repository.insert('Users', {
        username: username,
        email: email,
        mobile: p.mobile || '',
        fullName: p.fullName || '',
        passwordHash: hashed.hash,
        passwordSalt: hashed.salt,
        passwordAlgo: hashed.algo,
        roleKeys: Utils.arrayToCsv(roleKeys),
        memberId: p.memberId || '',
        employeeId: p.employeeId || '',
        flatId: p.flatId || '',
        statusKey: 'ACTIVE',
        mustChangePassword: 'TRUE',
        failedAttempts: '0',
        lockedUntil: '',
        passwordChangedAt: ''
      }, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'auth:create-user');

    Audit.writeAuth({
      action: 'USER_CREATED',
      entity: 'Users',
      entityId: created.userId,
      detail: { username: username, email: email, roleKeys: roleKeys },
      result: 'SUCCESS',
      actorUserId: ctx.user ? ctx.user.userId : 'SYSTEM'
    });

    return { ok: true, data: userView(created) };
  }

  /**
   * Update a user (never password fields here; use resetPassword).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function updateUser(ctx) {
    var p = ctx.payload || {};
    var user = Repository.findById('Users', p.userId);
    if (!user) { return { ok: false, error: 'NOT_FOUND' }; }

    var values = p.values || {};
    var patch = {};
    var allowed = ['username', 'email', 'mobile', 'fullName', 'memberId', 'employeeId', 'flatId'];

    if (values.username !== undefined && values.username !== '') {
      if (Repository.countBy('Users', { username: String(values.username) }).exists &&
          String(values.username) !== user.username) {
        return { ok: false, error: 'CONFLICT_ERROR', message: 'Username already exists.' };
      }
    }

    allowed.forEach(function (k) {
      if (values[k] !== undefined) { patch[k] = values[k]; }
    });

    if (values.roleKeys !== undefined) {
      var roleKeys = Array.isArray(values.roleKeys) ? values.roleKeys : Utils.csvToArray(values.roleKeys);
      patch.roleKeys = Utils.arrayToCsv(roleKeys);
    }

    var updated = Repository.withLock(function () {
      return Repository.updateById('Users', p.userId, patch, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'auth:update-user');

    if (!updated) { return { ok: false, error: 'NOT_FOUND' }; }

    Audit.writeAuth({
      action: 'USER_UPDATED',
      entity: 'Users',
      entityId: p.userId,
      detail: { changed: Object.keys(patch) },
      result: 'SUCCESS',
      actorUserId: ctx.user ? ctx.user.userId : 'SYSTEM'
    });

    return { ok: true, data: userView(updated) };
  }

  /**
   * Set user status (ACTIVE/INACTIVE/LOCKED); revokes sessions when disabling.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function setUserStatus(ctx) {
    var p = ctx.payload || {};
    var status = String(p.status || '').toUpperCase();
    if (['ACTIVE', 'INACTIVE', 'LOCKED'].indexOf(status) === -1) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Status must be ACTIVE, INACTIVE or LOCKED.' };
    }

    var user = Repository.findById('Users', p.userId);
    if (!user) { return { ok: false, error: 'NOT_FOUND' }; }

    var patch = { statusKey: status };
    if (status !== 'LOCKED') {
      patch.failedAttempts = '0';
      patch.lockedUntil = '';
    }

    var updated = Repository.withLock(function () {
      return Repository.updateById('Users', p.userId, patch, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'auth:set-user-status');

    if (status !== 'ACTIVE') {
      revokeAllSessions(p.userId, ctx.user ? ctx.user.userId : 'SYSTEM');
    }

    Audit.writeAuth({
      action: 'USER_STATUS_CHANGED',
      entity: 'Users',
      entityId: p.userId,
      detail: { status: status, reason: p.reason || '' },
      result: 'SUCCESS',
      actorUserId: ctx.user ? ctx.user.userId : 'SYSTEM'
    });

    return { ok: true, data: userView(updated) };
  }

  /**
   * Reset a user's password with a temporary password (mustChangePassword=TRUE).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function resetPassword(ctx) {
    var p = ctx.payload || {};
    var user = Repository.findById('Users', p.userId);
    if (!user) { return { ok: false, error: 'NOT_FOUND' }; }

    var tempPassword = p.temporaryPassword || '';
    var validation = validatePassword(tempPassword, user.username, user.email);
    if (!validation.valid) {
      return { ok: false, error: 'VALIDATION_ERROR', message: validation.message };
    }

    var hashed = Utils.hashPassword(tempPassword);

    var updated = Repository.withLock(function () {
      return Repository.updateById('Users', p.userId, {
        passwordHash: hashed.hash,
        passwordSalt: hashed.salt,
        passwordAlgo: hashed.algo,
        mustChangePassword: 'TRUE',
        passwordChangedAt: Utils.now()
      }, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'auth:reset-password');

    revokeAllSessions(p.userId, ctx.user ? ctx.user.userId : 'SYSTEM');

    Audit.writeAuth({
      action: 'PASSWORD_RESET',
      entity: 'Users',
      entityId: p.userId,
      detail: {},
      result: 'SUCCESS',
      actorUserId: ctx.user ? ctx.user.userId : 'SYSTEM'
    });

    return { ok: true, data: userView(updated) };
  }

  // --------------------------------------------------------------------------- Role management

  /**
   * List roles.
   * @param {object} ctx
   * @return {{ ok: boolean, data: Array, page: object }}
   */
  function listRoles(ctx) {
    var p = ctx.payload || {};
    var result = Repository.readSheet('Roles', {
      page: p.page || 1,
      pageSize: p.pageSize || CONFIG.pageSizeDefault(),
      search: p.search || '',
      searchFields: ['roleKey', 'roleName'],
      sort: p.sort || 'sortOrder',
      sortDir: p.sortDir || 'asc',
      filter: p.status ? { status: p.status } : {}
    });

    var rows = result.rows.map(function (r) {
      return {
        roleKey: r.roleKey,
        roleName: r.roleName,
        description: r.description || '',
        isSystem: r.isSystem === 'TRUE' || r.isSystem === true,
        statusKey: r.status || ''
      };
    });

    return { ok: true, data: rows, page: result.page };
  }

  /**
   * Create a role.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function createRole(ctx) {
    var p = ctx.payload || {};
    var roleKey = String(p.roleKey || '').trim().toUpperCase();
    var roleName = String(p.roleName || '').trim();
    if (!roleKey) { return { ok: false, error: 'VALIDATION_ERROR', message: 'Role key is required.' }; }
    if (!roleName) { return { ok: false, error: 'VALIDATION_ERROR', message: 'Role name is required.' }; }

    if (Repository.countBy('Roles', { roleKey: roleKey }).exists) {
      return { ok: false, error: 'CONFLICT_ERROR', message: 'Role already exists.' };
    }

    var created = Repository.withLock(function () {
      return Repository.insert('Roles', {
        roleKey: roleKey,
        roleName: roleName,
        description: p.description || '',
        isSystem: 'FALSE',
        sortOrder: '0',
        status: 'ACTIVE'
      }, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'auth:create-role');

    Audit.writeAuth({
      action: 'ROLE_CREATED',
      entity: 'Roles',
      entityId: roleKey,
      detail: { roleName: roleName },
      result: 'SUCCESS',
      actorUserId: ctx.user ? ctx.user.userId : 'SYSTEM'
    });

    return { ok: true, data: { roleKey: created.roleKey, roleName: created.roleName, description: created.description || '', isSystem: false, statusKey: created.status } };
  }

  /**
   * Update a role.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function updateRole(ctx) {
    var p = ctx.payload || {};
    var role = Repository.findById('Roles', p.roleKey);
    if (!role) { return { ok: false, error: 'NOT_FOUND' }; }

    var values = p.values || {};
    var patch = {};
    if (values.roleName !== undefined) { patch.roleName = values.roleName; }
    if (values.description !== undefined) { patch.description = values.description; }

    var updated = Repository.withLock(function () {
      return Repository.updateById('Roles', p.roleKey, patch, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'auth:update-role');

    Audit.writeAuth({
      action: 'ROLE_UPDATED',
      entity: 'Roles',
      entityId: p.roleKey,
      detail: { changed: Object.keys(patch) },
      result: 'SUCCESS',
      actorUserId: ctx.user ? ctx.user.userId : 'SYSTEM'
    });

    return { ok: true, data: { roleKey: updated.roleKey, roleName: updated.roleName, description: updated.description || '', isSystem: updated.isSystem === 'TRUE', statusKey: updated.status } };
  }

  /**
   * Set role status; refuses when active users still hold it.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function setRoleStatus(ctx) {
    var p = ctx.payload || {};
    var status = String(p.status || '').toUpperCase();
    if (status !== 'ACTIVE' && status !== 'INACTIVE') {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Status must be ACTIVE or INACTIVE.' };
    }

    var role = Repository.findById('Roles', p.roleKey);
    if (!role) { return { ok: false, error: 'NOT_FOUND' }; }

    if (status === 'INACTIVE') {
      var holderCount = 0;
      try {
        var users = Repository.readSheet('Users', { page: 1, pageSize: 100 });
        holderCount = users.rows.filter(function (u) {
          return u.statusKey === 'ACTIVE' && Utils.csvToArray(u.roleKeys).indexOf(p.roleKey) !== -1;
        }).length;
      } catch (e) { /* ignore */ }
      if (holderCount > 0) {
        return { ok: false, error: 'DEPENDENCY_EXISTS', message: 'Active users still hold this role.' };
      }
    }

    var updated = Repository.withLock(function () {
      return Repository.updateById('Roles', p.roleKey, { status: status }, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'auth:set-role-status');

    Audit.writeAuth({
      action: 'ROLE_STATUS_CHANGED',
      entity: 'Roles',
      entityId: p.roleKey,
      detail: { status: status },
      result: 'SUCCESS',
      actorUserId: ctx.user ? ctx.user.userId : 'SYSTEM'
    });

    return { ok: true, data: { roleKey: updated.roleKey, roleName: updated.roleName, statusKey: updated.status } };
  }

  // --------------------------------------------------------------------------- Permissions

  /**
   * List permissions catalog.
   * @param {object} ctx
   * @return {{ ok: boolean, data: Array }}
   */
  function listPermissions(ctx) {
    var p = ctx.payload || {};
    var result = Repository.readSheet('Permissions', {
      page: 1,
      pageSize: 1000,
      filter: p.module ? { module: p.module } : {}
    });
    var rows = result.rows.map(function (r) {
      return {
        permissionKey: r.permissionKey,
        module: r.module,
        action: r.action,
        description: r.description || '',
        status: r.status || ''
      };
    });
    return { ok: true, data: rows };
  }

  /**
   * Permission matrix for one role.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function getRolePermissions(ctx) {
    var p = ctx.payload || {};
    var role = Repository.findById('Roles', p.roleKey);
    if (!role) { return { ok: false, error: 'NOT_FOUND' }; }

    var result = Repository.readSheet('Role_Permissions', { page: 1, pageSize: 1000 });
    var matrix = {};
    result.rows.forEach(function (r) {
      if (r.roleKey === p.roleKey) {
        matrix[r.permissionKey] = r.isAllowed === 'TRUE' || r.isAllowed === true;
      }
    });

    return { ok: true, data: { roleKey: p.roleKey, permissions: matrix } };
  }

  /**
   * Update the permission matrix for a role.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function updateRolePermissions(ctx) {
    var p = ctx.payload || {};
    var role = Repository.findById('Roles', p.roleKey);
    if (!role) { return { ok: false, error: 'NOT_FOUND' }; }

    var entries = p.entries || [];
    if (!Array.isArray(entries) || entries.length === 0) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'entries[] is required.' };
    }

    Repository.withLock(function () {
      entries.forEach(function (entry) {
        var permissionKey = entry.permissionKey;
        var isAllowed = entry.isAllowed === true || entry.isAllowed === 'TRUE';
        var existing = Repository.countBy('Role_Permissions', { roleKey: p.roleKey, permissionKey: permissionKey });
        if (existing.exists) {
          var sheet = Repository.getSheet('Role_Permissions');
          var map = Repository.headerMap('Role_Permissions');
          var lastRow = sheet.getLastRow();
          var columns = Schema.columnsOf('Role_Permissions');
          var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
          for (var i = 0; i < values.length; i++) {
            var rec = Repository.fromRow('Role_Permissions', values[i]);
            if (rec.roleKey === p.roleKey && rec.permissionKey === permissionKey) {
              Repository.updateById('Role_Permissions', rec.rolePermissionId, { isAllowed: isAllowed ? 'TRUE' : 'FALSE' }, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
              break;
            }
          }
        } else {
          Repository.insert('Role_Permissions', {
            roleKey: p.roleKey,
            permissionKey: permissionKey,
            isAllowed: isAllowed ? 'TRUE' : 'FALSE'
          }, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
        }
      });
    }, 'auth:update-role-permissions');

    Audit.writeAuth({
      action: 'PERMISSION_CHANGED',
      entity: 'Roles',
      entityId: p.roleKey,
      detail: { permissions: entries },
      result: 'SUCCESS',
      actorUserId: ctx.user ? ctx.user.userId : 'SYSTEM'
    });

    return { ok: true, data: getRolePermissions(ctx).data };
  }

  // --------------------------------------------------------------------------- Expose

  return {
    generateToken: generateToken,
    hashToken: hashToken,
    hashIp: hashIp,
    checkLock: checkLock,
    recordFailedAttempt: recordFailedAttempt,
    resetFailedAttempts: resetFailedAttempts,
    validatePassword: validatePassword,
    verifyPassword: verifyPassword,
    findUser: findUser,
    createSession: createSession,
    validateSession: validateSession,
    revokeSession: revokeSession,
    revokeAllSessions: revokeAllSessions,
    login: login,
    logout: logout,
    changePassword: changePassword,
    me: me,
    listSessions: listSessions,
    sanitizeUser: sanitizeUser,
    extractToken: extractToken,
    // Health
    health: health,
    // User management
    listUsers: listUsers,
    getUser: getUser,
    createUser: createUser,
    updateUser: updateUser,
    setUserStatus: setUserStatus,
    resetPassword: resetPassword,
    // Role management
    listRoles: listRoles,
    createRole: createRole,
    updateRole: updateRole,
    setRoleStatus: setRoleStatus,
    // Permissions
    listPermissions: listPermissions,
    getRolePermissions: getRolePermissions,
    updateRolePermissions: updateRolePermissions
  };
})();
