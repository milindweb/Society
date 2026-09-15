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
      ['isConfigured', 'FALSE', 'BOOLEAN', 'SETUP', 'Is society configured', '', false, 1, 'ACTIVE'],
      ['societyName', '', 'STRING', 'IDENTITY', 'Society name', '', false, 2, 'ACTIVE'],
      ['societyAddress', '', 'STRING', 'IDENTITY', 'Society address', '', false, 3, 'ACTIVE'],
      ['registrationNumber', '', 'STRING', 'IDENTITY', 'Registration number', '', false, 4, 'ACTIVE'],
      ['societyEmail', '', 'STRING', 'IDENTITY', 'Society email', '', false, 5, 'ACTIVE'],
      ['societyPhone', '', 'STRING', 'IDENTITY', 'Society phone', '', false, 6, 'ACTIVE'],
      ['societyWebsite', '', 'STRING', 'IDENTITY', 'Society website', '', false, 7, 'ACTIVE'],
      ['logoFileRef', '', 'JSON', 'IDENTITY', 'Logo file reference', '', true, 8, 'ACTIVE'],
      ['currencyCode', 'INR', 'STRING', 'LOCALE', 'Currency code', '', false, 9, 'ACTIVE'],
      ['currencySymbol', '\u20B9', 'STRING', 'LOCALE', 'Currency symbol', '', false, 10, 'ACTIVE'],
      ['locale', 'en-IN', 'STRING', 'LOCALE', 'Locale', '', false, 11, 'ACTIVE'],
      ['timezone', 'Asia/Kolkata', 'STRING', 'LOCALE', 'Timezone', '', false, 12, 'ACTIVE'],
      ['dateDisplayFormat', 'DD/MM/YYYY', 'STRING', 'LOCALE', 'Date display format', '', false, 13, 'ACTIVE'],
      ['financialYearStartMonth', '4', 'NUMBER', 'FINANCE', 'FY start month', '', false, 14, 'ACTIVE'],
      ['financialYearStartDay', '1', 'NUMBER', 'FINANCE', 'FY start day', '', false, 15, 'ACTIVE'],
      ['billingDueDay', '10', 'NUMBER', 'FINANCE', 'Billing due day', '', false, 16, 'ACTIVE'],
      ['interestEnabled', 'TRUE', 'BOOLEAN', 'FINANCE', 'Interest enabled', '', false, 17, 'ACTIVE'],
      ['interestDefaultRuleId', '', 'STRING', 'FINANCE', 'Default interest rule ID', '', false, 18, 'ACTIVE'],
      ['lateFeeEnabled', 'FALSE', 'BOOLEAN', 'FINANCE', 'Late fee enabled', '', false, 19, 'ACTIVE'],
      ['receiptFooterNote', '', 'STRING', 'FINANCE', 'Receipt footer note', '', false, 20, 'ACTIVE'],
      ['demandFooterNote', '', 'STRING', 'FINANCE', 'Demand footer note', '', false, 21, 'ACTIVE'],
      ['archiveAfterMonths', '24', 'NUMBER', 'RETENTION', 'Archive after months', '', false, 22, 'ACTIVE'],
      ['attendanceWorkHours', '8', 'NUMBER', 'HR', 'Work hours per day', '', false, 23, 'ACTIVE'],
      ['salaryPayDay', '5', 'NUMBER', 'HR', 'Salary pay day', '', false, 24, 'ACTIVE'],
      ['visitorAutoExitHours', '12', 'NUMBER', 'OPERATIONS', 'Visitor auto-exit hours', '', false, 25, 'ACTIVE'],
      ['searchMinChars', '2', 'NUMBER', 'UX', 'Minimum search characters', '', false, 26, 'ACTIVE'],
      ['pageSizeDefault', '25', 'NUMBER', 'UX', 'Default page size', '', false, 27, 'ACTIVE'],
      ['pageSizeOptions', '10,25,50,100', 'STRING', 'UX', 'Page size options', '', false, 28, 'ACTIVE'],
      ['sessionIdleMinutes', '60', 'NUMBER', 'SECURITY', 'Session idle minutes', '', false, 29, 'ACTIVE'],
      ['auditRetentionMonths', '60', 'NUMBER', 'SECURITY', 'Audit retention months', '', false, 30, 'ACTIVE']
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
      ['attendance.read', 'attendance', 'read', 'Read employee attendance', '', 'ACTIVE'],
      ['attendance.write', 'attendance', 'write', 'Mark employee attendance', '', 'ACTIVE'],
      ['salary.read', 'salary', 'read', 'Read salary records', '', 'ACTIVE'],
      ['salary.write', 'salary', 'write', 'Prepare/update/pay salary', '', 'ACTIVE'],
      ['salary.approve', 'salary', 'approve', 'Approve salary runs', '', 'ACTIVE'],
      ['parking.read', 'parking', 'read', 'Read parking data', '', 'ACTIVE'],
      ['parking.write', 'parking', 'write', 'Allocate/manage parking', '', 'ACTIVE'],
      ['reports.read', 'reports', 'read', 'Read reports', '', 'ACTIVE'],
      ['reports.export', 'reports', 'export', 'Export reports to CSV', '', 'ACTIVE'],
      ['dashboard.read', 'dashboard', 'read', 'Read dashboard', '', 'ACTIVE'],
      /* --- FE-12 repair: keys used by Routes.gs but never seeded ---
       * `RbacService.resolvePermissions` builds a user's permission set ONLY from
       * rows in `Role_Permissions`, and `seedRolePermissions` creates those rows
       * ONLY for keys present in this list. A route gated on an unseeded key
       * therefore returns FORBIDDEN for EVERY role, ADMIN included. These keys
       * were in use but missing, which made the whole Maintenance module, all of
       * Backup/Archive, and Roles/Users management unreachable in a fresh deploy. */
      ['maintenance.read', 'maintenance', 'read', 'Read maintenance & billing periods', '', 'ACTIVE'],
      ['maintenance.write', 'maintenance', 'write', 'Edit demands, charges and periods', '', 'ACTIVE'],
      ['maintenance.generate', 'maintenance', 'generate', 'Generate demands for a period', '', 'ACTIVE'],
      ['maintenance.lock', 'maintenance', 'lock', 'Lock/unlock a billing period', '', 'ACTIVE'],
      ['interest.waive', 'maintenance', 'waive', 'Waive late-payment interest', '', 'ACTIVE'],
      ['payments.reverse', 'payments', 'reverse', 'Reverse a recorded payment', '', 'ACTIVE'],
      ['backup.run', 'backup', 'run', 'Run a manual backup', '', 'ACTIVE'],
      ['archive.run', 'backup', 'archive', 'Run an archive job', '', 'ACTIVE'],
      ['archive.read', 'backup', 'readArchive', 'Read archived records', '', 'ACTIVE'],
      ['roles.read', 'roles', 'read', 'Read roles', '', 'ACTIVE'],
      ['roles.manage', 'roles', 'manage', 'Create/update roles and permissions', '', 'ACTIVE'],
      ['users.manage', 'users', 'manage', 'Create/update/deactivate users', '', 'ACTIVE'],
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
  // Dummy data (demo / development only)
  // ---------------------------------------------------------------------------

  /**
   * Populate every operational sheet with a consistent, self-consistent demo dataset.
   *
   * This is intentionally separate from install(): install() seeds structure + system
   * capability only and zero society facts. seedDummyData() feeds all operational sheets
   * (wings, flats, members, vehicles, employees, vendors, parking, charge types/rates,
   * billing periods, demands, payments, ledger, receipts, adjustments, expenses, complaints,
   * visitors, notices, meetings, documents, attendance and salary) with sample rows so the
   * app can be demoed end-to-end. Idempotent: refuses to run when operational data exists.
   *
   * @return {{ ok: boolean, error?: string, message?: string, counts?: object, total?: number }}
   */
  function seedDummyData() {
    var actor = { userId: 'SYSTEM' };
    var counts = {};
    var pad2 = function (n) { return n < 10 ? '0' + n : '' + n; };
    var pad5 = function (n) { var s = String(n); while (s.length < 5) { s = '0' + s; } return s; };

    function periodAdd(pk, delta) {
      var p = pk.split('-');
      var d = new Date(Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1 + delta, 1));
      return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1);
    }

    function seed(sheetName, records) {
      var created = Repository.insertMany(sheetName, records, actor);
      counts[sheetName] = created.length;
      return created;
    }

    // ---- bootstrap ---------------------------------------------------------
    var socSS = getOrCreateSpreadsheet('SOCIETY');
    getOrCreateSpreadsheet('AUTH');
    var socConfigSheet = socSS.getSheetByName('Society_Config');
    if (!socConfigSheet || socConfigSheet.getLastRow() <= 1 || !socSS.getSheetByName('Flats')) {
      install({ user: { userId: 'SYSTEM' } });
    }
    var flatsSheet = socSS.getSheetByName('Flats');
    var alreadySeeded = !!(flatsSheet && flatsSheet.getLastRow() > 1);

    var ts = Utils.now();
    var curPeriod = Utils.currentPeriod();
    var prevPeriod = periodAdd(curPeriod, -1);
    var fy = Utils.financialYear();

    if (!alreadySeeded) {

    // ---- society identity (dummy demo facts) -------------------------------
    var identity = {
      societyName: 'Sunrise Residency',
      societyAddress: '12 Green Park Lane, Andheri West, Mumbai 400058',
      societyEmail: 'admin@sunriseresidency.example',
      societyPhone: '02212345678',
      registrationNumber: 'SOC-2020-004567',
      isConfigured: 'TRUE'
    };
    Object.keys(identity).forEach(function (k) {
      Repository.updateById('Society_Config', k, { configValue: identity[k] });
    });

    // ---- master data: types & categories -----------------------------------
    var wings = seed('Wings', [
      { wingName: 'Wing A', description: 'North block', sortOrder: 1, status: 'ACTIVE' },
      { wingName: 'Wing B', description: 'South block', sortOrder: 2, status: 'ACTIVE' },
      { wingName: 'Wing C', description: 'Garden-facing block', sortOrder: 3, status: 'ACTIVE' }
    ]);
    var wingByCode = { A: wings[0].wingId, B: wings[1].wingId, C: wings[2].wingId };

    var flatTypes = seed('Flat_Types', [
      { typeName: '1 BHK', description: 'One bedroom', sortOrder: 1, status: 'ACTIVE' },
      { typeName: '2 BHK', description: 'Two bedroom', sortOrder: 2, status: 'ACTIVE' },
      { typeName: '3 BHK', description: 'Three bedroom', sortOrder: 3, status: 'ACTIVE' },
      { typeName: 'Penthouse', description: 'Top floor duplex', sortOrder: 4, status: 'ACTIVE' }
    ]);
    var flatTypeId = {
      '1BHK': flatTypes[0].flatTypeId, '2BHK': flatTypes[1].flatTypeId,
      '3BHK': flatTypes[2].flatTypeId, 'PENTHOUSE': flatTypes[3].flatTypeId
    };

    seed('Vehicle_Types', [
      { typeKey: 'TWO_WHEELER', typeName: 'Two Wheeler', isChargeable: false, sortOrder: 1, status: 'ACTIVE' },
      { typeKey: 'CAR', typeName: 'Car', isChargeable: true, sortOrder: 2, status: 'ACTIVE' },
      { typeKey: 'SUV', typeName: 'SUV', isChargeable: true, sortOrder: 3, status: 'ACTIVE' },
      { typeKey: 'VAN', typeName: 'Van', isChargeable: true, sortOrder: 4, status: 'ACTIVE' }
    ]);

    var noticeTypes = seed('Notice_Types', [
      { typeKey: 'GENERAL', typeName: 'General Notice', requiresAttachment: false, sortOrder: 1, status: 'ACTIVE' },
      { typeKey: 'CIRCULAR', typeName: 'Circular', requiresAttachment: false, sortOrder: 2, status: 'ACTIVE' },
      { typeKey: 'AGM_SGM', typeName: 'AGM / SGM', requiresAttachment: true, sortOrder: 3, status: 'ACTIVE' },
      { typeKey: 'MAINTENANCE', typeName: 'Maintenance Notice', requiresAttachment: false, sortOrder: 4, status: 'ACTIVE' }
    ]);
    var noticeTypeKey = {};
    noticeTypes.forEach(function (t) { noticeTypeKey[t.typeKey] = t.noticeTypeId; });

    var visitorTypes = seed('Visitor_Types', [
      { typeKey: 'GUEST', typeName: 'Guest', requiresApproval: false, sortOrder: 1, status: 'ACTIVE' },
      { typeKey: 'DELIVERY', typeName: 'Delivery', requiresApproval: false, sortOrder: 2, status: 'ACTIVE' },
      { typeKey: 'SERVICE', typeName: 'Service Personnel', requiresApproval: true, sortOrder: 3, status: 'ACTIVE' },
      { typeKey: 'FAMILY', typeName: 'Family', requiresApproval: false, sortOrder: 4, status: 'ACTIVE' }
    ]);
    var visitorTypeKey = { GUEST: visitorTypes[0].visitorTypeId, DELIVERY: visitorTypes[1].visitorTypeId, SERVICE: visitorTypes[2].visitorTypeId, FAMILY: visitorTypes[3].visitorTypeId };

    var parkingTypes = seed('Parking_Types', [
      { typeKey: 'CAR', typeName: 'Car Parking', isChargeable: true, sortOrder: 1, status: 'ACTIVE' },
      { typeKey: 'TWO_WHEELER', typeName: 'Two Wheeler Parking', isChargeable: true, sortOrder: 2, status: 'ACTIVE' },
      { typeKey: 'VISITOR', typeName: 'Visitor Parking', isChargeable: false, sortOrder: 3, status: 'ACTIVE' }
    ]);
    var parkingTypeKey = { CAR: parkingTypes[0].parkingTypeId, TWO_WHEELER: parkingTypes[1].parkingTypeId, VISITOR: parkingTypes[2].parkingTypeId };

    var meetingTypes = seed('Meeting_Types', [
      { typeKey: 'AGM', typeName: 'Annual General Meeting', quorumPercent: 50, sortOrder: 1, status: 'ACTIVE' },
      { typeKey: 'SGM', typeName: 'Special General Meeting', quorumPercent: 40, sortOrder: 2, status: 'ACTIVE' },
      { typeKey: 'COMMITTEE', typeName: 'Committee Meeting', quorumPercent: 60, sortOrder: 3, status: 'ACTIVE' }
    ]);
    // NOTE: Meetings.meetingTypeKey stores a Meeting_Types.typeKey (e.g. 'AGM'), NOT the
    // meetingTypeId — CommunicationService's create validator and buildMeetingTypeMap both
    // look the type up by typeKey. A former `meetingTypeKey` map here held ids and was never
    // read; it has been removed so nobody copies it into a meeting record.

    var expenseCategories = seed('Expense_Categories', [
      { categoryKey: 'ELECTRICITY', categoryName: 'Electricity', description: 'Common area power', isSalaryCategory: false, sortOrder: 1, status: 'ACTIVE' },
      { categoryKey: 'WATER', categoryName: 'Water Supply', description: 'Water tanker & supply', isSalaryCategory: false, sortOrder: 2, status: 'ACTIVE' },
      { categoryKey: 'SALARY', categoryName: 'Staff Salary', description: 'Employee salaries', isSalaryCategory: true, sortOrder: 3, status: 'ACTIVE' },
      { categoryKey: 'REPAIRS', categoryName: 'Repairs & Maintenance', description: 'Building repairs', isSalaryCategory: false, sortOrder: 4, status: 'ACTIVE' },
      { categoryKey: 'HOUSEKEEPING', categoryName: 'Housekeeping', description: 'Cleaning supplies & services', isSalaryCategory: false, sortOrder: 5, status: 'ACTIVE' },
      { categoryKey: 'SECURITY', categoryName: 'Security Services', description: 'Guard services & equipment', isSalaryCategory: false, sortOrder: 6, status: 'ACTIVE' },
      { categoryKey: 'GARDENING', categoryName: 'Gardening', description: 'Garden maintenance', isSalaryCategory: false, sortOrder: 7, status: 'ACTIVE' },
      { categoryKey: 'INSURANCE', categoryName: 'Insurance', description: 'Society insurance premiums', isSalaryCategory: false, sortOrder: 8, status: 'ACTIVE' },
      { categoryKey: 'MISCELLANEOUS', categoryName: 'Miscellaneous', description: 'Other expenses', isSalaryCategory: false, sortOrder: 9, status: 'ACTIVE' }
    ]);
    var expCatKey = {};
    expenseCategories.forEach(function (c) { expCatKey[c.categoryKey] = c.categoryId; });

    var complaintCategories = seed('Complaint_Categories', [
      { categoryKey: 'PLUMBING', categoryName: 'Plumbing', defaultAssigneeType: 'EMPLOYEE', slaHours: 48, sortOrder: 1, status: 'ACTIVE' },
      { categoryKey: 'ELECTRICAL', categoryName: 'Electrical', defaultAssigneeType: 'EMPLOYEE', slaHours: 24, sortOrder: 2, status: 'ACTIVE' },
      { categoryKey: 'CARPENTRY', categoryName: 'Carpentry', defaultAssigneeType: 'VENDOR', slaHours: 72, sortOrder: 3, status: 'ACTIVE' },
      { categoryKey: 'CLEANING', categoryName: 'Cleaning', defaultAssigneeType: 'EMPLOYEE', slaHours: 24, sortOrder: 4, status: 'ACTIVE' },
      { categoryKey: 'PARKING', categoryName: 'Parking', defaultAssigneeType: 'EMPLOYEE', slaHours: 24, sortOrder: 5, status: 'ACTIVE' },
      { categoryKey: 'SECURITY', categoryName: 'Security', defaultAssigneeType: 'EMPLOYEE', slaHours: 12, sortOrder: 6, status: 'ACTIVE' },
      { categoryKey: 'WATER', categoryName: 'Water Supply', defaultAssigneeType: 'VENDOR', slaHours: 24, sortOrder: 7, status: 'ACTIVE' },
      { categoryKey: 'OTHER', categoryName: 'Other', defaultAssigneeType: 'MEMBER', slaHours: 96, sortOrder: 8, status: 'ACTIVE' }
    ]);
    var compCatKey = {};
    complaintCategories.forEach(function (c) { compCatKey[c.categoryKey] = c.categoryId; });

    var chargeTypes = seed('Charge_Types', [
      { chargeCode: 'MAINT', chargeName: 'Maintenance Charges', description: 'Monthly common area maintenance', calculationMethod: 'AREA', defaultAmount: 0, ratePerUnit: 2.5, unitLabel: 'sq ft', interestApplicable: true, sortOrder: 1, status: 'ACTIVE', effectiveFrom: '2020-04-01', effectiveTo: '' },
      { chargeCode: 'SINKING', chargeName: 'Sinking Fund', description: 'Long-term reserve fund', calculationMethod: 'FLAT', defaultAmount: 500, ratePerUnit: 0, unitLabel: '', interestApplicable: false, sortOrder: 2, status: 'ACTIVE', effectiveFrom: '2020-04-01', effectiveTo: '' },
      { chargeCode: 'PARKING', chargeName: 'Parking Charges', description: 'Allocated parking slot charge', calculationMethod: 'FLAT', defaultAmount: 300, ratePerUnit: 0, unitLabel: '', interestApplicable: true, sortOrder: 3, status: 'ACTIVE', effectiveFrom: '2020-04-01', effectiveTo: '' },
      { chargeCode: 'NONOCC', chargeName: 'Non-Occupancy Charges', description: 'Charged when flat is let out', calculationMethod: 'FLAT', defaultAmount: 1000, ratePerUnit: 0, unitLabel: '', interestApplicable: false, sortOrder: 4, status: 'ACTIVE', effectiveFrom: '2020-04-01', effectiveTo: '' }
    ]);
    var chargeByCode = {};
    chargeTypes.forEach(function (c) { chargeByCode[c.chargeCode] = c; });

    seed('Charge_Rates', [
      { chargeTypeId: chargeByCode.MAINT.chargeTypeId, amount: 0, ratePerUnit: 2.5, effectiveFrom: '2024-04-01', effectiveTo: '', remarks: 'Standard maintenance rate', status: 'ACTIVE' },
      { chargeTypeId: chargeByCode.SINKING.chargeTypeId, amount: 500, ratePerUnit: 0, effectiveFrom: '2024-04-01', effectiveTo: '', remarks: 'Flat sinking fund', status: 'ACTIVE' },
      { chargeTypeId: chargeByCode.PARKING.chargeTypeId, amount: 300, ratePerUnit: 0, effectiveFrom: '2024-04-01', effectiveTo: '', remarks: 'Per allocated slot', status: 'ACTIVE' }
    ]);

    var interestRules = seed('Interest_Rules', [
      { ruleName: 'Default Late Interest', ratePercent: 18, compoundMethod: 'SIMPLE', frequency: 'MONTHLY', graceDays: 10, minAmount: 50, roundTo: 1, isDefault: true, status: 'ACTIVE', remarks: 'Default interest rule for overdue demands' }
    ]);

    // ---- flats, members, family, vehicles -----------------------------------
    var typeArea = {
      '1BHK': { carpet: 500, built: 650 },
      '2BHK': { carpet: 750, built: 950 },
      '3BHK': { carpet: 1050, built: 1350 },
      'PENTHOUSE': { carpet: 1650, built: 2100 }
    };
    var flatDefs = [
      ['A', '101', '1BHK', 'Amit Sharma', 'OWNER'],
      ['A', '102', '1BHK', 'Priya Patel', 'OWNER'],
      ['A', '201', '2BHK', 'Rahul Mehta', 'OWNER'],
      ['A', '202', '2BHK', 'Sneha Kulkarni', 'TENANT'],
      ['A', '301', '3BHK', 'Vikram Singh', 'OWNER'],
      ['A', '302', '3BHK', null, 'VACANT'],
      ['B', '101', '1BHK', 'Kiran Rao', 'OWNER'],
      ['B', '102', '1BHK', 'Manoj Joshi', 'TENANT'],
      ['B', '201', '2BHK', 'Deepak Nair', 'OWNER'],
      ['B', '202', '2BHK', 'Ritu Agarwal', 'OWNER'],
      ['B', '301', '3BHK', 'Suresh Reddy', 'OWNER'],
      ['C', '101', '2BHK', 'Neha Gupta', 'OWNER'],
      ['C', '102', '2BHK', 'Arjun Pillai', 'TENANT'],
      ['C', '201', '3BHK', 'Meera Iyer', 'OWNER'],
      ['C', '301', '3BHK', null, 'UNDER_MAINTENANCE'],
      ['C', '401', 'PENTHOUSE', 'Ananya Sen', 'OWNER']
    ];

    var flatList = [];
    var primaryByFlat = {};
    flatDefs.forEach(function (fd, i) {
      var wing = fd[0], num = fd[1], type = fd[2], name = fd[3], occ = fd[4];
      var area = typeArea[type];
      var statusKey = occ === 'VACANT' ? 'VACANT' : (occ === 'UNDER_MAINTENANCE' ? 'UNDER_MAINTENANCE' : 'OCCUPIED');
      var flatRec = Repository.insert('Flats', {
        wingId: wingByCode[wing],
        flatNumber: num,
        floor: parseInt(num.charAt(0), 10),
        flatTypeId: flatTypeId[type],
        carpetArea: area.carpet,
        builtUpArea: area.built,
        statusKey: statusKey,
        occupancyType: name ? (occ === 'TENANT' ? 'TENANT' : 'SELF') : '',
        sortOrder: i + 1,
        remarks: ''
      }, actor);
      counts.Flats = (counts.Flats || 0) + 1;
      flatList.push({
        flatId: flatRec.flatId,
        flatNumber: wing + '-' + num,
        wingId: wingByCode[wing],
        area: area.built,
        statusKey: statusKey,
        occupant: name,
        relation: occ
      });

      if (name) {
        var code = 'MBR-' + pad5(i + 1);
        var mem = Repository.insert('Members', {
          flatId: flatRec.flatId,
          memberCode: code,
          fullName: name,
          relationType: occ === 'TENANT' ? 'TENANT' : 'OWNER',
          isPrimary: true,
          mobile: '98' + (20000000 + i * 137 + 1000),
          altMobile: '',
          email: name.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.com',
          address: 'Flat ' + wing + '-' + num + ', Sunrise Residency',
          moveInDate: '2021-04-01',
          moveOutDate: '',
          dateOfBirth: '19' + (75 + (i % 15)) + '-0' + (1 + (i % 9)) + '-1' + (i % 9),
          gender: (i % 2 === 0) ? 'MALE' : 'FEMALE',
          emergencyName: name.split(' ')[0] + "'s Family",
          emergencyMobile: '99' + (10000000 + i * 211),
          idProofType: (i % 2 === 0) ? 'AADHAR' : 'PAN',
          idProofNumber: 'A' + (100000000000 + i * 99991),
          statusKey: 'ACTIVE',
          notes: ''
        }, actor);
        counts.Members = (counts.Members || 0) + 1;
        primaryByFlat[flatRec.flatId] = mem.memberId;
      }
    });

    // family members for a subset of members
    var famSeedIdx = [0, 1, 3, 6, 9, 12, 15];
    famSeedIdx.forEach(function (i) {
      var fd = flatDefs[i];
      if (!fd[3]) { return; }
      var flatId = flatList[i].flatId;
      var memberId = primaryByFlat[flatId];
      Repository.insertMany('Family_Members', [
        { memberId: memberId, flatId: flatId, fullName: fd[3].split(' ')[0] + ' Spouse', relation: 'SPOUSE', dateOfBirth: '1980-06-10', gender: 'FEMALE', mobile: '97' + (10000000 + i * 313), occupation: 'Professional', statusKey: 'ACTIVE' },
        { memberId: memberId, flatId: flatId, fullName: 'Child ' + (i + 1), relation: 'CHILD', dateOfBirth: '2010-02-0' + (1 + (i % 9)), gender: 'MALE', mobile: '', occupation: 'Student', statusKey: 'ACTIVE' }
      ], actor);
      counts.Family_Members = (counts.Family_Members || 0) + 2;
    });

    // vehicles for a subset of flats
    var vehDefs = [
      [0, 'CAR', 'MH02AB' + (1234), 'Honda City', 'White'],
      [1, 'TWO_WHEELER', 'MH02CD' + (5678), 'Activa 6G', 'Grey'],
      [4, 'SUV', 'MH02EF' + (9012), 'Toyota Innova', 'Silver'],
      [6, 'CAR', 'MH02GH' + (3456), 'Maruti Swift', 'Red'],
      [9, 'TWO_WHEELER', 'MH02IJ' + (7890), 'TVS Jupiter', 'Blue'],
      [11, 'CAR', 'MH02KL' + (1122), 'Hyundai Creta', 'White'],
      [15, 'SUV', 'MH02MN' + (3344), 'Mahindra XUV700', 'Black']
    ];
    var vehicleByFlat = {};
    vehDefs.forEach(function (v) {
      var i = v[0];
      var flatId = flatList[i].flatId;
      if (!primaryByFlat[flatId]) { return; }
      var rec = Repository.insert('Vehicles', {
        memberId: primaryByFlat[flatId],
        flatId: flatId,
        vehicleTypeKey: v[1],
        vehicleNumber: String(v[2]),
        makeModel: v[3],
        colour: v[4],
        statusKey: 'ACTIVE'
      }, actor);
      counts.Vehicles = (counts.Vehicles || 0) + 1;
      vehicleByFlat[flatId] = rec.vehicleId;
    });

    // ---- employees, vendors, AMC --------------------------------------------
    var empTypes = Repository.readSheet('Employee_Types', { pageSize: 100 }).rows;
    var empTypeId = {};
    empTypes.forEach(function (t) { empTypeId[t.typeKey] = t.employeeTypeId; });

    var employees = seed('Employees', [
      { employeeCode: 'EMP-001', fullName: 'Ramesh Yadav', employeeTypeId: empTypeId.SECURITY, mobile: '9811110001', altMobile: '', email: 'ramesh.y@example.com', address: 'Mumbai', joinDate: '2021-01-15', exitDate: '', monthlySalary: 18000, statusKey: 'ACTIVE', bankName: 'SBI', bankAccount: '001122334455', ifsc: 'SBIN0001234', emergencyName: 'Sunita Yadav', emergencyMobile: '9811110002', idProofType: 'AADHAR', idProofNumber: 'A111122223333', notes: '' },
      { employeeCode: 'EMP-002', fullName: 'Mahesh Kumar', employeeTypeId: empTypeId.SECURITY, mobile: '9811110003', altMobile: '', email: 'mahesh.k@example.com', address: 'Mumbai', joinDate: '2021-03-01', exitDate: '', monthlySalary: 17500, statusKey: 'ACTIVE', bankName: 'HDFC', bankAccount: '004455667788', ifsc: 'HDFC0001234', emergencyName: 'Rekha Kumar', emergencyMobile: '9811110004', idProofType: 'AADHAR', idProofNumber: 'A444455556666', notes: '' },
      { employeeCode: 'EMP-003', fullName: 'Sunita Devi', employeeTypeId: empTypeId.HOUSEKEEPING, mobile: '9811110005', altMobile: '', email: 'sunita.d@example.com', address: 'Mumbai', joinDate: '2022-06-10', exitDate: '', monthlySalary: 15000, statusKey: 'ACTIVE', bankName: 'PNB', bankAccount: '007788990011', ifsc: 'PUNB0001234', emergencyName: 'Mohan Devi', emergencyMobile: '9811110006', idProofType: 'AADHAR', idProofNumber: 'A777788889999', notes: '' },
      { employeeCode: 'EMP-004', fullName: 'Laxmi Bai', employeeTypeId: empTypeId.HOUSEKEEPING, mobile: '9811110007', altMobile: '', email: 'laxmi.b@example.com', address: 'Mumbai', joinDate: '2022-08-01', exitDate: '', monthlySalary: 14500, statusKey: 'ACTIVE', bankName: 'BOB', bankAccount: '009900112233', ifsc: 'BARB0001234', emergencyName: 'Raju Bai', emergencyMobile: '9811110008', idProofType: 'AADHAR', idProofNumber: 'A222233334444', notes: '' },
      { employeeCode: 'EMP-005', fullName: 'Rajesh Verma', employeeTypeId: empTypeId.MAINTENANCE, mobile: '9811110009', altMobile: '', email: 'rajesh.v@example.com', address: 'Mumbai', joinDate: '2020-11-20', exitDate: '', monthlySalary: 22000, statusKey: 'ACTIVE', bankName: 'ICICI', bankAccount: '001133557799', ifsc: 'ICIC0001234', emergencyName: 'Kavita Verma', emergencyMobile: '9811110010', idProofType: 'AADHAR', idProofNumber: 'A555566667777', notes: '' }
    ]);

    var vendors = seed('Vendors', [
      { vendorName: 'CleanPro Services', categoryKey: 'HOUSEKEEPING', contactPerson: 'Sanjay Gupta', mobile: '9822220001', altMobile: '', email: 'hello@cleanpro.example', address: 'Mumbai', gstNumber: '27ABCDE1234F1Z5', panNumber: 'ABCDE1234F', bankName: 'Axis', bankAccount: '010203040506', ifsc: 'UTIB0001234', statusKey: 'ACTIVE', notes: '' },
      { vendorName: 'SecureTech Guarding', categoryKey: 'SECURITY', contactPerson: 'Vinod Rao', mobile: '9822220002', altMobile: '', email: 'ops@securetech.example', address: 'Mumbai', gstNumber: '27FGHIJ5678K1Z2', panNumber: 'FGHIJ5678K', bankName: 'SBI', bankAccount: '060708091011', ifsc: 'SBIN0005678', statusKey: 'ACTIVE', notes: '' },
      { vendorName: 'GreenGarden Landscaping', categoryKey: 'GARDENING', contactPerson: 'Farhan Sheikh', mobile: '9822220003', altMobile: '', email: 'care@greengarden.example', address: 'Mumbai', gstNumber: '27KLMNO9012P1Z3', panNumber: 'KLMNO9012P', bankName: 'HDFC', bankAccount: '020304050607', ifsc: 'HDFC0005678', statusKey: 'ACTIVE', notes: '' }
    ]);

    seed('Vendors_AMC', [
      { vendorId: vendors[0].vendorId, title: 'Housekeeping AMC 2026', description: 'Daily housekeeping & consumables', categoryKey: 'HOUSEKEEPING', startDate: '2026-04-01', endDate: '2027-03-31', amount: 180000, paymentFrequencyKey: 'MONTHLY', renewalReminderDays: 30, documentId: '', statusKey: 'ACTIVE', remarks: '' },
      { vendorId: vendors[1].vendorId, title: 'Security AMC 2026', description: 'Round-the-clock guarding', categoryKey: 'SECURITY', startDate: '2026-04-01', endDate: '2027-03-31', amount: 300000, paymentFrequencyKey: 'MONTHLY', renewalReminderDays: 30, documentId: '', statusKey: 'ACTIVE', remarks: '' }
    ]);

    // ---- flat charges --------------------------------------------------------
    flatList.forEach(function (f) {
      if (f.statusKey !== 'OCCUPIED') { return; }
      Repository.insertMany('Flat_Charges', [
        { flatId: f.flatId, chargeTypeId: chargeByCode.MAINT.chargeTypeId, isActive: true, amountOverride: 0, effectiveFrom: '2020-04-01', effectiveTo: '', remarks: '' },
        { flatId: f.flatId, chargeTypeId: chargeByCode.SINKING.chargeTypeId, isActive: true, amountOverride: 0, effectiveFrom: '2020-04-01', effectiveTo: '', remarks: '' }
      ], actor);
      counts.Flat_Charges = (counts.Flat_Charges || 0) + 2;
    });

    // ---- parking slots & allocations -----------------------------------------
    var slots = [];
    var slotDefs = [
      ['P-01', 'CAR', 'A', 'B1', 'Basement 1'],
      ['P-02', 'CAR', 'A', 'B1', 'Basement 1'],
      ['P-03', 'CAR', 'B', 'B1', 'Basement 1'],
      ['P-04', 'CAR', 'B', 'B1', 'Basement 1'],
      ['P-05', 'CAR', 'C', 'B2', 'Basement 2'],
      ['P-06', 'TWO_WHEELER', 'A', 'G', 'Ground level'],
      ['P-07', 'TWO_WHEELER', 'B', 'G', 'Ground level'],
      ['P-08', 'TWO_WHEELER', 'C', 'G', 'Ground level'],
      ['P-09', 'VISITOR', 'A', 'G', 'Visitor bay'],
      ['P-10', 'VISITOR', 'B', 'G', 'Visitor bay']
    ];
    slotDefs.forEach(function (s) {
      var rec = Repository.insert('Parking_Slots', {
        slotNumber: s[0], parkingTypeId: parkingTypeKey[s[1]], wingId: wingByCode[s[2]], floorLevel: s[3], location: s[4], statusKey: 'AVAILABLE', remarks: ''
      }, actor);
      counts.Parking_Slots = (counts.Parking_Slots || 0) + 1;
      slots.push({ slot: rec, type: s[1], slotNumber: s[0] });
    });

    var parkingChargedFlats = [];
    var slotIdx = 0;
    [0, 4, 6, 11, 15, 1].forEach(function (i) {
      var flatId = flatList[i].flatId;
      if (!primaryByFlat[flatId]) { return; }
      var s = slots[slotIdx++];
      var vehId = vehicleByFlat[flatId] || '';
      var vehNum = '';
      if (vehId) {
        var v = Repository.findById('Vehicles', vehId);
        vehNum = v ? v.vehicleNumber : '';
      }
      Repository.insert('Parking_Allocations', {
        parkingSlotId: s.slot.parkingSlotId, flatId: flatId, memberId: primaryByFlat[flatId], vehicleId: vehId, vehicleNumber: vehNum,
        allocationType: 'PERMANENT', startDate: '2021-04-01', endDate: '', monthlyCharge: 300, statusKey: 'ACTIVE', remarks: ''
      }, actor);
      counts.Parking_Allocations = (counts.Parking_Allocations || 0) + 1;
      parkingChargedFlats.push(flatId);
      Repository.updateById('Parking_Slots', s.slot.parkingSlotId, { statusKey: 'ALLOCATED' }, actor);
    });

    // ---- billing periods, demands, payments, ledger, receipts -----------------
    function flatChargeAmount(f) {
      var maint = Utils.round2(f.area * 2.5);
      var sinking = 500;
      var parking = parkingChargedFlats.indexOf(f.flatId) !== -1 ? 300 : 0;
      return { maint: maint, sinking: sinking, parking: parking, total: Utils.round2(maint + sinking + parking) };
    }

    var dmdSeq = 1, paySeq = 1;
    var flatLedger = {};
    function ledgerEntry(flatId, memberId, entryDate, periodKey, entryType, refType, refId, refNumber, debit, credit, narration) {
      var bal = flatLedger[flatId] || 0;
      bal = Utils.round2(bal + debit - credit);
      flatLedger[flatId] = bal;
      Repository.insert('Ledger', {
        entryDate: entryDate, periodKey: periodKey, flatId: flatId, memberId: memberId, entryType: entryType,
        refType: refType, refId: refId, refNumber: refNumber, debitAmount: debit, creditAmount: credit,
        runningBalance: bal, narration: narration
      }, actor);
      counts.Ledger = (counts.Ledger || 0) + 1;
    }

    var demandByPeriodFlat = {};
    [prevPeriod, curPeriod].forEach(function (periodKey, pIdx) {
      var isPrev = pIdx === 0;
      var periodRec = Repository.insert('Billing_Periods', {
        periodKey: periodKey,
        periodFrom: periodKey + '-01',
        periodTo: periodKey + '-28',
        financialYear: fy,
        dueDate: periodAdd(periodKey, 1) + '-' + pad2(CONFIG.num('billingDueDay') || 10),
        statusKey: isPrev ? 'LOCKED' : 'GENERATED',
        generatedAt: ts, generatedBy: 'SYSTEM', lockedAt: isPrev ? ts : '', lockedBy: isPrev ? 'SYSTEM' : '', remarks: ''
      }, actor);
      counts.Billing_Periods = (counts.Billing_Periods || 0) + 1;
      var periodId = periodRec.periodId;

      var demandRows = [];
      var payFlatIdx = 0;
      flatList.forEach(function (f) {
        if (f.statusKey !== 'OCCUPIED') { return; }
        var memberId = primaryByFlat[f.flatId];
        var amt = flatChargeAmount(f);
        var charges = [
          { code: 'MAINT', amount: amt.maint, basis: f.area, qty: f.area },
          { code: 'SINKING', amount: amt.sinking, basis: 0, qty: 0 }
        ];
        if (amt.parking > 0) { charges.push({ code: 'PARKING', amount: amt.parking, basis: 0, qty: 0 }); }

        var flatDemandIds = [];
        var totalForFlat = Utils.round2(amt.total);
        charges.forEach(function (c) {
          var ct = chargeByCode[c.code];
          var amount = c.amount;
          // determine payment status
          var payStatus;
          var paid = 0;
          if (isPrev) {
            payStatus = 'PAID'; paid = amount;
          } else {
            // current period: some paid, some partial, most pending
            if (payFlatIdx < 4) { payStatus = 'PAID'; paid = amount; }
            else if (payFlatIdx < 7) { payStatus = 'PARTIAL'; paid = Utils.round2(amount * 0.6); }
            else { payStatus = 'PENDING'; paid = 0; }
          }
          var rec = {
            demandNumber: 'DM-' + fy + '-' + pad5(dmdSeq++),
            periodId: periodId, periodKey: periodKey, flatId: f.flatId, memberId: memberId,
            chargeTypeId: ct.chargeTypeId,
            chargeNameSnapshot: ct.chargeName,
            calculationMethodSnapshot: ct.calculationMethod,
            rateSnapshot: ct.ratePerUnit,
            basisSnapshot: c.basis,
            quantitySnapshot: c.qty,
            amount: amount,
            previousDueAmount: 0,
            interestAmount: 0,
            adjustmentAmount: 0,
            totalPayable: amount,
            paidAmount: paid,
            balanceAmount: Utils.round2(amount - paid),
            statusKey: payStatus,
            dueDate: periodAdd(periodKey, 1) + '-' + pad2(CONFIG.num('billingDueDay') || 10),
            isCarriedForward: false,
            generatedAt: ts, generatedBy: 'SYSTEM',
            cancelledAt: '', cancelledBy: '', cancelReason: '', remarks: ''
          };
          demandRows.push(rec);
          flatDemandIds.push({ demand: rec, code: c.code });
        });

        demandByPeriodFlat[periodKey + '|' + f.flatId] = flatDemandIds;
        payFlatIdx++;
      });

      var createdDemands = Repository.insertMany('Demands', demandRows, actor);
      counts.Demands = (counts.Demands || 0) + createdDemands.length;
      // remap ids onto demand records
      createdDemands.forEach(function (d) {
        demandByPeriodFlat[d.periodKey + '|' + d.flatId].forEach(function (x) {
          if (x.demand.demandNumber === d.demandNumber) { x.demand = d; }
        });
      });

      // ledger demand entries
      flatList.forEach(function (f) {
        if (f.statusKey !== 'OCCUPIED') { return; }
        var memberId = primaryByFlat[f.flatId];
        var list = demandByPeriodFlat[periodKey + '|' + f.flatId] || [];
        list.forEach(function (x) {
          ledgerEntry(f.flatId, memberId, ts, periodKey, 'DEMAND', 'Demands', x.demand.demandId, x.demand.demandNumber, x.demand.amount, 0, 'Demand ' + x.code);
        });
      });

      // payments (prev period: all; current: subset)
      var paymentDefs = [];
      flatList.forEach(function (f, fi) {
        if (f.statusKey !== 'OCCUPIED') { return; }
        var memberId = primaryByFlat[f.flatId];
        var list = demandByPeriodFlat[periodKey + '|' + f.flatId] || [];
        var paidList = list.filter(function (x) { return x.demand.paidAmount > 0; });
        if (paidList.length === 0) { return; }
        var totalPaid = Utils.round2(paidList.reduce(function (s, x) { return s + x.demand.paidAmount; }, 0));
        paymentDefs.push({ flat: f, memberId: memberId, list: paidList, amount: totalPaid, index: fi });
      });

      paymentDefs.forEach(function (p) {
        var payRec = Repository.insert('Payments', {
          receiptNumber: 'RCP-' + fy + '-' + pad5(paySeq++),
          paymentDate: ts.slice(0, 10),
          flatId: p.flat.flatId, memberId: p.memberId,
          amount: p.amount, allocatedAmount: p.amount, unallocatedAmount: 0,
          paymentModeKey: (p.index % 3 === 0) ? 'UPI' : ((p.index % 3 === 1) ? 'CASH' : 'NEFT'),
          referenceNumber: (p.index % 3 === 0) ? 'UPI' + (1000000 + p.index) : '',
          bankName: '', remarks: '', statusKey: 'POSTED',
          receivedBy: 'SYSTEM', receivedAt: ts,
          cancelledAt: '', cancelledBy: '', cancelReason: '', reversedFromPaymentId: '', attachmentRef: ''
        }, actor);
        counts.Payments = (counts.Payments || 0) + 1;

        p.list.forEach(function (x) {
          Repository.insert('Payment_Allocations', {
            paymentId: payRec.paymentId, demandId: x.demand.demandId, periodKey: x.demand.periodKey, flatId: p.flat.flatId, amount: x.demand.paidAmount
          }, actor);
          counts.Payment_Allocations = (counts.Payment_Allocations || 0) + 1;
        });

        Repository.insert('Receipts', {
          receiptNumber: payRec.receiptNumber, paymentId: payRec.paymentId, flatId: p.flat.flatId, memberId: p.memberId,
          amount: p.amount, paymentDate: ts.slice(0, 10), issuedAt: ts, issuedBy: 'SYSTEM',
          templateKey: 'DEFAULT', driveFileId: '', printCount: 0, lastPrintedAt: '', statusKey: 'POSTED'
        }, actor);
        counts.Receipts = (counts.Receipts || 0) + 1;

        ledgerEntry(p.flat.flatId, p.memberId, ts, periodKey, 'PAYMENT', 'Payments', payRec.paymentId, payRec.receiptNumber, 0, p.amount, 'Payment received');
      });
    });

    // ---- adjustments ---------------------------------------------------------
    var adjFlat = flatList[0];
    var adjDemands = demandByPeriodFlat[curPeriod + '|' + adjFlat.flatId] || [];
    if (adjDemands.length > 0) {
      var adjDemand = adjDemands[0].demand;
      Repository.insert('Adjustments', {
        flatId: adjFlat.flatId, memberId: primaryByFlat[adjFlat.flatId], demandId: adjDemand.demandId, periodKey: curPeriod,
        adjustmentType: 'INTEREST_WAIVER', amount: 50, sign: -1, reason: 'Goodwill waiver for first-time late payment',
        approvedBy: 'SYSTEM', approvedAt: ts, statusKey: 'ACTIVE', attachmentRef: ''
      }, actor);
      counts.Adjustments = 1;
      ledgerEntry(adjFlat.flatId, primaryByFlat[adjFlat.flatId], ts, curPeriod, 'WAIVER', 'Adjustments', 'ADJ-1', '', 0, 50, 'Interest waiver');
    }

    // ---- expenses ------------------------------------------------------------
    seed('Expenses', [
      { expenseNumber: 'EXP-' + fy + '-00001', expenseDate: prevPeriod + '-05', periodKey: prevPeriod, categoryId: expCatKey.ELECTRICITY, description: 'Common area electricity bill', vendorId: '', payeeName: 'Adani Electricity', amount: 24500, paymentModeKey: 'NEFT', referenceNumber: 'ELEC-001', paidBy: 'SYSTEM', attachmentRef: '', remarks: '', statusKey: 'POSTED', cancelledAt: '', cancelledBy: '', cancelReason: '' },
      { expenseNumber: 'EXP-' + fy + '-00002', expenseDate: prevPeriod + '-12', periodKey: prevPeriod, categoryId: expCatKey.WATER, description: 'Water tanker supply', vendorId: '', payeeName: 'Mumbai Water Works', amount: 8200, paymentModeKey: 'CASH', referenceNumber: '', paidBy: 'SYSTEM', attachmentRef: '', remarks: '', statusKey: 'POSTED', cancelledAt: '', cancelledBy: '', cancelReason: '' },
      { expenseNumber: 'EXP-' + fy + '-00003', expenseDate: curPeriod + '-02', periodKey: curPeriod, categoryId: expCatKey.HOUSEKEEPING, description: 'Housekeeping consumables', vendorId: vendors[0].vendorId, payeeName: vendors[0].vendorName, amount: 13500, paymentModeKey: 'NEFT', referenceNumber: 'HSK-001', paidBy: 'SYSTEM', attachmentRef: '', remarks: '', statusKey: 'POSTED', cancelledAt: '', cancelledBy: '', cancelReason: '' },
      { expenseNumber: 'EXP-' + fy + '-00004', expenseDate: curPeriod + '-10', periodKey: curPeriod, categoryId: expCatKey.GARDENING, description: 'Garden plants and fertilizer', vendorId: vendors[2].vendorId, payeeName: vendors[2].vendorName, amount: 4600, paymentModeKey: 'UPI', referenceNumber: 'GRD-001', paidBy: 'SYSTEM', attachmentRef: '', remarks: '', statusKey: 'POSTED', cancelledAt: '', cancelledBy: '', cancelReason: '' }
    ]);

    // ---- complaints & updates ------------------------------------------------
    var complaintDefs = [
      { title: 'Water leakage in lobby', category: 'PLUMBING', priority: 'HIGH', flatIdx: 1, status: 'IN_PROGRESS', source: 'WEB', assign: 'EMPLOYEE', assignId: employees[4].employeeId },
      { title: 'Lift not working', category: 'ELECTRICAL', priority: 'CRITICAL', flatIdx: 4, status: 'ASSIGNED', source: 'WEB', assign: 'VENDOR', assignId: vendors[1].vendorId },
      { title: 'Stray dog in society', category: 'SECURITY', priority: 'MEDIUM', flatIdx: 6, status: 'RESOLVED', source: 'PHONE', assign: 'EMPLOYEE', assignId: employees[0].employeeId },
      { title: 'Parking dispute in B wing', category: 'PARKING', priority: 'LOW', flatIdx: 9, status: 'CLOSED', source: 'WATCHMAN', assign: 'MEMBER', assignId: '' },
      { title: 'Garbage collection delay', category: 'CLEANING', priority: 'MEDIUM', flatIdx: 11, status: 'OPEN', source: 'WEB', assign: 'NONE', assignId: '' }
    ];

    complaintDefs.forEach(function (c) {
      var flatId = flatList[c.flatIdx].flatId;
      var memberId = primaryByFlat[flatId];
      var rec = Repository.insert('Complaints', {
        complaintNumber: 'CMP-' + fy + '-' + pad5(counts.Complaints + 1 || 1),
        categoryId: compCatKey[c.category], priorityKey: c.priority, title: c.title,
        description: c.title + ' reported by resident.', flatId: flatId, memberId: memberId, raisedByMemberId: memberId,
        raisedAt: ts, source: c.source, statusKey: c.status,
        assignedToType: c.assign, assignedToId: c.assignId, assignedAt: (c.assign !== 'NONE') ? ts : '',
        assignedBy: (c.assign !== 'NONE') ? 'SYSTEM' : '',
        targetDate: (c.assign !== 'NONE') ? periodAdd(curPeriod, 1) + '-01' : '',
        resolvedAt: (c.status === 'RESOLVED' || c.status === 'CLOSED') ? ts : '',
        closedAt: c.status === 'CLOSED' ? ts : '', closedBy: c.status === 'CLOSED' ? 'SYSTEM' : '',
        correctiveAction: '', resolutionRemarks: (c.status === 'RESOLVED' || c.status === 'CLOSED') ? 'Issue addressed.' : '',
        attachmentRef: '', reopenCount: 0
      }, actor);
      counts.Complaints = (counts.Complaints || 0) + 1;

      Repository.insertMany('Complaint_Updates', [
        { complaintId: rec.complaintId, statusKey: c.status, remarks: 'Initial report logged', correctiveAction: '', actionTakenByType: 'MEMBER', actionTakenById: memberId, actionTakenAt: ts, attachmentRef: '' }
      ], actor);
      counts.Complaint_Updates = (counts.Complaint_Updates || 0) + 1;
    });

    // ---- visitors ------------------------------------------------------------
    seed('Visitors', [
      { passNumber: 'VIS-0001', visitorName: 'Rohit Sharma', mobile: '9833330001', visitorTypeId: visitorTypeKey.GUEST, purpose: 'Visiting family', flatId: flatList[0].flatId, memberId: primaryByFlat[flatList[0].flatId], residentName: flatList[0].occupant, vehicleNumber: '', personCount: 2, entryAt: ts, exitAt: '', entryGate: 'Main', exitGate: '', statusKey: 'INSIDE', remarks: '', attachmentRef: '', loggedByUserId: 'SYSTEM', loggedByEmployeeId: employees[0].employeeId },
      { passNumber: 'VIS-0002', visitorName: 'Amazon Delivery', mobile: '9833330002', visitorTypeId: visitorTypeKey.DELIVERY, purpose: 'Package delivery', flatId: flatList[1].flatId, memberId: primaryByFlat[flatList[1].flatId], residentName: flatList[1].occupant, vehicleNumber: '', personCount: 1, entryAt: ts, exitAt: ts, entryGate: 'Main', exitGate: 'Main', statusKey: 'EXITED', remarks: '', attachmentRef: '', loggedByUserId: 'SYSTEM', loggedByEmployeeId: employees[0].employeeId },
      { passNumber: 'VIS-0003', visitorName: 'AC Service Team', mobile: '9833330003', visitorTypeId: visitorTypeKey.SERVICE, purpose: 'AC maintenance', flatId: flatList[4].flatId, memberId: primaryByFlat[flatList[4].flatId], residentName: flatList[4].occupant, vehicleNumber: 'MH02SV1234', personCount: 2, entryAt: ts, exitAt: '', entryGate: 'Side', exitGate: '', statusKey: 'INSIDE', remarks: 'Approved by resident', attachmentRef: '', loggedByUserId: 'SYSTEM', loggedByEmployeeId: employees[1].employeeId },
      { passNumber: 'VIS-0004', visitorName: 'Meena Iyer', mobile: '9833330004', visitorTypeId: visitorTypeKey.FAMILY, purpose: 'Family visit', flatId: flatList[12].flatId, memberId: primaryByFlat[flatList[12].flatId], residentName: flatList[12].occupant, vehicleNumber: '', personCount: 3, entryAt: ts, exitAt: ts, entryGate: 'Main', exitGate: 'Main', statusKey: 'EXITED', remarks: '', attachmentRef: '', loggedByUserId: 'SYSTEM', loggedByEmployeeId: employees[1].employeeId }
    ]);

    // ---- notices --------------------------------------------------------------
    seed('Notices', [
      { noticeNumber: 'NOT-' + fy + '-00001', title: 'Annual maintenance charges due', noticeTypeId: noticeTypeKey.MAINTENANCE, noticeDate: curPeriod + '-01', publishDate: curPeriod + '-01', expiryDate: periodAdd(curPeriod, 1) + '-01', description: 'All residents are requested to pay maintenance dues before the due date.', audienceType: 'ALL', audienceRef: '', isPublished: true, publishedAt: ts, publishedBy: 'SYSTEM', unpublishReason: '', isPinned: true, attachmentRef: '', statusKey: 'PUBLISHED' },
      { noticeNumber: 'NOT-' + fy + '-00002', title: 'AGM 2026-27', noticeTypeId: noticeTypeKey.AGM_SGM, noticeDate: prevPeriod + '-15', publishDate: prevPeriod + '-15', expiryDate: curPeriod + '-28', description: 'The Annual General Meeting will be held to approve accounts.', audienceType: 'ALL', audienceRef: '', isPublished: true, publishedAt: ts, publishedBy: 'SYSTEM', unpublishReason: '', isPinned: false, attachmentRef: '', statusKey: 'PUBLISHED' },
      { noticeNumber: 'NOT-' + fy + '-00003', title: 'Water supply interruption', noticeTypeId: noticeTypeKey.GENERAL, noticeDate: curPeriod + '-05', publishDate: '', expiryDate: curPeriod + '-10', description: 'Water supply will be interrupted for maintenance work.', audienceType: 'ALL', audienceRef: '', isPublished: false, publishedAt: '', publishedBy: '', unpublishReason: '', isPinned: false, attachmentRef: '', statusKey: 'DRAFT' }
    ]);

    // ---- meetings & attendance -------------------------------------------------
    var meetings = [
      { meetingNumber: 'MTG-' + fy + '-00001', typeKey: 'COMMITTEE', title: 'Monthly Committee Meeting', date: prevPeriod + '-15', status: 'COMPLETED', venue: 'Club House', quorumRequired: 6, quorumPresent: 7 },
      { meetingNumber: 'MTG-' + fy + '-00002', typeKey: 'AGM', title: 'Annual General Meeting 2026-27', date: curPeriod + '-20', status: 'SCHEDULED', venue: 'Community Hall', quorumRequired: 10, quorumPresent: 0 }
    ];
    meetings.forEach(function (m) {
      var rec = Repository.insert('Meetings', {
        meetingNumber: m.meetingNumber, meetingTypeKey: m.typeKey, title: m.title, meetingDate: m.date,
        startTime: '10:00', endTime: '12:00', venue: m.venue, agenda: 'Review of society affairs and finances.',
        minutes: (m.status === 'COMPLETED') ? 'Minutes approved.' : '', resolutions: (m.status === 'COMPLETED') ? 'Budget approved.' : '',
        quorumRequired: m.quorumRequired, quorumPresent: m.quorumPresent, conductedBy: 'SYSTEM',
        statusKey: m.status, linkedDocumentIds: ''
      }, actor);
      counts.Meetings = (counts.Meetings || 0) + 1;
      var attendees = [];
      flatList.slice(0, 6).forEach(function (f) {
        if (!primaryByFlat[f.flatId]) { return; }
        attendees.push({
          meetingId: rec.meetingId, attendeeType: 'MEMBER', attendeeId: primaryByFlat[f.flatId], attendeeName: f.occupant,
          flatId: f.flatId, roleInMeeting: 'MEMBER', isPresent: (m.status === 'COMPLETED') ? true : true, remarks: ''
        });
      });
      Repository.insertMany('Meeting_Attendance', attendees, actor);
      counts.Meeting_Attendance = (counts.Meeting_Attendance || 0) + attendees.length;
    });

    // ---- documents ------------------------------------------------------------
    var docCats = Repository.readSheet('Document_Categories', { pageSize: 100 }).rows;
    var docCatKey = {};
    docCats.forEach(function (c) { docCatKey[c.categoryKey] = c.categoryId; });
    seed('Documents', [
      { documentNumber: 'DOC-' + fy + '-00001', title: 'Society Registration Certificate', categoryId: docCatKey.GOVERNMENT || '', description: 'Registration certificate copy', tags: 'legal,registration', linkedEntityType: 'SOCIETY', linkedEntityId: '', fileRef: '{"fileId":"demo-1","name":"registration.pdf","mimeType":"application/pdf"}', versionNo: 1, isArchived: false, effectiveDate: '2020-01-01', expiryDate: '', uploadedAt: ts, uploadedBy: 'SYSTEM', statusKey: 'ACTIVE' },
      { documentNumber: 'DOC-' + fy + '-00002', title: 'AGM Minutes 2025', categoryId: docCatKey.MINUTES || '', description: 'Minutes of the 2025 AGM', tags: 'meeting,agm', linkedEntityType: 'MEETING', linkedEntityId: '', fileRef: '{"fileId":"demo-2","name":"agm-minutes.pdf","mimeType":"application/pdf"}', versionNo: 1, isArchived: false, effectiveDate: '2025-09-20', expiryDate: '', uploadedAt: ts, uploadedBy: 'SYSTEM', statusKey: 'ACTIVE' },
      { documentNumber: 'DOC-' + fy + '-00003', title: 'Fire Safety Certificate', categoryId: docCatKey.CERTIFICATES || '', description: 'Annual fire safety compliance', tags: 'safety,compliance', linkedEntityType: 'SOCIETY', linkedEntityId: '', fileRef: '{"fileId":"demo-3","name":"fire-safety.pdf","mimeType":"application/pdf"}', versionNo: 1, isArchived: false, effectiveDate: '2026-01-15', expiryDate: '2027-01-15', uploadedAt: ts, uploadedBy: 'SYSTEM', statusKey: 'ACTIVE' }
    ]);

    // ---- employee attendance & salary ------------------------------------------
    var attDates = [prevPeriod + '-05', prevPeriod + '-06', curPeriod + '-01', curPeriod + '-02'];
    employees.forEach(function (e, ei) {
      attDates.forEach(function (d, di) {
        var statusKey = (di % 4 === ei % 4) ? 'ABSENT' : 'PRESENT';
        Repository.insert('Employee_Attendance', {
          employeeId: e.employeeId, attendanceDate: d, statusKey: statusKey,
          inTime: statusKey === 'PRESENT' ? '09:00' : '', outTime: statusKey === 'PRESENT' ? '18:00' : '',
          workedHours: statusKey === 'PRESENT' ? 8 : 0, overtimeHours: 0, remarks: '',
          markedByUserId: 'SYSTEM', markedAt: ts
        }, actor);
        counts.Employee_Attendance = (counts.Employee_Attendance || 0) + 1;
      });

      [prevPeriod, curPeriod].forEach(function (pk) {
        var base = e.monthlySalary;
        var workingDays = 26, presentDays = 24, absentDays = 2, leaveDays = 0, halfDays = 0, holidayDays = 0;
        var perDay = Utils.round2(base / workingDays);
        var attendanceAdj = Utils.round2(-(absentDays * perDay));
        var allowance = 1500, overtimeHrs = 0, overtimeAmt = 0, advanceDed = 0, otherDed = 200, bonus = 0, otherAdj = 0;
        var net = Utils.round2(base + allowance + overtimeAmt + bonus - advanceDed - otherDed + attendanceAdj + otherAdj);
        Repository.insert('Employee_Salary', {
          employeeId: e.employeeId, periodKey: pk, baseSalary: base, workingDays: workingDays,
          presentDays: presentDays, absentDays: absentDays, leaveDays: leaveDays, halfDays: halfDays, holidayDays: holidayDays,
          perDayAmount: perDay, attendanceAdjustment: attendanceAdj, overtimeHours: overtimeHrs, overtimeAmount: overtimeAmt,
          allowanceAmount: allowance, advanceDeduction: advanceDed, otherDeduction: otherDed, bonusAmount: bonus,
          otherAdjustment: otherAdj, netSalary: net, paymentDate: '', paymentModeKey: '', referenceNumber: '',
          statusKey: 'DRAFT', remarks: '', attachmentRef: ''
        }, actor);
        counts.Employee_Salary = (counts.Employee_Salary || 0) + 1;
      });
    });

    } // end if (!alreadySeeded) — operational + identity data

    // ---- auth & system sheets (idempotent; fills any sheet still empty) ----
    seedAuthAndSystem(ts, actor, counts);

    // ---- audit log entry -------------------------------------------------------
    try {
      var existingAudit = Repository.countBy('Audit_Log', { action: 'SEED_DUMMY_DATA' });
      if (!existingAudit.exists) {
        Repository.insert('Audit_Log', {
          ts: ts, actorUserId: 'SYSTEM', actorName: 'System', actorRoleKeys: 'ADMIN', action: 'SEED_DUMMY_DATA',
          entity: 'SYSTEM', entityId: '', entityLabel: 'Dummy data seed', beforeJson: '', afterJson: '',
          changedFields: '', reason: 'Demo dataset', sourceSheet: '', ipHash: '', requestId: '', result: 'SUCCESS'
        }, actor);
        counts.Audit_Log = 1;
      }
    } catch (e) { /* ignore */ }

    var total = 0;
    Object.keys(counts).forEach(function (k) { total += counts[k]; });

    return { ok: true, counts: counts, total: total, alreadySeeded: alreadySeeded };
  }

  /**
   * Populate the auth + system sheets that hold runtime/records (Users, Sessions,
   * Auth_Audit, Backups, Archive_Jobs, Archive_Index) with demo rows.
   * Each sheet is filled only if empty, so it can be called repeatedly.
   */
  function seedAuthAndSystem(ts, actor, counts) {
    function safeCount(name) {
      try { return Repository.count(name); } catch (e) { return 0; }
    }

    // ---- Users (AUTH) --------------------------------------------------------
    if (safeCount('Users') === 0) {
      var hash = Utils.hashPassword('Demo@1234');
      function mkUser(username, email, fullName, roleKeys, memberId, flatId, mobile) {
        return {
          username: username, email: email, mobile: mobile || '', fullName: fullName,
          passwordHash: hash.hash, passwordSalt: hash.salt, passwordAlgo: hash.algo,
          roleKeys: roleKeys, memberId: memberId || '', employeeId: '', flatId: flatId || '',
          statusKey: 'ACTIVE', mustChangePassword: false, lastLoginAt: '', failedAttempts: 0,
          lockedUntil: '', passwordChangedAt: ts
        };
      }
      var members = Repository.readSheet('Members', { pageSize: 100 }).rows;
      var users = [
        mkUser('admin', 'admin@sunriseresidency.example', 'System Administrator', 'ADMIN', '', '', '9000000001'),
        mkUser('secretary', 'secretary@sunriseresidency.example', 'Society Secretary', 'SECRETARY', '', '', '9000000002'),
        mkUser('cashier', 'cashier@sunriseresidency.example', 'Society Cashier', 'CASHIER', '', '', '9000000003')
      ];
      if (members.length > 0) {
        users.push(mkUser('member1', members[0].email || 'member1@example.com', members[0].fullName, 'MEMBER', members[0].memberId, members[0].flatId, members[0].mobile));
      }
      if (members.length > 1) {
        users.push(mkUser('member2', members[1].email || 'member2@example.com', members[1].fullName, 'MEMBER', members[1].memberId, members[1].flatId, members[1].mobile));
      }
      var createdUsers = Repository.insertMany('Users', users, actor);
      counts.Users = createdUsers.length;
    }

    // ---- Sessions (AUTH) ------------------------------------------------------
    if (safeCount('Sessions') === 0) {
      var us = Repository.readSheet('Users', { pageSize: 100 }).rows;
      var adminId = '';
      for (var i = 0; i < us.length; i++) { if (us[i].username === 'admin') { adminId = us[i].userId; break; } }
      if (adminId) {
        var expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        Repository.insert('Sessions', {
          userId: adminId, tokenHash: Utils.sha256('demo-session-token'), issuedAt: ts, expiresAt: expiry,
          lastSeenAt: ts, deviceInfo: 'Demo browser', ipHash: '', statusKey: 'ACTIVE', revokedAt: '', revokedBy: ''
        }, actor);
        counts.Sessions = 1;
      }
    }

    // ---- Auth_Audit (AUTH) -----------------------------------------------------
    if (safeCount('Auth_Audit') === 0) {
      var us2 = Repository.readSheet('Users', { pageSize: 100 }).rows;
      var adminId2 = '';
      for (var j = 0; j < us2.length; j++) { if (us2[j].username === 'admin') { adminId2 = us2[j].userId; break; } }
      Repository.insertMany('Auth_Audit', [
        { ts: ts, actorUserId: adminId2, action: 'LOGIN_SUCCESS', entity: 'Users', entityId: adminId2, detailJson: '{"demo":true}', result: 'SUCCESS', ipHash: '' },
        { ts: ts, actorUserId: adminId2, action: 'SEED_DUMMY_DATA', entity: 'Users', entityId: '', detailJson: '{"demo":true}', result: 'SUCCESS', ipHash: '' }
      ], actor);
      counts.Auth_Audit = 2;
    }

    // ---- Backups ---------------------------------------------------------------
    if (safeCount('Backups') === 0) {
      Repository.insert('Backups', {
        scope: 'FULL', spreadsheetIds: '[]', driveFolderId: '', filesJson: '[]', sheetRowCountsJson: '{}',
        appVersion: Schema.APP_VERSION, schemaVersion: String(Schema.SCHEMA_VERSION), sizeBytes: 0,
        checksum: '', statusKey: 'SUCCESS', notes: 'Demo backup record'
      }, actor);
      counts.Backups = 1;
    }

    // ---- Archive_Jobs -----------------------------------------------------------
    if (safeCount('Archive_Jobs') === 0) {
      Repository.insert('Archive_Jobs', {
        entity: 'Demands', sourceSheet: 'Demands', targetSheet: 'Archive_Demands', fromDate: '', toDate: '',
        movedCount: 0, skippedCount: 0, statusKey: 'SUCCESS', startedAt: ts, finishedAt: ts, startedBy: 'SYSTEM', errorMessage: ''
      }, actor);
      counts.Archive_Jobs = 1;
    }

    // ---- Archive_Index ----------------------------------------------------------
    if (safeCount('Archive_Index') === 0) {
      Repository.insert('Archive_Index', {
        entity: 'Demands', archiveSheet: 'Archive_Demands', originalId: 'DMD-DEMO', keyFieldsJson: '{}',
        archivedAt: ts, archivedBy: 'SYSTEM', reason: 'Demo archive entry'
      }, actor);
      counts.Archive_Index = 1;
    }
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

    if (opts.password.length < 4) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Password must be at least 4 characters' };
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
    seedDummyData: seedDummyData,
    configureIds: configureIds,
    healthCheck: healthCheck,
    installTriggers: installTriggers,
    removeTriggers: removeTriggers,
    dailyMaintenance: dailyMaintenance,
    weeklyBackup: weeklyBackup,
    monthlyArchive: monthlyArchive
  };
})();
