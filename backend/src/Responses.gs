/**
 * Responses.js — API response envelope builders and error codes.
 *
 * Matches api-contract.md §2 exactly:
 *   ok=true  -> { ok:true,  data, meta:{ requestId, ts, schemaVersion, appVersion, duplicate, page } }
 *   ok=false -> { ok:false, error:{ code, message, details[] }, meta:{ requestId, ts, schemaVersion, appVersion } }
 *
 * Rules:
 * - data only when ok=true; error only when ok=false.
 * - meta.page present on every paginated response.
 * - secrets never leak via error messages or details.
 */
var Responses = (function () {
  'use strict';

  /** Stable error codes consumed by the frontend (api-contract.md §4). */
  var ERROR_CODES = {
    BAD_REQUEST:              'BAD_REQUEST',
    UNKNOWN_ACTION:           'UNKNOWN_ACTION',
    METHOD_NOT_ALLOWED:       'METHOD_NOT_ALLOWED',
    SCHEMA_OUT_OF_DATE:       'SCHEMA_OUT_OF_DATE',
    UNAUTHENTICATED:          'UNAUTHENTICATED',
    TOKEN_EXPIRED:            'TOKEN_EXPIRED',
    TOKEN_REVOKED:            'TOKEN_REVOKED',
    PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
    ACCOUNT_LOCKED:           'ACCOUNT_LOCKED',
    FORBIDDEN:                'FORBIDDEN',
    VALIDATION_ERROR:         'VALIDATION_ERROR',
    NOT_FOUND:                'NOT_FOUND',
    CONFLICT_ERROR:           'CONFLICT_ERROR',
    DEPENDENCY_EXISTS:        'DEPENDENCY_EXISTS',
    DUPLICATE_REQUEST:        'DUPLICATE_REQUEST',
    RATE_LIMITED:             'RATE_LIMITED',
    QUOTA_EXCEEDED:           'QUOTA_EXCEEDED',
    NOT_CONFIGURED:           'NOT_CONFIGURED',
    INTERNAL_ERROR:           'INTERNAL_ERROR'
  };

  /** Friendly default messages per code. */
  var MESSAGES = {
    BAD_REQUEST:              'The request is malformed or missing required fields.',
    UNKNOWN_ACTION:           'Unknown API action.',
    METHOD_NOT_ALLOWED:       'This HTTP method is not allowed.',
    SCHEMA_OUT_OF_DATE:       'The backend schema is out of date. Please run Setup.',
    UNAUTHENTICATED:          'Authentication required.',
    TOKEN_EXPIRED:            'Your session has expired. Please log in again.',
    TOKEN_REVOKED:            'Your session has been revoked.',
    PASSWORD_CHANGE_REQUIRED: 'You must change your password before continuing.',
    ACCOUNT_LOCKED:           'Account is temporarily locked due to failed attempts.',
    FORBIDDEN:                'You do not have permission to perform this action.',
    VALIDATION_ERROR:         'One or more fields are invalid.',
    NOT_FOUND:                'The requested record was not found.',
    CONFLICT_ERROR:           'A concurrent change was detected. Please try again.',
    DEPENDENCY_EXISTS:        'This record has active dependants and cannot be modified.',
    DUPLICATE_REQUEST:        'This request was already processed.',
    RATE_LIMITED:             'Too many requests. Please wait and try again.',
    QUOTA_EXCEEDED:           'Google API quota exceeded. Please try later.',
    NOT_CONFIGURED:           'Society setup is incomplete.',
    INTERNAL_ERROR:           'An unexpected server error occurred.'
  };

  /**
   * Build a success envelope.
   * @param {object}  data      response payload
   * @param {object}  [meta]    additional meta (requestId, page, duplicate, etc.)
   * @return {{ ok:true, data, meta }}
   */
  function ok(data, meta) {
    var base = {
      requestId: (meta && meta.requestId) || Utils.newId('REQ'),
      ts: Utils.now(),
      schemaVersion: typeof Schema !== 'undefined' ? Schema.SCHEMA_VERSION : 0,
      appVersion: typeof Schema !== 'undefined' ? Schema.APP_VERSION : '',
      duplicate: !!(meta && meta.duplicate)
    };
    if (meta && meta.page) { base.page = meta.page; }
    if (meta) {
      Object.keys(meta).forEach(function (k) {
        if (!(k in base) && k !== 'requestId') { base[k] = meta[k]; }
      });
    }
    return { ok: true, data: data, meta: base };
  }

  /**
   * Build an error envelope.
   * @param {string}  code     one of ERROR_CODES
   * @param {string}  [message] human-readable message (default from MESSAGES)
   * @param {Array}   [details] field-level errors [{ field, message }]
   * @param {object}  [meta]   additional meta (requestId)
   * @return {{ ok:false, error, meta }}
   */
  function fail(code, message, details, meta) {
    var err = {
      code: code,
      message: message || MESSAGES[code] || 'An error occurred.',
      details: details || []
    };
    var base = {
      requestId: (meta && meta.requestId) || Utils.newId('REQ'),
      ts: Utils.now(),
      schemaVersion: typeof Schema !== 'undefined' ? Schema.SCHEMA_VERSION : 0,
      appVersion: typeof Schema !== 'undefined' ? Schema.APP_VERSION : ''
    };
    return { ok: false, error: err, meta: base };
  }

  return {
    ERROR_CODES: ERROR_CODES,
    ok: ok,
    fail: fail
  };
})();
