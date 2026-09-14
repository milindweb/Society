/**
 * Utils.js — pure helper functions: IDs, dates, money, hashing, validation, string safety.
 *
 * Rules:
 * - No logic at load time (only the IIFE returns the namespace).
 * - No calls to SpreadsheetApp, DriveApp, CacheService, LockService.
 * - Money: always round2 (half-up, 2 decimals).
 * - IDs: PREFIX-yyyyMMdd-6 uppercase base36 chars, server-generated only.
 * - Formula injection: values starting with = + - @ get a leading apostrophe on write.
 */
var Utils = (function () {
  'use strict';

  var BASE36_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // --------------------------------------------------------------------------- ID generation

  /**
   * Generate a deterministic-length unique ID.
   * Format: PREFIX-yyyyMMdd-XXXXXX (6 uppercase base36 chars).
   * @param {string} prefix e.g. 'FLT', 'MBR', 'PAY'
   * @param {Date}   [date] optional reference date (default: now)
   * @return {string} e.g. 'FLT-20260914-7K2QX9'
   */
  function newId(prefix, date) {
    var d = date || new Date();
    var yyyy = d.getUTCFullYear();
    var mm = pad2(d.getUTCMonth() + 1);
    var dd = pad2(d.getUTCDate());
    var rand = '';
    for (var i = 0; i < 6; i++) {
      rand += BASE36_CHARS.charAt(Math.floor(Math.random() * 36));
    }
    return prefix + '-' + yyyy + mm + dd + '-' + rand;
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  // --------------------------------------------------------------------------- Money / math

  /** Round a number to 2 decimal places using half-up rounding. */
  function round2(value) {
    var n = Number(value);
    if (!isFinite(n)) { return 0; }
    // Use string manipulation to avoid floating-point issues
    var sign = n < 0 ? -1 : 1;
    var abs = Math.abs(n);
    var scaled = abs * 100;
    var rounded = Math.round(scaled + 1e-9); // tiny epsilon to handle .xx5 cases
    return sign * rounded / 100;
  }

  // --------------------------------------------------------------------------- Dates

  /** Current ISO-8601 UTC timestamp string. */
  function now() { return new Date().toISOString(); }

  /** Today as yyyy-MM-dd in UTC. */
  function today() { return formatDate(new Date()); }

  /** Format a Date as yyyy-MM-dd (UTC). */
  function formatDate(d) {
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  /** Parse a yyyy-MM-dd string to a Date (UTC midnight). Returns null for invalid dates. */
  function parseDate(s) {
    if (!s || typeof s !== 'string') { return null; }
    var parts = s.split('-');
    if (parts.length !== 3) { return null; }
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    var day = parseInt(parts[2], 10);
    if (month < 1 || month > 12) { return null; }
    if (day < 1 || day > 31) { return null; }
    var d = new Date(Date.UTC(year, month - 1, day));
    // Validate that the date didn't roll over (e.g. month 13 -> Jan next year)
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
      return null;
    }
    return d;
  }

  /** Format a Date as YYYY-MM (billing period key). */
  function formatPeriod(d) {
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1);
  }

  /** Current billing period key (YYYY-MM). */
  function currentPeriod() { return formatPeriod(new Date()); }

  /**
   * Compute the financial year string (e.g. '2026-27') from a date.
   * FY starts on financialYearStartMonth (default 4 = April).
   * @param {Date}   [date]
   * @param {number} [startMonth] 1-12, default 4
   */
  function financialYear(date, startMonth) {
    var d = date || new Date();
    var sm = startMonth || 4;
    var year = d.getUTCMonth() + 1 >= sm ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
    return year + '-' + String(year + 1).slice(-2);
  }

  // --------------------------------------------------------------------------- JSON

  /** Safe JSON.parse that returns null on failure. */
  function safeJsonParse(s) {
    if (!s || typeof s !== 'string') { return null; }
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  /** Safe JSON.stringify that returns '' on failure. */
  function safeJsonStringify(obj) {
    if (obj === null || obj === undefined) { return ''; }
    try { return JSON.stringify(obj); } catch (e) { return ''; }
  }

  // --------------------------------------------------------------------------- Hashing (SHA-256, iterated)

  /**
   * Generate a random hex string of the given byte length.
   * @param {number} byteCount
   * @return {string} hex string
   */
  function randomHex(byteCount) {
    var arr = [];
    for (var i = 0; i < byteCount; i++) {
      var hex = Math.floor(Math.random() * 256).toString(16);
      arr.push(hex.length === 1 ? '0' + hex : hex);
    }
    return arr.join('');
  }

  /**
   * SHA-256 hash a string (hex output). Uses GAS Utilities digest.
   * @param {string} input
   * @return {string} hex hash
   */
  function sha256(input) {
    var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input);
    return raw.map(function (b) { return pad2(((b & 0xff) + 256) % 256).toString(16); }).join('');
  }

  /**
   * Iterated SHA-256 password hash.
   * @param {string} password
   * @param {string} [salt] hex salt (default: 16 random bytes)
   * @param {number} [iterations] default from CONFIG
   * @return {{ hash: string, salt: string, algo: string }}
   */
  function hashPassword(password, salt, iterations) {
    var s = salt || randomHex(16);
    var n = iterations || (typeof CONFIG !== 'undefined' ? CONFIG.num('PASSWORD_ITERATIONS') : 10000);
    var input = s + password;
    var digest = input;
    for (var i = 0; i < n; i++) {
      digest = sha256(digest);
    }
    return { hash: digest, salt: s, algo: 'SHA256-ITER-' + n };
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   * @param {string} a
   * @param {string} b
   * @return {boolean}
   */
  function constantTimeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') { return false; }
    if (a.length !== b.length) { return false; }
    var diff = 0;
    for (var i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }

  // --------------------------------------------------------------------------- Validation

  /** Validate an entity ID format: PREFIX-yyyyMMdd-XXXXXX (3-5 uppercase prefix). */
  function isId(value) {
    return /^[A-Z]{3,5}-\d{8}-[A-Z0-9]{6}$/.test(value);
  }

  /** Basic email validation (lowercased, trimmed externally). */
  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  /** Phone/mobile: 10-15 digits, optional leading +. */
  function isPhone(value) {
    return /^\+?\d{10,15}$/.test(value);
  }

  /** yyyy-MM-dd date format. */
  function isDateFormat(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) { return false; }
    var d = parseDate(value);
    return d !== null;
  }

  /** YYYY-MM period format with valid month. */
  function isPeriodFormat(value) {
    if (!/^\d{4}-\d{2}$/.test(value)) { return false; }
    var month = parseInt(value.split('-')[1], 10);
    return month >= 1 && month <= 12;
  }

  /** Finite number >= 0 with at most 2 decimals. */
  function isMoney(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) { return false; }
    var s = String(n);
    var dot = s.indexOf('.');
    if (dot === -1) { return true; }
    return s.length - dot - 1 <= 2;
  }

  /** Integer >= 0. */
  function isNonNegInt(value) {
    var n = Number(value);
    return isFinite(n) && n >= 0 && Math.floor(n) === n;
  }

  /** Percent 0-100. */
  function isPercent(value) {
    var n = Number(value);
    return isFinite(n) && n >= 0 && n <= 100;
  }

  // --------------------------------------------------------------------------- String safety

  /** Trim, strip control characters, and bound length. */
  function cleanString(value, maxLen) {
    if (value === null || value === undefined) { return ''; }
    var s = String(value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
    if (maxLen && s.length > maxLen) { s = s.substring(0, maxLen); }
    return s;
  }

  /** Lowercase and trim. */
  function normaliseEmail(value) {
    return cleanString(value).toLowerCase();
  }

  /**
   * Escape formula injection: values starting with = + - @ get a leading apostrophe.
   * @param {string} value
   * @return {string}
   */
  function escapeFormula(value) {
    if (value === null || value === undefined) { return ''; }
    var s = String(value);
    if (/^[=+\-@]/.test(s)) {
      return "'" + s;
    }
    return s;
  }

  /** Coerce a value to a boolean (sheet stores TRUE/FALSE strings). */
  function toBoolean(value) {
    if (typeof value === 'boolean') { return value; }
    var s = String(value).toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }

  /** Coerce to number, returning fallback if not finite. */
  function toNumber(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : (fallback || 0);
  }

  /** CSV string to array (trimmed, non-empty). */
  function csvToArray(value) {
    if (!value || typeof value !== 'string') { return []; }
    return value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /** Array to CSV string. */
  function arrayToCsv(arr) {
    if (!Array.isArray(arr)) { return ''; }
    return arr.filter(Boolean).join(',');
  }

  // --------------------------------------------------------------------------- Expose

  return {
    newId: newId,
    round2: round2,
    now: now,
    today: today,
    formatDate: formatDate,
    parseDate: parseDate,
    formatPeriod: formatPeriod,
    currentPeriod: currentPeriod,
    financialYear: financialYear,
    safeJsonParse: safeJsonParse,
    safeJsonStringify: safeJsonStringify,
    randomHex: randomHex,
    sha256: sha256,
    hashPassword: hashPassword,
    constantTimeEqual: constantTimeEqual,
    isId: isId,
    isEmail: isEmail,
    isPhone: isPhone,
    isDateFormat: isDateFormat,
    isPeriodFormat: isPeriodFormat,
    isMoney: isMoney,
    isNonNegInt: isNonNegInt,
    isPercent: isPercent,
    cleanString: cleanString,
    normaliseEmail: normaliseEmail,
    escapeFormula: escapeFormula,
    toBoolean: toBoolean,
    toNumber: toNumber,
    csvToArray: csvToArray,
    arrayToCsv: arrayToCsv
  };
})();
