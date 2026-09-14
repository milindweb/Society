/**
 * Setup.js — install triggers, scheduled handlers (session prune, visitor auto-exit, backup, archive),
 * sheet creation from Schema.js, and society seed data.
 *
 * Rules:
 * - install() creates all AUTH + SOCIETY sheets from Schema.js, seeds config placeholders.
 * - migrate() adds missing sheets/columns without touching existing data.
 * - seedAdminUser() creates exactly one ADMIN user with hashed password.
 * - Triggers: daily (session prune + visitor auto-exit), weekly (backup), monthly (archive evaluator).
 * - Each trigger handler is short and bounded (GAS simple-trigger time limit).
 * - Seeds zero operational data (no flats, members, demands, payments).
 */
var Setup = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Sheet creation
  // ---------------------------------------------------------------------------

  function getOrCreateSpreadsheet(logicalName) {
    var id = CONFIG.sheetId(logicalName);
    if (id) {
      try {
        return SpreadsheetApp.openById(id);
      } catch (e) {
        // Spreadsheet not found, create a new one
      }
    }
    var ss = SpreadsheetApp.create(logicalName + ' Spreadsheet');
    PropertiesService.getScriptProperties().setProperty(logicalName + '_SHEET_ID', ss.getId());
    return ss;
  }

  function getOrCreateSheet(ss, sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (sheet) { return sheet; }
    sheet = ss.insertSheet(sheetName);
    return sheet;
  }

  function writeHeaders(sheet, sheetName) {
    var columns = Schema.columnsOf(sheetName);
    var existing = sheet.getRange(1, 1, 1, Math.max(columns.length, 1)).getValues()[0];
    if (existing[0] === '' || existing.length !== columns.length) {
      sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    }
  }

  // ---------------------------------------------------------------------------
  // Seed data
  // ---------------------------------------------------------------------------

  function seedStatusConfig(ss) {
    var sheet = getOrCreateSheet(ss, 'Status_Config');
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) { return 0; }

    var families = {
      ENTITY: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
      FLAT: ['OCCUPIED', 'VACANT', 'UNDER_MAINTENANCE', 'BLOCKED'],
      BILLING: ['OPEN', 'GENERATED', 'LOCKED', 'CLOSED'],
      DEMAND: ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'],
      PAYMENT: ['POSTED', 'CANCELLED', 'REVERSED'],
      COMPLAINT: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'],
      VISITOR: ['INSIDE', 'EXITED', 'OVERSTAY'],
      NOTICE: ['DRAFT', 'PUBLISHED', 'EXPIRED'],
      MEETING: ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'POSTPONED'],
      DOCUMENT: ['ACTIVE', 'ARCHIVED', 'EXPIRED'],
      PARKING: ['AVAILABLE', 'ALLOCATED', 'BLOCKED', 'MAINTENANCE'],
      ALLOCATION: ['ACTIVE', 'ENDED', 'CANCELLED'],
      ATTENDANCE: ['PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY', 'HOLIDAY'],
      SALARY: ['DRAFT', 'APPROVED', 'PAID', 'CANCELLED'],
      EXPENSE: ['POSTED', 'CANCELLED'],
      USER: ['ACTIVE', 'INACTIVE', 'LOCKED'],
      RESULT: ['SUCCESS', 'FAILED']
    };

    var rows = [];
    var ts = Utils.now();
    Object.keys(families).forEach(function (domain) {
      families[domain].forEach(function (key, idx) {
        rows.push([
          Utils.newId('STS'), domain, key, key.replace(/_/g, ' '), 'TRUE', 'FALSE', 'info',
          idx + 1, 'ACTIVE', ts, ts, '', ''
        ]);
      });
    });

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
    return rows.length;
  }

  function seedSocietyConfig(ss) {
    var sheet = getOrCreateSheet(ss, 'Society_Config');
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) { return 0; }

    var keys = [
      ['isConfigured', 'FALSE', 'BOOLEAN', 'SETUP', 'Is society configured', '', FALSE, 1, 'ACTIVE'],
      ['societyName', '', 'STRING', 'IDENTITY', 'Society name', '', FALSE, 2, 'ACTIVE'],
      ['societyAddress', '', 'STRING', 'IDENTITY', 'Society address', '', FALSE, 3, 'ACTIVE'],
      ['registrationNumber', '', 'STRING', 'IDENTITY', 'Registration number', '', FALSE, 4, 'ACTIVE'],
      ['societyEmail', '', 'STRING', 'IDENTITY', 'Society email', '', FALSE, 5, 'ACTIVE'],
      ['societyPhone', '', 'STRING', 'IDENTITY', 'Society phone', '', FALSE, 6, 'ACTIVE'],
      ['societyWebsite', '', 'STRING', 'IDENTITY', 'Society website', '', FALSE, 7, 'ACTIVE'],
      ['logoFileRef', '', 'JSON', 'IDENTITY', 'Logo file reference', '', TRUE, 8, 'ACTIVE'],
      ['currencyCode', 'INR', 'STRING', 'LOCALE', 'Currency code', '', FALSE, 9, 'ACTIVE'],
      ['currencySymbol', '\u20B9', 'STRING', 'LOCALE', 'Currency symbol', '', FALSE, 10, 'ACTIVE'],
      ['locale', 'en-IN', 'STRING', 'LOCALE', 'Locale', '', FALSE, 11, 'ACTIVE'],
      ['timezone', 'Asia/Kolkata', 'STRING', 'LOCALE', 'Timezone', '', FALSE, 12, 'ACTIVE'],
      ['dateDisplayFormat', 'DD/MM/YYYY', 'STRING', 'LOCALE', 'Date display format', '', FALSE, 13, 'ACTIVE'],
      ['financialYearStartMonth', '4', 'NUMBER', 'FINANCE', 'FY start month', '', FALSE, 14, 'ACTIVE'],
      ['financialYearStartDay', '1', 'NUMBER', 'FINANCE', 'FY start day', '', FALSE, 15, 'ACTIVE'],
      ['billingDueDay', '10', 'NUMBER', 'FINANCE', 'Billing due day', '', FALSE, 16, 'ACTIVE'],
      ['interestEnabled', 'TRUE', 'BOOLEAN', 'FINANCE', 'Interest enabled', '', FALSE, 17, 'ACTIVE'],
      ['interestDefaultRuleId', '', 'STRING', 'FINANCE', 'Default interest rule ID', '', FALSE, 18, 'ACTIVE'],
      ['lateFeeEnabled', 'FALSE', 'BOOLEAN', 'FINANCE', 'Late fee enabled', '', FALSE, 19, 'ACTIVE'],
      ['receiptFooterNote', '', 'STRING', 'FINANCE', 'Receipt footer note', '', FALSE, 20, 'ACTIVE'],
      ['demandFooterNote', '', 'STRING', 'FINANCE', 'Demand footer note', '', FALSE, 21, 'ACTIVE'],
      ['archiveAfterMonths', '24', 'NUMBER', 'RETENTION', 'Archive after months', '', FALSE, 22, 'ACTIVE'],
      ['attendanceWorkHours', '8', 'NUMBER', 'HR', 'Work hours per day', '', FALSE, 23, 'ACTIVE'],
      ['salaryPayDay', '5', 'NUMBER', 'HR', 'Salary pay day', '', FALSE, 24, 'ACTIVE'],
      ['visitorAutoExitHours', '12', 'NUMBER', 'OPERATIONS', 'Visitor auto-exit hours', '', FALSE, 25, 'ACTIVE'],
      ['searchMinChars', '2', 'NUMBER', 'UX', 'Minimum search characters', '', FALSE, 26, 'ACTIVE'],
      ['pageSizeDefault', '25', 'NUMBER', 'UX', 'Default page size', '', FALSE, 27, 'ACTIVE'],
      ['pageSizeOptions', '10,25,50,100', 'STRING', 'UX', 'Page size options', '', FALSE, 28, 'ACTIVE'],
      ['sessionIdleMinutes', '60', 'NUMBER', 'SECURITY', 'Session idle minutes', '', FALSE, 29, 'ACTIVE'],
      ['auditRetentionMonths', '60', 'NUMBER', 'SECURITY', 'Audit retention months', '', FALSE, 30, 'ACTIVE']
    ];

    var ts = Utils.now();
    var rows = keys.map(function (k) {
      return [k[0], k[1], k[2], k[3], k[4], k[5], k[6] ? 'TRUE' : 'FALSE', k[7], k[8], ts, ts, '', ''];
    });

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
    return rows.length;
  }

  function seedRoles(ss) {
    var sheet = getOrCreateSheet(ss, 'Roles');
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) { return 0; }

    var ts = Utils.now();
    var roles = [
      ['ADMIN', 'Administrator', 'Full system access', 'TRUE', 1, 'ACTIVE'],
      ['SECRETARY', 'Secretary', 'Notice, complaint, meeting management', 'TRUE', 2, 'ACTIVE'],
      ['CASHIER', 'Cashier', 'Payment and receipt management', 'TRUE', 3, 'ACTIVE'],
      ['MEMBER', 'Member', 'Basic member access', 'TRUE', 4, 'ACTIVE'],
      ['EMPLOYEE', 'Employee', 'Employee self-service access', 'TRUE', 5, 'ACTIVE']
    ];

    var rows = roles.map(function (r) {
      return r.concat([ts, ts, '', '']);
    });

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
    return rows.length;
  }

  function seedPermissions(ss) {
    var sheet = getOrCreateSheet(ss, 'Permissions');
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) { return 0; }

    var ts = Utils.now();
    var perms = [
      ['auth.login', 'auth', 'login', 'User login', '', 'ACTIVE'],
      ['auth.logout', 'auth', 'logout', 'User logout', '', 'ACTIVE'],
      ['config.read', 'config', 'read', 'Read configuration', '', 'ACTIVE'],
      ['config.write', 'config', 'write', 'Update configuration', '', 'ACTIVE'],
      ['members.read', 'members', 'read', 'Read member data', '', 'ACTIVE'],
      ['members.write', 'members', 'write', 'Create/update members', '', 'ACTIVE'],
      ['flats.read', 'flats', 'read', 'Read flat data', '', 'ACTIVE'],
      ['flats.write', 'flats', 'write', 'Create/update flats', '', 'ACTIVE'],
      ['payments.read', 'payments', 'read', 'Read payments', '', 'ACTIVE'],
      ['payments.write', 'payments', 'write', 'Record/cancel payments', '', 'ACTIVE'],
      ['demands.read', 'demands', 'read', 'Read demands', '', 'ACTIVE'],
      ['demands.write', 'demands', 'write', 'Generate/update demands', '', 'ACTIVE'],
      ['expenses.read', 'expenses', 'read', 'Read expenses', '', 'ACTIVE'],
      ['expenses.write', 'expenses', 'write', 'Record/update expenses', '', 'ACTIVE'],
      ['complaints.read', 'complaints', 'read', 'Read complaints', '', 'ACTIVE'],
      ['complaints.write', 'complaints', 'write', 'Create/update complaints', '', 'ACTIVE'],
      ['visitors.read', 'visitors', 'read', 'Read visitors', '', 'ACTIVE'],
      ['visitors.write', 'visitors', 'write', 'Log/update visitors', '', 'ACTIVE'],
      ['notices.read', 'notices', 'read', 'Read notices', '', 'ACTIVE'],
      ['notices.write', 'notices', 'write', 'Create/update notices', '', 'ACTIVE'],
      ['meetings.read', 'meetings', 'read', 'Read meetings', '', 'ACTIVE'],
      ['meetings.write', 'meetings', 'write', 'Create/update meetings', '', 'ACTIVE'],
      ['documents.read', 'documents', 'read', 'Read documents', '', 'ACTIVE'],
      ['documents.write', 'documents', 'write', 'Create/update documents', '', 'ACTIVE'],
      ['employees.read', 'employees', 'read', 'Read employees', '', 'ACTIVE'],
      ['employees.write', 'employees', 'write', 'Create/update employees', '', 'ACTIVE'],
      ['parking.read', 'parking', 'read', 'Read parking data', '', 'ACTIVE'],
      ['parking.write', 'parking', 'write', 'Allocate/manage parking', '', 'ACTIVE'],
      ['reports.read', 'reports', 'read', 'Read reports', '', 'ACTIVE'],
      ['dashboard.read', 'dashboard', 'read', 'Read dashboard', '', 'ACTIVE'],
      ['backup.write', 'backup', 'write', 'Create backups', '', 'ACTIVE'],
      ['audit.read', 'audit', 'read', 'Read audit log', '', 'ACTIVE'],
      ['settings.read', 'settings', 'read', 'Read settings', '', 'ACTIVE'],
      ['settings.write', 'settings', 'write', 'Update settings', '', 'ACTIVE']
    ];

    var rows = perms.map(function (p) {
      return p.concat([ts, ts, '', '']);
    });

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
    return rows.length;
  }

  function seedRolePermissions(ss) {
    var sheet = getOrCreateSheet(ss, 'Role_Permissions');
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) { return 0; }

    var permSheet = ss.getSheetByName('Permissions');
    if (!permSheet) { return 0; }
    var permLastRow = permSheet.getLastRow();
    if (permLastRow <= 1) { return 0; }

    var permCols = Schema.columnsOf('Permissions');
    var permKeyIdx = permCols.indexOf('permissionKey');
    var permValues = permSheet.getRange(2, 1, permLastRow - 1, permCols.length).getValues();
    var permKeys = [];
    for (var i = 0; i < permValues.length; i++) {
      if (permValues[i][permKeyIdx]) { permKeys.push(permValues[i][permKeyIdx]); }
    }

    var ts = Utils.now();
    var rows = [];
    permKeys.forEach(function (permKey) {
      rows.push([
        Utils.newId('RPR'), 'ADMIN', permKey, 'TRUE', ts, ts, '', ''
      ]);
    });

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
    return rows.length;
  }

  function seedPaymentModes(ss) {
    var sheet = getOrCreateSheet(ss, 'Payment_Modes');
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) { return 0; }

    var ts = Utils.now();
    var modes = [
      ['CASH', 'Cash', 'Cash payment', 'TRUE', 1, 'ACTIVE'],
      ['CHEQUE', 'Cheque', 'Cheque payment', 'FALSE', 2, 'ACTIVE'],
      ['UPI', 'UPI', 'Unified Payments Interface', 'FALSE', 3, 'ACTIVE'],
      ['NEFT', 'NEFT', 'National Electronics Funds Transfer', 'FALSE', 4, 'ACTIVE'],
      ['RTGS', 'RTGS', 'Real Time Gross Settlement', 'FALSE', 5, 'ACTIVE']
    ];

    var rows = modes.map(function (m) {
      return m.concat([ts, ts, '', '']);
    });

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
    return rows.length;
  }

  function seedEmployeeTypes(ss) {
    var sheet = getOrCreateSheet(ss, 'Employee_Types');
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) { return 0; }

    var ts = Utils.now();
    var types = [
      ['SECURITY', 'Security Guard', 'Building security', 1, 'ACTIVE'],
      ['HOUSEKEEPING', 'Housekeeping', 'Cleaning and maintenance', 2, 'ACTIVE'],
      ['MAINTENANCE', 'Maintenance', 'Technical maintenance staff', 3, 'ACTIVE']
    ];

    var rows = types.map(function (t) {
      return [Utils.newId('ETY')].concat(t).concat([ts, ts, '', '']);
    });

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
    return rows.length;
  }

  function seedComplaintPriorities(ss) {
    var sheet = getOrCreateSheet(ss, 'Complaint_Priorities');
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) { return 0; }

    var ts = Utils.now();
    var priorities = [
      ['LOW', 'Low', 168, 'info', 1, 'ACTIVE'],
      ['MEDIUM', 'Medium', 72, 'warning', 2, 'ACTIVE'],
      ['HIGH', 'High', 24, 'error', 3, 'ACTIVE'],
      ['CRITICAL', 'Critical', 4, 'critical', 4, 'ACTIVE']
    ];

    var rows = priorities.map(function (p) {
      return [Utils.newId('CPRI')].concat(p).concat([ts, ts, '', '']);
    });

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
    return rows.length;
  }

  function seedDocumentCategories(ss) {
    var sheet = getOrCreateSheet(ss, 'Document_Categories');
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) { return 0; }

    var ts = Utils.now();
    var categories = [
      ['GOVERNMENT', 'Government Documents', 'GOVERNMENT', '', 120, 1, 'ACTIVE'],
      ['LEGAL', 'Legal Documents', 'LEGAL', '', 120, 2, 'ACTIVE'],
      ['FINANCIAL', 'Financial Documents', 'FINANCIAL', '', 60, 3, 'ACTIVE'],
      ['MINUTES', 'Meeting Minutes', 'MINUTES', '', 120, 4, 'ACTIVE'],
      ['NOTICES', 'Notices', 'NOTICES', '', 36, 5, 'ACTIVE'],
      ['COMPLAINTS', 'Complaint Attachments', 'COMPLAINTS', '', 36, 6, 'ACTIVE'],
      ['CONTRACTS', 'Vendor Contracts', 'CONTRACTS', '', 120, 7, 'ACTIVE'],
      ['INSURANCE', 'Insurance Documents', 'INSURANCE', '', 120, 8, 'ACTIVE'],
      ['CERTIFICATES', 'Certificates', 'CERTIFICATES', '', 120, 9, 'ACTIVE'],
      ['MISCELLANEOUS', 'Miscellaneous', 'MISCELLANEOUS', '', 36, 10, 'ACTIVE']
    ];

    var rows = categories.map(function (c) {
      return [Utils.newId('DCAT')].concat(c).concat([ts, ts, '', '']);
    });

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
    return rows.length;
  }

  function seedNumberingConfig(ss) {
    var sheet = getOrCreateSheet(ss, 'Numbering_Config');
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) { return 0; }

    var ts = Utils.now();
    var configs = [
      ['DEMAND', '{prefix}{YYYY}{seq}', 'DM-', 5, 'YEARLY', 1, '', 'ACTIVE'],
      ['RECEIPT', '{prefix}{YYYY}{seq}', 'RCP-', 5, 'YEARLY', 1, '', 'ACTIVE'],
      ['COMPLAINT', '{prefix}{YYYY}{seq}', 'CMP-', 5, 'YEARLY', 1, '', 'ACTIVE'],
      ['NOTICE', '{prefix}{YYYY}{seq}', 'NOT-', 5, 'YEARLY', 1, '', 'ACTIVE'],
      ['MEETING', '{prefix}{YYYY}{seq}', 'MTG-', 5, 'YEARLY', 1, '', 'ACTIVE'],
      ['EXPENSE', '{prefix}{YYYY}{seq}', 'EXP-', 5, 'YEARLY', 1, '', 'ACTIVE'],
      ['DOCUMENT', '{prefix}{YYYY}{seq}', 'DOC-', 5, 'YEARLY', 1, '', 'ACTIVE']
    ];

    var rows = configs.map(function (c) {
      return [Utils.newId('NCFG')].concat(c).concat([ts, ts, '', '']);
    });

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
    return rows.length;
  }

  // ---------------------------------------------------------------------------
  // Trigger handlers (scheduled)
  // ---------------------------------------------------------------------------

  function dailyMaintenance() {
    var ts = Utils.now();
    var prunedSessions = 0;
    var autoExited = 0;

    try {
      var sheet = Repository.getSheet('Sessions');
      var columns = Schema.columnsOf('Sessions');
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
        for (var i = values.length - 1; i >= 0; i--) {
          var rec = Repository.fromRow('Sessions', values[i]);
          if (rec.expiresAt && new Date(rec.expiresAt) < new Date()) {
            Repository.updateById('Sessions', rec.sessionId, {
              statusKey: 'EXPIRED'
            }, { userId: 'SYSTEM' });
            prunedSessions++;
          }
        }
      }
    } catch (e) { /* sheet may not exist */ }

    try {
      var visitorSheet = Repository.getSheet('Visitors');
      var vColumns = Schema.columnsOf('Visitors');
      var vLastRow = visitorSheet.getLastRow();
      if (vLastRow > 1) {
        var autoExitHours = 12;
        var cutoff = new Date(Date.now() - autoExitHours * 60 * 60 * 1000);
        var vValues = visitorSheet.getRange(2, 1, vLastRow - 1, vColumns.length).getValues();
        for (var j = vValues.length - 1; j >= 0; j--) {
          var vRec = Repository.fromRow('Visitors', vValues[j]);
          if (vRec.statusKey === 'INSIDE' && vRec.entryAt) {
            var entryTime = new Date(vRec.entryAt);
            if (entryTime < cutoff) {
              Repository.updateById('Visitors', vRec.visitorId, {
                statusKey: 'OVERSTAY',
                exitAt: ts,
                remarks: (vRec.remarks || '') + ' [Auto-exited after ' + autoExitHours + 'h]'
              }, { userId: 'SYSTEM' });
              autoExited++;
            }
          }
        }
      }
    } catch (e) { /* sheet may not exist */ }

    return { prunedSessions: prunedSessions, autoExited: autoExited };
  }

  function weeklyBackup() {
    var ctx = {
      payload: { scope: 'FULL', notes: 'Weekly automated backup' },
      user: { userId: 'SYSTEM', fullName: 'System', roleKeys: ['ADMIN'] },
      requestId: Utils.newId('REQ')
    };
    return BackupService.create(ctx);
  }

  function monthlyArchive() {
    var ctx = {
      payload: { dryRun: false },
      user: { userId: 'SYSTEM', fullName: 'System', roleKeys: ['ADMIN'] },
      requestId: Utils.newId('REQ')
    };
    return BackupService.runArchive(ctx);
  }

  // ---------------------------------------------------------------------------
  // Trigger installation
  // ---------------------------------------------------------------------------

  function installTriggers() {
    var planned = [
      { name: 'dailySessionPrune', description: 'Daily session prune at 2 AM', schedule: 'daily' },
      { name: 'dailyVisitorAutoExit', description: 'Daily visitor auto-exit at 2 AM', schedule: 'daily' },
      { name: 'weeklyBackup', description: 'Weekly backup on Sunday at 3 AM', schedule: 'weekly' },
      { name: 'monthlyArchive', description: 'Monthly archive on 1st at 4 AM', schedule: 'monthly' }
    ];

    var projectTriggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < projectTriggers.length; i++) {
      ScriptApp.deleteTrigger(projectTriggers[i]);
    }

    ScriptApp.newTrigger('dailyMaintenance')
      .timeBased()
      .everyDays(1)
      .atHour(2)
      .create();

    ScriptApp.newTrigger('weeklyBackup')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.SUNDAY)
      .atHour(3)
      .create();

    ScriptApp.newTrigger('monthlyArchive')
      .timeBased()
      .onMonthDay(1)
      .atHour(4)
      .create();

    return { planned: planned };
  }

  function removeTriggers() {
    var projectTriggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < projectTriggers.length; i++) {
      ScriptApp.deleteTrigger(projectTriggers[i]);
    }
    return { removed: projectTriggers.length };
  }

  // ---------------------------------------------------------------------------
  // Migration
  // ---------------------------------------------------------------------------

  function migrate(ctx) {
    var ts = Utils.now();
    var userId = ctx && ctx.user ? ctx.user.userId : 'SYSTEM';

    var authSS = getOrCreateSpreadsheet('AUTH');
    var societySS = getOrCreateSpreadsheet('SOCIETY');

    var sheetsAdded = [];
    var columnsAdded = {};

    var allSheets = Schema.sheetNames();
    for (var i = 0; i < allSheets.length; i++) {
      var sheetName = allSheets[i];
      var def = Schema.get(sheetName);
      var ss = def.spreadsheet === 'AUTH' ? authSS : societySS;
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheetsAdded.push(sheetName);
      }
      var expectedCols = Schema.columnsOf(sheetName);
      var lastCol = sheet.getLastColumn();
      if (lastCol < expectedCols.length) {
        var existing = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
        var missing = [];
        for (var c = lastCol; c < expectedCols.length; c++) {
          missing.push(expectedCols[c]);
        }
        if (missing.length > 0) {
          sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
          if (!columnsAdded[sheetName]) { columnsAdded[sheetName] = []; }
          columnsAdded[sheetName] = columnsAdded[sheetName].concat(missing);
        }
      }
      writeHeaders(sheet, sheetName);
    }

    var archivable = Schema.archivableSheets();
    for (var j = 0; j < archivable.length; j++) {
      var archiveName = Schema.archiveSheetName(archivable[j]);
      var socSheet = societySS.getSheetByName(archiveName);
      if (!socSheet) {
        societySS.insertSheet(archiveName);
        sheetsAdded.push(archiveName);
      }
    }

    var metaSheet = getOrCreateSheet(societySS, '_Meta');
    var metaLastRow = metaSheet.getLastRow();
    var metaUpdated = false;
    if (metaLastRow > 1) {
      var metaValues = metaSheet.getRange(2, 1, metaLastRow - 1, 3).getValues();
      for (var m = 0; m < metaValues.length; m++) {
        if (metaValues[m][0] === 'schemaVersion') {
          metaSheet.getRange(m + 2, 2).setValue(String(Schema.SCHEMA_VERSION));
          metaUpdated = true;
          break;
        }
      }
    }
    if (!metaUpdated) {
      metaSheet.appendRow(['schemaVersion', String(Schema.SCHEMA_VERSION), ts, userId]);
    }

    try {
      var auditSheet = Repository.getSheet('Audit_Log');
      auditSheet.appendRow([
        Utils.newId('AUD'), ts, userId, '', '', 'SCHEMA_MIGRATION', '_Meta',
        '', '', '', '', '', 'Schema migration to v' + Schema.SCHEMA_VERSION, '', '', '', '', 'SUCCESS'
      ]);
    } catch (e) { /* Audit_Log may not exist */ }

    return {
      sheetsAdded: sheetsAdded,
      columnsAdded: columnsAdded,
      schemaVersion: Schema.SCHEMA_VERSION
    };
  }

  // ---------------------------------------------------------------------------
  // Seed admin user
  // ---------------------------------------------------------------------------

  function seedAdminUser(opts) {
    if (!opts || !opts.username || !opts.email || !opts.password) {
      return { ok: false, error: 'BAD_REQUEST', message: 'username, email, and password are required' };
    }

    if (!Utils.isEmail(opts.email)) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Invalid email format' };
    }

    if (opts.password.length < 8) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' };
    }

    if (opts.password.toLowerCase() === opts.username.toLowerCase() ||
        opts.password.toLowerCase() === opts.email.toLowerCase()) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Password must not equal username or email' };
    }

    var sheet = Repository.getSheet('Users');
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      return { ok: false, error: 'CONFLICT_ERROR', message: 'Users already exist. seedAdminUser is for first-time setup only.' };
    }

    var hashed = Utils.hashPassword(opts.password);
    var userId = Utils.newId('USR');
    var ts = Utils.now();
    var cols = Schema.columnsOf('Users');

    var row = new Array(cols.length).fill('');
    row[cols.indexOf('userId')] = userId;
    row[cols.indexOf('username')] = opts.username;
    row[cols.indexOf('email')] = opts.email;
    row[cols.indexOf('mobile')] = opts.mobile || '';
    row[cols.indexOf('fullName')] = opts.fullName || opts.username;
    row[cols.indexOf('passwordHash')] = hashed.hash;
    row[cols.indexOf('passwordSalt')] = hashed.salt;
    row[cols.indexOf('passwordAlgo')] = hashed.algo;
    row[cols.indexOf('roleKeys')] = 'ADMIN';
    row[cols.indexOf('statusKey')] = 'ACTIVE';
    row[cols.indexOf('mustChangePassword')] = 'TRUE';
    row[cols.indexOf('createdAt')] = ts;
    row[cols.indexOf('updatedAt')] = ts;

    sheet.appendRow(row);

    try {
      var auditSheet = Repository.getSheet('Auth_Audit');
      auditSheet.appendRow([
        Utils.newId('AAU'), ts, userId, 'SEED_ADMIN', 'Users', userId,
        JSON.stringify({ username: opts.username, email: opts.email }),
        'SUCCESS', ''
      ]);
    } catch (e) { /* Auth_Audit may not exist */ }

    return { ok: true, userId: userId };
  }

  // ---------------------------------------------------------------------------
  // Full install
  // ---------------------------------------------------------------------------

  function install(ctx) {
    var ts = Utils.now();
    var userId = ctx && ctx.user ? ctx.user.userId : 'SYSTEM';

    var authSS = getOrCreateSpreadsheet('AUTH');
    var societySS = getOrCreateSpreadsheet('SOCIETY');

    var allSheets = Schema.sheetNames();
    var created = [];
    for (var i = 0; i < allSheets.length; i++) {
      var sheetName = allSheets[i];
      var def = Schema.get(sheetName);
      var ss = def.spreadsheet === 'AUTH' ? authSS : societySS;
      var sheet = getOrCreateSheet(ss, sheetName);
      writeHeaders(sheet, sheetName);
      created.push(sheetName);
    }

    var archivable = Schema.archivableSheets();
    for (var j = 0; j < archivable.length; j++) {
      var archiveSheetName = Schema.archiveSheetName(archivable[j]);
      getOrCreateSheet(societySS, archiveSheetName);
      created.push(archiveSheetName);
    }

    var statusCount = seedStatusConfig(societySS);
    var societyConfigCount = seedSocietyConfig(societySS);
    var roleCount = seedRoles(authSS);
    var permCount = seedPermissions(authSS);
    seedRolePermissions(authSS);
    seedPaymentModes(societySS);
    seedEmployeeTypes(societySS);
    seedComplaintPriorities(societySS);
    seedDocumentCategories(societySS);
    seedNumberingConfig(societySS);

    if (societyConfigCount === 0) {
      var socSheet = societySS.getSheetByName('Society_Config');
      societyConfigCount = socSheet ? socSheet.getLastRow() - 1 : 0;
    }
    if (statusCount === 0) {
      var statusSheet = societySS.getSheetByName('Status_Config');
      statusCount = statusSheet ? statusSheet.getLastRow() - 1 : 0;
    }
    if (roleCount === 0) {
      var roleSheet = authSS.getSheetByName('Roles');
      roleCount = roleSheet ? roleSheet.getLastRow() - 1 : 0;
    }
    if (permCount === 0) {
      var permSheet = authSS.getSheetByName('Permissions');
      permCount = permSheet ? permSheet.getLastRow() - 1 : 0;
    }

    var metaSheet = getOrCreateSheet(societySS, '_Meta');
    var metaLastRow = metaSheet.getLastRow();
    var metaUpdated = false;
    if (metaLastRow > 1) {
      var metaValues = metaSheet.getRange(2, 1, metaLastRow - 1, 3).getValues();
      for (var m = 0; m < metaValues.length; m++) {
        if (metaValues[m][0] === 'schemaVersion') {
          metaSheet.getRange(m + 2, 2).setValue(String(Schema.SCHEMA_VERSION));
          metaUpdated = true;
          break;
        }
      }
    }
    if (!metaUpdated) {
      metaSheet.appendRow(['schemaVersion', String(Schema.SCHEMA_VERSION), ts, userId]);
    }
    metaSheet.appendRow(['appVersion', Schema.APP_VERSION, ts, userId]);
    metaSheet.appendRow(['installedAt', ts, ts, userId]);
    metaSheet.appendRow(['installedBy', userId, ts, userId]);

    installTriggers();

    return {
      created: created,
      seeded: {
        societyConfig: societyConfigCount,
        statuses: statusCount,
        roles: roleCount,
        permissions: permCount
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Configure IDs & Health Check
  // ---------------------------------------------------------------------------

  /**
   * Set Script Properties for spreadsheet and Drive folder IDs.
   * Run once in the GAS editor after deployment.
   * @param {object} ids  { societySheetId, authSheetId, driveRootFolderId }
   * @return {{ ok: boolean, set: string[] }}
   */
  function configureIds(ids) {
    if (!ids) {
      return { ok: false, error: 'BAD_REQUEST', message: 'Provide { societySheetId, authSheetId, driveRootFolderId }' };
    }
    var props = PropertiesService.getScriptProperties();
    var set = [];
    if (ids.societySheetId) {
      props.setProperty('SOCIETY_SHEET_ID', ids.societySheetId);
      set.push('SOCIETY_SHEET_ID');
    }
    if (ids.authSheetId) {
      props.setProperty('AUTH_SHEET_ID', ids.authSheetId);
      set.push('AUTH_SHEET_ID');
    }
    if (ids.driveRootFolderId) {
      props.setProperty('DRIVE_ROOT_FOLDER_ID', ids.driveRootFolderId);
      set.push('DRIVE_ROOT_FOLDER_ID');
    }
    return { ok: true, set: set };
  }

  /**
   * Verify all required IDs are configured and resources are accessible.
   * @return {{ ok: boolean, checks: object[] }}
   */
  function healthCheck() {
    var checks = [];
    var allOk = true;

    // Check SOCIETY_SHEET_ID
    try {
      var socId = CONFIG.str('SOCIETY_SHEET_ID');
      if (!socId) {
        checks.push({ name: 'SOCIETY_SHEET_ID', ok: false, error: 'Not set in Script Properties' });
        allOk = false;
      } else {
        var socSS = SpreadsheetApp.openById(socId);
        var socName = socSS.getName();
        checks.push({ name: 'SOCIETY_SHEET_ID', ok: true, value: socId, spreadsheet: socName });
      }
    } catch (e) {
      checks.push({ name: 'SOCIETY_SHEET_ID', ok: false, error: e.message });
      allOk = false;
    }

    // Check AUTH_SHEET_ID
    try {
      var authId = CONFIG.str('AUTH_SHEET_ID');
      if (!authId) {
        checks.push({ name: 'AUTH_SHEET_ID', ok: false, error: 'Not set in Script Properties' });
        allOk = false;
      } else {
        var authSS = SpreadsheetApp.openById(authId);
        var authName = authSS.getName();
        checks.push({ name: 'AUTH_SHEET_ID', ok: true, value: authId, spreadsheet: authName });
      }
    } catch (e) {
      checks.push({ name: 'AUTH_SHEET_ID', ok: false, error: e.message });
      allOk = false;
    }

    // Check DRIVE_ROOT_FOLDER_ID
    try {
      var driveId = CONFIG.str('DRIVE_ROOT_FOLDER_ID');
      if (!driveId) {
        checks.push({ name: 'DRIVE_ROOT_FOLDER_ID', ok: false, error: 'Not set in Script Properties' });
        allOk = false;
      } else {
        var folder = DriveApp.getFolderById(driveId);
        var folderName = folder.getName();
        checks.push({ name: 'DRIVE_ROOT_FOLDER_ID', ok: true, value: driveId, folder: folderName });
      }
    } catch (e) {
      checks.push({ name: 'DRIVE_ROOT_FOLDER_ID', ok: false, error: e.message });
      allOk = false;
    }

    // Check key sheets exist in SOCIETY spreadsheet
    if (checks[0] && checks[0].ok) {
      try {
        var ss = SpreadsheetApp.openById(checks[0].value);
        var keySheets = ['Society_Config', 'Status_Config', 'Members', 'Flats', 'Payments', '_Meta'];
        var missingSheets = [];
        keySheets.forEach(function (name) {
          if (!ss.getSheetByName(name)) { missingSheets.push(name); }
        });
        if (missingSheets.length > 0) {
          checks.push({ name: 'SOCIETY_SHEETS', ok: false, error: 'Missing sheets: ' + missingSheets.join(', ') });
          allOk = false;
        } else {
          checks.push({ name: 'SOCIETY_SHEETS', ok: true, count: keySheets.length });
        }
      } catch (e) {
        checks.push({ name: 'SOCIETY_SHEETS', ok: false, error: e.message });
        allOk = false;
      }
    }

    // Check key sheets exist in AUTH spreadsheet
    if (checks[1] && checks[1].ok) {
      try {
        var authSS2 = SpreadsheetApp.openById(checks[1].value);
        var authKeySheets = ['Users', 'Roles', 'Permissions', 'Sessions'];
        var missingAuth = [];
        authKeySheets.forEach(function (name) {
          if (!authSS2.getSheetByName(name)) { missingAuth.push(name); }
        });
        if (missingAuth.length > 0) {
          checks.push({ name: 'AUTH_SHEETS', ok: false, error: 'Missing sheets: ' + missingAuth.join(', ') });
          allOk = false;
        } else {
          checks.push({ name: 'AUTH_SHEETS', ok: true, count: authKeySheets.length });
        }
      } catch (e) {
        checks.push({ name: 'AUTH_SHEETS', ok: false, error: e.message });
        allOk = false;
      }
    }

    // Check Drive folder has sub-folders
    if (checks[2] && checks[2].ok) {
      try {
        var driveFolder = DriveApp.getFolderById(checks[2].value);
        var subFolders = driveFolder.getFolders();
        var folderNames = [];
        while (subFolders.hasNext()) {
          folderNames.push(subFolders.next().getName());
        }
        checks.push({ name: 'DRIVE_SUBFOLDERS', ok: true, count: folderNames.length, folders: folderNames });
      } catch (e) {
        checks.push({ name: 'DRIVE_SUBFOLDERS', ok: false, error: e.message });
      }
    }

    return { ok: allOk, checks: checks };
  }

  // ---------------------------------------------------------------------------
  // Expose
  // ---------------------------------------------------------------------------

  return {
    install: install,
    migrate: migrate,
    seedAdminUser: seedAdminUser,
    configureIds: configureIds,
    healthCheck: healthCheck,
    installTriggers: installTriggers,
    removeTriggers: removeTriggers,
    dailyMaintenance: dailyMaintenance,
    weeklyBackup: weeklyBackup,
    monthlyArchive: monthlyArchive
  };
})();
