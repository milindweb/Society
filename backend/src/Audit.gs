/**
 * Audit.js — append-only audit trail writer.
 *
 * Writes to both Audit_Log (Society) and Auth_Audit (Auth) sheets.
 * This is the ONLY place that writes audit rows (besides direct Sheet.appendRow in Repository).
 *
 * Rules (security-architecture.md §7):
 * - actor, timestamp, action, entity, before/after, reason always captured.
 * - beforeJson/afterJson are redacted for secret fields (passwordHash, passwordSalt, tokenHash).
 * - Truncated fields get an explicit truncated:true marker.
 * - Audit rows are append-only; never edited or deleted.
 * - Financial mutations produce exactly one audit row with before/after.
 */
var Audit = (function () {
  'use strict';

  /** Fields that must never appear in audit JSON (security-architecture.md §7). */
  var SECRET_FIELDS = [
    'passwordHash', 'passwordSalt', 'passwordAlgo', 'tokenHash',
    'password', 'newPassword', 'currentPassword', 'temporaryPassword'
  ];

  /** Maximum JSON string length before truncation. */
  var MAX_JSON_LENGTH = 5000;

  /**
   * Redact secret fields from a record before serialising.
   * @param {object|null} record
   * @return {{ json: string, truncated: boolean, redacted: string[] }}
   */
  function safeJson(record) {
    if (!record) { return { json: '{}', truncated: false, redacted: [] }; }
    var copy = {};
    var redacted = [];
    Object.keys(record).forEach(function (k) {
      if (SECRET_FIELDS.indexOf(k) !== -1) {
        copy[k] = '[REDACTED]';
        redacted.push(k);
      } else {
        copy[k] = record[k];
      }
    });
    var json = Utils.safeJsonStringify(copy);
    var truncated = false;
    if (json.length > MAX_JSON_LENGTH) {
      json = json.substring(0, MAX_JSON_LENGTH) + '...[TRUNCATED]';
      truncated = true;
    }
    return { json: json, truncated: truncated, redacted: redacted };
  }

  /**
   * Compute changed fields between before and after records.
   * @param {object|null} before
   * @param {object|null} after
   * @return {string} CSV of changed field names
   */
  function changedFields(before, after) {
    if (!before || !after) { return ''; }
    var changed = [];
    var keys = Object.keys(after);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (SECRET_FIELDS.indexOf(k) !== -1) { continue; }
      if (String(before[k]) !== String(after[k])) { changed.push(k); }
    }
    return changed.join(',');
  }

  /**
   * Write an audit row to Audit_Log (Society spreadsheet).
   *
   * @param {object} opts
   * @param {string} opts.action        e.g. 'PAYMENT_RECORDED', 'MEMBER_CREATED'
   * @param {string} opts.entity        e.g. 'Payments', 'Members'
   * @param {string} opts.entityId      the record's ID
   * @param {string} [opts.entityLabel] human-readable label
   * @param {object} [opts.before]      record state before the change
   * @param {object} [opts.after]       record state after the change
   * @param {string} [opts.reason]      mandatory for waivers, cancellations, deletions
   * @param {string} [opts.sourceSheet] sheet the change targeted
   * @param {string} [opts.requestId]   request correlation ID
   * @param {string} [opts.result]      'SUCCESS' | 'FAILED'
   * @param {object} [opts.actor]       { userId, name, roleKeys }
   */
  function write(opts) {
    if (!opts || !opts.action || !opts.entity) { return; }

    var ts = Utils.now();
    var before = safeJson(opts.before || null);
    var after = safeJson(opts.after || null);

    var record = {
      auditId: Utils.newId('AUD'),
      ts: ts,
      actorUserId: opts.actor && opts.actor.userId ? opts.actor.userId : '',
      actorName: opts.actor && opts.actor.name ? opts.actor.name : '',
      actorRoleKeys: opts.actor && opts.actor.roleKeys ? Utils.arrayToCsv(opts.actor.roleKeys) : '',
      action: opts.action,
      entity: opts.entity,
      entityId: opts.entityId || '',
      entityLabel: opts.entityLabel || '',
      beforeJson: before.json,
      afterJson: after.json,
      changedFields: changedFields(opts.before, opts.after),
      reason: opts.reason || '',
      sourceSheet: opts.sourceSheet || '',
      ipHash: '',
      requestId: opts.requestId || '',
      result: opts.result || 'SUCCESS'
    };

    Repository.withLock(function () {
      Repository.insert('Audit_Log', record, { userId: record.actorUserId });
    }, 'audit:' + opts.action);
  }

  /**
   * Write an auth-specific audit row to Auth_Audit (Auth spreadsheet).
   * Used for login, logout, password changes, user/role/permission changes.
   *
   * @param {object} opts
   * @param {string} opts.action     e.g. 'LOGIN_SUCCESS', 'PASSWORD_CHANGED'
   * @param {string} opts.entity     e.g. 'Users', 'Sessions'
   * @param {string} [opts.entityId]
   * @param {object} [opts.detail]   arbitrary detail object
   * @param {string} [opts.result]   'SUCCESS' | 'FAILED'
   * @param {string} [opts.actorUserId]
   * @param {string} [opts.ipHash]
   */
  function writeAuth(opts) {
    if (!opts || !opts.action) { return; }

    var ts = Utils.now();
    var record = {
      authAuditId: Utils.newId('AAU'),
      ts: ts,
      actorUserId: opts.actorUserId || '',
      action: opts.action,
      entity: opts.entity || '',
      entityId: opts.entityId || '',
      detailJson: opts.detail ? Utils.safeJsonStringify(opts.detail) : '{}',
      result: opts.result || 'SUCCESS',
      ipHash: opts.ipHash || '',
      createdAt: ts
    };

    Repository.insert('Auth_Audit', record, { userId: record.actorUserId });
  }

  return {
    write: write,
    writeAuth: writeAuth,
    safeJson: safeJson,
    changedFields: changedFields
  };
})();
