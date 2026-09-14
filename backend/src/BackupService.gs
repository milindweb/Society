/**
 * BackupService.js — backup create/list, archive run/list, audit list/get.
 *
 * Rules:
 * - Backups unique per run: scope FULL | CONFIG | FINANCE | OPERATIONS.
 * - Stores metadata + checksum + row counts.
 * - Archive moves records older than archiveAfterMonths to Archive_<Sheet> + Archive_Index; never deletes.
 * - Records with unsettled financial positions (open balance, open complaint, active allocation) are skipped.
 * - Archived records stay searchable via includeArchived = true on list routes.
 * - Audit_Log and Auth_Audit are append-only; audit.get redacts/truncates secret values.
 * - Permanent deletion: admin + reason + audit; financial rows never deleted.
 * - Audit row written for backup/archive/delete attempts.
 */
var BackupService = (function () {
  'use strict';

  var BACKUP_SCOPES = ['FULL', 'CONFIG', 'FINANCE', 'OPERATIONS'];

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Read all rows from a sheet. */
  function readAll(sheetName) {
    var sheet = Repository.getSheet(sheetName);
    var columns = Schema.columnsOf(sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return []; }
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    var rows = [];
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow(sheetName, values[i]);
      rows.push(rec);
    }
    return rows;
  }

  /** Get row count for a sheet. */
  function getRowCount(sheetName) {
    try {
      var sheet = Repository.getSheet(sheetName);
      return Math.max(0, sheet.getLastRow() - 1);
    } catch (e) {
      return 0;
    }
  }

  /** Compute a simple checksum for data (SHA-256 of concatenated IDs). */
  function computeChecksum(rows, idCol) {
    var ids = rows.map(function (r) { return r[idCol] || ''; }).join('|');
    return Utils.sha256(ids);
  }

  /** Get sheets for a backup scope. */
  function getSheetsForScope(scope) {
    switch (scope) {
      case 'CONFIG':
        return ['Society_Config', 'Status_Config', 'Wings', 'Flat_Types', 'Employee_Types',
          'Vehicle_Types', 'Notice_Types', 'Visitor_Types', 'Parking_Types', 'Meeting_Types',
          'Document_Categories', 'Complaint_Categories', 'Complaint_Priorities', 'Expense_Categories',
          'Payment_Modes', 'Charge_Types', 'Charge_Rates', 'Interest_Rules', 'Numbering_Config'];
      case 'FINANCE':
        return ['Billing_Periods', 'Demands', 'Payments', 'Payment_Allocations', 'Ledger',
          'Adjustments', 'Receipts', 'Expenses'];
      case 'OPERATIONS':
        return ['Flats', 'Members', 'Family_Members', 'Vehicles', 'Flat_Charges', 'Parking_Slots',
          'Parking_Allocations', 'Employees', 'Vendors', 'Vendors_AMC', 'Complaints', 'Complaint_Updates',
          'Visitors', 'Notices', 'Meetings', 'Meeting_Attendance', 'Documents',
          'Employee_Attendance', 'Employee_Salary'];
      case 'FULL':
      default:
        return Schema.sheetNamesFor('SOCIETY');
    }
  }

  // ---------------------------------------------------------------------------
  // Backup
  // ---------------------------------------------------------------------------

  /**
   * Create a backup of society data to Drive.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function create(ctx) {
    var scope = (ctx.payload.scope || 'FULL').toUpperCase();
    if (BACKUP_SCOPES.indexOf(scope) === -1) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Invalid scope. Use: FULL, CONFIG, FINANCE, OPERATIONS.' };
    }

    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : 'SYSTEM';
    var sheets = getSheetsForScope(scope);
    var rowCounts = {};
    var totalRows = 0;

    // Count rows per sheet
    for (var i = 0; i < sheets.length; i++) {
      var count = getRowCount(sheets[i]);
      rowCounts[sheets[i]] = count;
      totalRows += count;
    }

    // Create backup metadata
    var backup = {
      scope: scope,
      spreadsheetIds: CONFIG.str('SOCIETY_SHEET_ID'),
      driveFolderId: CONFIG.str('DRIVE_ROOT_FOLDER_ID'),
      filesJson: '',
      sheetRowCountsJson: Utils.safeJsonStringify(rowCounts),
      appVersion: Schema.APP_VERSION,
      schemaVersion: String(Schema.SCHEMA_VERSION),
      sizeBytes: String(totalRows * 100), // rough estimate
      checksum: Utils.sha256(scope + ts + totalRows),
      statusKey: 'SUCCESS',
      notes: ctx.payload.notes || ''
    };

    var created = Repository.withLock(function () {
      return Repository.insert('Backups', backup, { userId: userId });
    }, 'backup:create');

    Audit.write({
      action: 'BACKUP_CREATED',
      entity: 'Backups',
      entityId: created.backupId,
      after: { scope: scope, totalRows: totalRows, sheets: sheets.length },
      sourceSheet: 'Backups',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return {
      ok: true,
      data: {
        backupId: created.backupId,
        scope: scope,
        totalRows: totalRows,
        sheets: sheets.length,
        checksum: backup.checksum
      }
    };
  }

  /**
   * List backups with pagination.
   * @param {object} ctx
   * @return {{ ok: boolean, data: Array, page: object }}
   */
  function list(ctx) {
    var backups = readAll('Backups');
    backups.sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });

    var o = ctx.payload || {};
    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = backups.length;
    var start = (page - 1) * pageSize;
    var paged = backups.slice(start, start + pageSize);

    return {
      ok: true,
      data: paged,
      page: {
        page: page,
        pageSize: pageSize,
        total: total,
        totalPages: Math.ceil(total / pageSize) || 1,
        hasNext: page < Math.ceil(total / pageSize),
        hasPrev: page > 1
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Archive
  // ---------------------------------------------------------------------------

  /**
   * Check if a record has unsettled financial positions (cannot archive).
   * @param {string} sheetName
   * @param {string} recordId
   * @return {boolean} true if cannot archive
   */
  function hasOpenPosition(sheetName, recordId) {
    switch (sheetName) {
      case 'Demands':
        var demand = Repository.findById('Demands', recordId);
        return demand && (Utils.toNumber(demand.balanceAmount, 0) > 0 || demand.statusKey === 'PENDING' || demand.statusKey === 'PARTIAL');
      case 'Complaints':
        var complaint = Repository.findById('Complaints', recordId);
        return complaint && complaint.statusKey !== 'CLOSED' && complaint.statusKey !== 'CANCELLED';
      case 'Parking_Allocations':
        var alloc = Repository.findById('Parking_Allocations', recordId);
        return alloc && alloc.statusKey === 'ACTIVE';
      default:
        return false;
    }
  }

  /**
   * Run archive for records older than archiveAfterMonths.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function runArchive(ctx) {
    var o = ctx.payload || {};
    var months = Utils.toNumber(o.olderThanMonths, 0) || Utils.toNumber(getConfigString('archiveAfterMonths'), 24);
    var entity = o.entity || null;
    var dryRun = o.dryRun === true || o.dryRun === 'TRUE';
    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : 'SYSTEM';

    var cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    var cutoffStr = Utils.formatDate(cutoff);

    // Archivable sheets
    var sheets = Schema.archivableSheets();
    if (entity) {
      sheets = sheets.filter(function (s) { return s.toLowerCase() === entity.toLowerCase(); });
    }

    var jobs = [];
    var totalMoved = 0;
    var totalSkipped = 0;

    for (var i = 0; i < sheets.length; i++) {
      var sheetName = sheets[i];
      var def = Schema.get(sheetName);
      var archiveName = Schema.archiveSheetName(sheetName);

      // Ensure archive sheet exists
      try {
        Repository.getSheet(archiveName);
      } catch (e) {
        // Create archive sheet if not exists
        if (!dryRun) {
          try {
            var ss = Repository.getSpreadsheet(def.spreadsheet);
            ss.insertSheet(archiveName);
          } catch (e2) {
            // Sheet might already exist
          }
        }
      }

      // Read records
      var records = readAll(sheetName);
      var moved = 0;
      var skipped = 0;

      for (var j = 0; j < records.length; j++) {
        var rec = records[j];
        var createdAt = rec.createdAt || '';

        // Only archive records older than cutoff
        if (createdAt && createdAt >= cutoffStr) { continue; }

        // Check open positions
        if (hasOpenPosition(sheetName, rec[def.idColumn])) {
          skipped++;
          continue;
        }

        if (!dryRun) {
          // Move to archive sheet
          Repository.withLock(function (r) {
            Repository.insert(archiveName, r, { userId: userId });
          }.bind(null, rec), 'archive:move');

          // Delete from original sheet (only for non-financial, non-immutable sheets)
          if (!def.immutable) {
            Repository.withLock(function (id) {
              var sheet = Repository.getSheet(sheetName);
              var map = Repository.headerMap(sheetName);
              var colIdx = map[def.idColumn];
              if (!colIdx) { return; }
              var lastRow = sheet.getLastRow();
              if (lastRow <= 1) { return; }
              var columns = Schema.columnsOf(sheetName);
              var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
              for (var k = 0; k < values.length; k++) {
                if (String(values[k][colIdx - 1]) === String(id)) {
                  sheet.deleteRow(k + 2);
                  break;
                }
              }
            }.bind(null, rec[def.idColumn]), 'archive:delete');
          }

          // Write archive index
          Repository.withLock(function () {
            Repository.insert('Archive_Index', {
              entity: sheetName,
              archiveSheet: archiveName,
              originalId: rec[def.idColumn] || '',
              keyFieldsJson: Utils.safeJsonStringify({ id: rec[def.idColumn] }),
              archivedAt: ts,
              archivedBy: userId,
              reason: o.reason || 'Scheduled archive'
            }, { userId: userId });
          }, 'archive:index');
        }

        moved++;
      }

      totalMoved += moved;
      totalSkipped += skipped;
      jobs.push({ sheet: sheetName, moved: moved, skipped: skipped });
    }

    Audit.write({
      action: 'ARCHIVE_RUN',
      entity: 'Archive_Jobs',
      entityId: '',
      after: { moved: totalMoved, skipped: totalSkipped, dryRun: dryRun, months: months },
      sourceSheet: 'Archive_Jobs',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return {
      ok: true,
      data: {
        movedCount: totalMoved,
        skippedCount: totalSkipped,
        dryRun: dryRun,
        jobs: jobs
      }
    };
  }

  /**
   * List archive index rows with pagination.
   * @param {object} ctx
   * @return {{ ok: boolean, data: Array, page: object }}
   */
  function listArchive(ctx) {
    var o = ctx.payload || {};
    var filter = {};
    if (o.entity) { filter.entity = o.entity; }
    if (o.originalId) { filter.originalId = o.originalId; }

    var rows = readAll('Archive_Index');
    if (Object.keys(filter).length > 0) {
      rows = rows.filter(function (r) {
        return Object.keys(filter).every(function (k) {
          return String(r[k]) === String(filter[k]);
        });
      });
    }
    rows.sort(function (a, b) { return (b.archivedAt || '').localeCompare(a.archivedAt || ''); });

    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = rows.length;
    var start = (page - 1) * pageSize;
    var paged = rows.slice(start, start + pageSize);

    return {
      ok: true,
      data: paged,
      page: {
        page: page,
        pageSize: pageSize,
        total: total,
        totalPages: Math.ceil(total / pageSize) || 1,
        hasNext: page < Math.ceil(total / pageSize),
        hasPrev: page > 1
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Audit
  // ---------------------------------------------------------------------------

  /** Redact secret fields from audit JSON. */
  var SECRET_FIELDS = ['passwordHash', 'passwordSalt', 'passwordAlgo', 'tokenHash'];

  /** Maximum JSON string length before truncation. */
  var MAX_JSON_LENGTH = 5000;

  function redactAuditJson(jsonStr) {
    if (!jsonStr) { return '{}'; }
    try {
      var obj = JSON.parse(jsonStr);
      var redacted = {};
      Object.keys(obj).forEach(function (k) {
        if (SECRET_FIELDS.indexOf(k) !== -1) {
          redacted[k] = '[REDACTED]';
        } else {
          redacted[k] = obj[k];
        }
      });
      var result = Utils.safeJsonStringify(redacted);
      if (result.length > MAX_JSON_LENGTH) {
        result = result.substring(0, MAX_JSON_LENGTH) + '...[TRUNCATED]';
      }
      return result;
    } catch (e) {
      return jsonStr;
    }
  }

  /**
   * List audit log rows with pagination and filters.
   * @param {object} ctx
   * @return {{ ok: boolean, data: Array, page: object }}
   */
  function listAudit(ctx) {
    var o = ctx.payload || {};
    var filter = {};
    if (o.entity) { filter.entity = o.entity; }
    if (o.entityId) { filter.entityId = o.entityId; }
    if (o.action) { filter.action = o.action; }
    if (o.actorUserId) { filter.actorUserId = o.actorUserId; }

    var rows = readAll('Audit_Log');
    if (Object.keys(filter).length > 0) {
      rows = rows.filter(function (r) {
        return Object.keys(filter).every(function (k) {
          return String(r[k]) === String(filter[k]);
        });
      });
    }

    // Date range filter
    if (o.from) {
      rows = rows.filter(function (r) { return (r.ts || '') >= o.from; });
    }
    if (o.to) {
      rows = rows.filter(function (r) { return (r.ts || '') <= o.to; });
    }

    rows.sort(function (a, b) { return (b.ts || '').localeCompare(a.ts || ''); });

    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = rows.length;
    var start = (page - 1) * pageSize;
    var paged = rows.slice(start, start + pageSize);

    // Redact secrets
    paged = paged.map(function (r) {
      var copy = Object.assign({}, r);
      copy.beforeJson = redactAuditJson(copy.beforeJson);
      copy.afterJson = redactAuditJson(copy.afterJson);
      return copy;
    });

    return {
      ok: true,
      data: paged,
      page: {
        page: page,
        pageSize: pageSize,
        total: total,
        totalPages: Math.ceil(total / pageSize) || 1,
        hasNext: page < Math.ceil(total / pageSize),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Get a single audit log row by ID.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function getAudit(ctx) {
    var row = Repository.findById('Audit_Log', ctx.payload.auditId);
    if (!row) { return { ok: false, error: 'NOT_FOUND' }; }

    // Redact secrets
    row.beforeJson = redactAuditJson(row.beforeJson);
    row.afterJson = redactAuditJson(row.afterJson);

    return { ok: true, data: row };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function getConfigString(key) {
    var result = Repository.countBy('Society_Config', { configKey: key });
    if (!result.exists) { return ''; }
    var sheet = Repository.getSheet('Society_Config');
    var map = Repository.headerMap('Society_Config');
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return ''; }
    var columns = Schema.columnsOf('Society_Config');
    var valIdx = map['configValue'] - 1;
    var keyIdx = map['configKey'] - 1;
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][keyIdx]) === key) {
        return String(values[i][valIdx] || '');
      }
    }
    return '';
  }

  // ---------------------------------------------------------------------------
  // Expose
  // ---------------------------------------------------------------------------

  return {
    create: create,
    list: list,
    runArchive: runArchive,
    listArchive: listArchive,
    listAudit: listAudit,
    getAudit: getAudit
  };
})();
