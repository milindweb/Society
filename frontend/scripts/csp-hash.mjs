#!/usr/bin/env node
/* csp-hash.mjs — keep the Content-Security-Policy in sync with the inline
 * theme bootstrap in `index.html`.
 *
 * Why this exists: `index.html` carries a tiny synchronous script that must run
 * before first paint (otherwise dark-mode users see a light flash). The CSP in
 * `public/_headers` locks `script-src` down to 'self', which would block it, so
 * the exact script body is allow-listed by SHA-256 hash instead of relaxing the
 * policy to 'unsafe-inline'.
 *
 * A stale hash fails *silently* in production — the script is blocked, the
 * theme falls back to light, and the only evidence is a console error nobody
 * reads. Hence the check mode, which CI runs after the build.
 *
 * Usage:
 *   node scripts/csp-hash.mjs                      # print the source hashes
 *   node scripts/csp-hash.mjs --check              # fail if public/_headers is out of date
 *   node scripts/csp-hash.mjs --check --index=x.html
 *   node scripts/csp-hash.mjs --write              # rewrite the script-src directive
 *
 * `--check` verifies the SOURCE `index.html` — the tracked file whose hash must
 * appear in `_headers` — and additionally verifies `dist/index.html` whenever a
 * build is present, which catches a bundler rewriting the script body.
 *
 * It deliberately does NOT treat "dist exists but holds no inline script" as a
 * pass. An earlier revision preferred `dist/` and exited 0 with "nothing to
 * hash", which is the very silent failure this script exists to prevent: a
 * stale or partial `dist/` made the guard report success while the served page
 * had lost the bootstrap. That case is now a hard error.
 *
 * Run this AFTER `vite build` so the built output is verified too. */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const sourceIndex = resolve(root, 'index.html');
const builtIndex = resolve(root, 'dist', 'index.html');
const headersPath = resolve(root, 'public', '_headers');

/** Inline = a <script> tag with no `src` attribute. */
const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

function label(file) {
  return relative(root, file) || file;
}

function hashesFor(file) {
  const html = readFileSync(file, 'utf8');
  const hashes = [];
  for (const match of html.matchAll(INLINE_SCRIPT)) {
    const body = match[1] ?? '';
    if (body.trim() === '') continue;
    hashes.push(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  }
  return hashes;
}

const indexOverride = process.argv.find((arg) => arg.startsWith('--index='))?.slice('--index='.length);

if (process.argv.includes('--check')) {
  const targets = indexOverride
    ? [resolve(root, indexOverride)]
    : [sourceIndex, ...(existsSync(builtIndex) ? [builtIndex] : [])];

  const headers = readFileSync(headersPath, 'utf8');
  const scriptSrc = /script-src([^;]*)/.exec(headers)?.[1] ?? '';
  const sourceHasScript = hashesFor(sourceIndex).length > 0;

  const failures = [];
  let verified = 0;

  for (const target of targets) {
    const name = label(target);
    const hashes = hashesFor(target);

    if (hashes.length === 0) {
      if (target === sourceIndex) {
        console.log(`${name}: no inline <script> — no CSP hash required.`);
        continue;
      }
      if (sourceHasScript) {
        failures.push(
          `${name}: contains NO inline <script>, but ${label(sourceIndex)} does.`,
          '  The page served from this build would lose the pre-paint theme bootstrap,',
          '  so dark-mode users would see a light flash on every load.',
          `  This is almost always a stale or partial build directory (${label(resolve(root, 'dist'))}/).`,
          '  Rebuild, then re-run this check:',
          '    npm run build',
        );
        continue;
      }
      console.log(`${name}: no inline <script> — nothing to hash.`);
      continue;
    }

    verified += 1;
    const missing = hashes.filter((hash) => !scriptSrc.includes(hash));

    if (missing.length > 0) {
      failures.push(
        `${name}: CSP is out of date.`,
        `  computed   : ${hashes.join(' ')}`,
        `  in _headers: script-src${scriptSrc.trim() ? ` ${scriptSrc.trim()}` : ' (absent)'}`,
      );
    } else {
      console.log(`CSP script-src matches ${name}.`);
    }
  }

  if (failures.length > 0) {
    console.error(
      [...failures, '', 'The inline theme bootstrap would be blocked in production. Fix the source with:', '  npm run csp:hash'].join('\n'),
    );
    process.exit(1);
  }

  if (verified === 0) {
    console.log('No inline <script> found in any checked file — nothing to hash.');
  } else if (!existsSync(builtIndex)) {
    console.log(`Note: ${label(builtIndex)} not present — checked the source only. Run this after \`npm run build\`.`);
  }
  process.exit(0);
}

if (process.argv.includes('--write')) {
  // Always rewrite from the source file: it is the tracked artifact whose hash
  // `_headers` must agree with. `dist/` is a derived copy.
  const hashes = hashesFor(sourceIndex);
  if (hashes.length === 0) {
    console.error(`No inline <script> found in ${label(sourceIndex)} — nothing to write.`);
    process.exit(1);
  }
  const directive = hashes.join(' ');
  const headers = readFileSync(headersPath, 'utf8');
  const updated = headers.replace(
    /(script-src[^;]*?)(?:\s*'sha256-[^']*')*(;)/,
    `$1 ${directive}$2`,
  );
  if (updated === headers) {
    console.error('Could not locate a `script-src` directive in public/_headers.');
    process.exit(1);
  }
  writeFileSync(headersPath, updated, 'utf8');
  console.log(`Updated script-src in public/_headers -> ${directive}`);
  process.exit(0);
}

const sourceHashes = hashesFor(sourceIndex);
console.log(sourceHashes.length > 0 ? sourceHashes.join(' ') : `No inline <script> found in ${label(sourceIndex)}.`);
