/**
 * Config.js — environment properties, defaults, limits and cache-key helpers.
 *
 * Rules (structure.md section 5): no logic at load time; nothing here touches Sheets/Drive.
 * Every value is read lazily so the file is safe to concatenate in any order.
 */
var CONFIG = (function () {
  'use strict';

  /** Keys expected in Script Properties, with safe non-secret defaults. */
  var DEFAULTS = {
    SOCIETY_SHEET_ID: '',
    AUTH_SHEET_ID: '',
    DRIVE_ROOT_FOLDER_ID: '',
    TOKEN_TTL_MINUTES: 720,
    SESSION_IDLE_MINUTES: 60,
    LOGIN_MAX_ATTEMPTS: 5,
    LOGIN_LOCK_MINUTES: 15,
    CACHE_TTL_SECONDS: 300,
    PASSWORD_ITERATIONS: 10000,
    MAX_PAGE_SIZE: 100,
    REPORT_CHUNK_SIZE: 5000,
    LOCK_TIMEOUT_MS: 10000,
    LOCK_RETRIES: 3,
    ENVIRONMENT: 'DEV',
    ALLOWED_ORIGINS: ''
  };

  /** Cache key namespaces — always prefixed so a group can be invalidated wholesale. */
  var CACHE_KEYS = {
    HEADER_MAP: 'hdr:',
    SOCIETY_CONFIG: 'cfg:society',
    STATUS_CONFIG: 'cfg:status',
    ENUMS: 'cfg:enums',
    PERMISSIONS: 'rbac:permissions:',
    SESSION: 'auth:sess:',
    RATE_LIMIT: 'rl:',
    DASHBOARD: 'dash:'
  };

  /** Field-length limits enforced server-side (security-architecture.md section 5). */
  var LIMITS = {
    NAME: 120,
    TITLE: 200,
    CODE: 40,
    DESCRIPTION: 5000,
    REMARKS: 2000,
    REASON: 500,
    URL: 2000,
    JSON_CELL: 45000,
    SEARCH: 120
  };

  var _override = null;

  function props() {
    if (_override) { return _override; }
    return PropertiesService.getScriptProperties();
  }

  /** Test/deployment hook: inject an in-memory property bag. */
  function setPropertyBag(bag) {
    _override = {
      getProperty: function (key) { return bag.hasOwnProperty(key) ? bag[key] : null; },
      getProperties: function () { return Object.assign({}, bag); }
    };
  }

  function raw(key) {
    var value = props().getProperty(key);
    if (value === null || value === undefined || value === '') {
      return DEFAULTS.hasOwnProperty(key) ? DEFAULTS[key] : '';
    }
    return value;
  }

  function str(key) { return String(raw(key)); }

  function num(key) {
    var n = Number(raw(key));
    return isFinite(n) ? n : Number(DEFAULTS[key] || 0);
  }

  function bool(key) {
    var v = String(raw(key)).toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }

  function require_(key) {
    var value = str(key);
    if (!value) {
      throw new Error('Missing required Script Property: ' + key);
    }
    return value;
  }

  /** Spreadsheet id for a logical spreadsheet name: 'SOCIETY' | 'AUTH'. */
  function sheetId(logicalName) {
    if (logicalName === 'AUTH') { return require_('AUTH_SHEET_ID'); }
    return require_('SOCIETY_SHEET_ID');
  }

  function isProd() { return str('ENVIRONMENT').toUpperCase() === 'PROD'; }

  function cacheTtl() { return num('CACHE_TTL_SECONDS'); }

  function pageSizeDefaultValue() { return 25; }

  function maxPageSize() { return num('MAX_PAGE_SIZE'); }

  function allowedOrigins() {
    return str('ALLOWED_ORIGINS').split(',').map(function (s) { return s.trim(); })
      .filter(function (s) { return !!s; });
  }

  return {
    DEFAULTS: DEFAULTS,
    CACHE_KEYS: CACHE_KEYS,
    LIMITS: LIMITS,
    setPropertyBag: setPropertyBag,
    str: str,
    num: num,
    bool: bool,
    requireProperty: require_,
    sheetId: sheetId,
    isProd: isProd,
    cacheTtl: cacheTtl,
    pageSizeDefault: pageSizeDefaultValue,
    maxPageSize: maxPageSize,
    allowedOrigins: allowedOrigins
  };
})();