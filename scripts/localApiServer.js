#!/usr/bin/env node
/**
 * scripts/localApiServer.js — the local API harness.
 *
 * Runs the REAL backend (`backend/src/*.gs`) in-process on the in-memory GAS
 * runtime from `tests/fixtures/gasRuntime/fakeGasRuntime.js`, and exposes the
 * same `POST {action, payload, token, clientRequestId}` envelope over HTTP.
 *
 * WHY THIS EXISTS
 * The frontend talks to a Google Apps Script web app. That makes local
 * development and the Playwright suite depend on a deployed Google project, a
 * Google login, and live society data. This server removes all three: it is
 * deterministic, offline, and safe to write to.
 *
 * It is referenced by the root `npm run api` script, which previously pointed at
 * this file before it existed.
 *
 * USAGE
 *   node scripts/localApiServer.js                 # port 8787
 *   PORT=9000 node scripts/localApiServer.js
 *   E2E_USERNAME=... E2E_PASSWORD=... node scripts/localApiServer.js
 *
 * Then point the frontend at it:
 *   frontend/.env  ->  VITE_API_BASE_URL=http://localhost:8787/
 *
 * SEED
 * `Setup.install()` creates every sheet and seeds all reference data
 * (statuses, roles, permissions, role-permissions, payment modes, employee
 * types, complaint priorities, document categories, numbering). `seedAdminUser`
 * creates one ADMIN. `seedDummyData()` adds demo flats/members/etc. so list
 * screens render real rows.
 *
 * The state is in memory only and is discarded when the process exits.
 */

'use strict';

const http = require('http');

/* Loading the fixture defines the GAS globals AND evaluates every backend
 * source file into this context, so `CONFIG`, `Setup`, `ApiRouter` etc. become
 * available as globals — exactly as they are inside Apps Script. */
require('../tests/fixtures/gasRuntime/fakeGasRuntime');

const PORT = Number(process.env.PORT || 8787);

const ADMIN_USERNAME = process.env.E2E_USERNAME || 'admin';
const ADMIN_EMAIL = process.env.E2E_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.E2E_PASSWORD || 'Admin@1234';

/* ── Bootstrap ──────────────────────────────────────────────────────────── */

function bootstrap() {
  const rt = globalThis.__testRuntime;
  rt.resetAll();

  CONFIG.setPropertyBag({
    SOCIETY_SHEET_ID: 'LOCAL-SOCIETY',
    AUTH_SHEET_ID: 'LOCAL-AUTH',
    CACHE_TTL_SECONDS: '300',
  });

  Setup.install();

  const seeded = Setup.seedAdminUser({
    username: ADMIN_USERNAME,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (!seeded || seeded.ok === false) {
    throw new Error(
      `Could not seed the admin user: ${seeded && seeded.message ? seeded.message : 'unknown error'}`,
    );
  }

  let dummy = null;
  try {
    dummy = Setup.seedDummyData();
  } catch (err) {
    // Demo data is a convenience, not a requirement — an empty society still
    // exercises every loading/empty state the UI has.
    console.warn(`[local-api] seedDummyData failed (continuing): ${err.message}`);
  }

  return { dummy };
}

/* ── Request handling ───────────────────────────────────────────────────── */

/** Headers that let the Vite dev server (a different origin) call us. */
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function send(res, status, body, contentType) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    ...corsHeaders(),
    'Content-Type': contentType || 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/** Reads the whole request body. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Translates an HTTP request into the GAS event object the router expects and
 * returns its envelope. Mirrors `Main.doPost` (backend/src/Main.gs:21).
 */
function dispatch(method, body) {
  const event = {
    method,
    postData: { contents: body },
    parameter: {},
    headers: {},
    context: {},
  };

  const result = ApiRouter.handle(event);
  return result.output;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method === 'GET') {
    // Frontend sends GET with ?action=...&payload=... to avoid GAS 302 redirect.
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const actionParam = parsedUrl.searchParams.get('action');
    const payloadParam = parsedUrl.searchParams.get('payload');

    if (!actionParam) {
      // Human-friendly probe when no action param
      send(res, 200, {
        ok: true,
        data: {
          service: 'society-management local API',
          port: PORT,
          adminUsername: ADMIN_USERNAME,
          hint: 'GET ?action=...&payload=... or POST {action, payload, token, clientRequestId}',
        },
      });
      return;
    }

    // Build a synthetic body from query params
    let bodyStr = '{}';
    try {
      const payload = payloadParam ? JSON.parse(payloadParam) : {};
      bodyStr = JSON.stringify({ action: actionParam, ...payload });
    } catch {
      bodyStr = JSON.stringify({ action: actionParam, payload: {} });
    }

    let action = actionParam;
    try {
      const output = dispatch('GET', bodyStr);
      send(res, 200, output);
      console.log(`  ${action} -> ${output && output.ok !== false ? 'ok' : (output.error ? output.error.code : 'ERROR')}`);
    } catch (err) {
      console.error(`  ${action} -> THREW`, err);
      send(res, 200, {
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: String(err && err.message ? err.message : err) },
      });
    }
    return;
  }

  if (req.method !== 'POST') {
    send(res, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: req.method } });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    send(res, 400, { ok: false, error: { code: 'BAD_REQUEST', message: String(err) } });
    return;
  }

  let action = '(unparsed)';
  try {
    action = JSON.parse(body).action || '(none)';
  } catch {
    /* fall through — the router reports the parse failure itself */
  }

  try {
    const output = dispatch('POST', body);
    const code = output && output.ok ? 200 : 200;
    send(res, code, output);
    if (!output || output.ok !== true) {
      console.log(`  ${action} -> ${output && output.error ? output.error.code : 'ERROR'}`);
    } else {
      console.log(`  ${action} -> ok`);
    }
  } catch (err) {
    // An uncaught throw is a backend bug. Surface it as an envelope rather than
    // an HTML error page, so the frontend shows a real message.
    console.error(`  ${action} -> THREW`, err);
    send(res, 200, {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: String(err && err.message ? err.message : err) },
    });
  }
});

/* ── Start ──────────────────────────────────────────────────────────────── */

let booted;
try {
  booted = bootstrap();
} catch (err) {
  console.error('[local-api] bootstrap failed:', err.message);
  process.exit(1);
}

server.listen(PORT, () => {
  console.log('');
  console.log('  Local API server running — real backend, in-memory data');
  console.log(`  URL:      http://localhost:${PORT}/`);
  console.log(`  Sign in:  ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
  if (booted.dummy) {
    console.log(`  Demo data seeded: ${JSON.stringify(booted.dummy).slice(0, 160)}`);
  }
  console.log('');
  console.log(`  Point the frontend at it:`);
  console.log(`    frontend/.env -> VITE_API_BASE_URL=http://localhost:${PORT}/`);
  console.log('');
});
