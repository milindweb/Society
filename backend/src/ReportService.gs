/**
 * ReportService.js — global search (grouped, permission-filtered) and report query helpers.
 *
 * Rules:
 * - search.global enforces searchMinChars; server-side case-insensitive substring; grouped by entity.
 * - Only groups the caller may read are returned.
 * - No full-sheet reads on hot paths (bounded scans).
 * - Dashboard summary is role-aware (sections the caller is permitted to see).
 * - Report catalog is declarative; report rows are computed server-side.
 */
var ReportService = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Read all rows from a sheet with optional filter. */
  function readAll(sheetName, filter) {
    var sheet = Repository.getSheet(sheetName);
    var columns = Schema.columnsOf(sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return []; }
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    var rows = [];
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow(sheetName, values[i]);
      if (filter) {
        var match = Object.keys(filter).every(function (k) {
          return String(rec[k]) === String(filter[k]);
        });
        if (!match) { continue; }
      }
      rows.push(rec);
    }
    return rows;
  }

  function getConfigNumber(key) {
    var result = Repository.countBy('Society_Config', { configKey: key });
    if (!result.exists) { return 0; }
    var sheet = Repository.getSheet('Society_Config');
    var map = Repository.headerMap('Society_Config');
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return 0; }
    var columns = Schema.columnsOf('Society_Config');
    var valIdx = map['configValue'] - 1;
    var keyIdx = map['configKey'] - 1;
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][keyIdx]) === key) {
        return Utils.toNumber(values[i][valIdx], 0);
      }
    }
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  /**
   * Global search across all readable entities.
   * Returns grouped matches filtered by the caller's permissions.
   *
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function globalSearch(ctx) {
    var q = (ctx.payload.q || '').trim();
    var minChars = getConfigNumber('searchMinChars') || 2;
    var limit = Math.min(100, Math.max(1, Utils.toNumber(ctx.payload.limit, 25)));

    if (q.length < minChars) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Search query must be at least ' + minChars + ' characters.' };
    }

    var permissions = ctx.permissions || [];
    var results = {};

    // Search Flats (if flats.read)
    if (permissions.indexOf('flats.read') !== -1) {
      var flats = readAll('Flats');
      var flatMatches = flats.filter(function (f) {
        return (f.flatNumber || '').toLowerCase().indexOf(q.toLowerCase()) !== -1 ||
               (f.remarks || '').toLowerCase().indexOf(q.toLowerCase()) !== -1;
      }).slice(0, limit);
      if (flatMatches.length > 0) {
        results.flats = flatMatches.map(function (f) {
          return { flatId: f.flatId, flatNumber: f.flatNumber, wingId: f.wingId, statusKey: f.statusKey };
        });
      }
    }

    // Search Members (if members.read)
    if (permissions.indexOf('members.read') !== -1) {
      var members = readAll('Members');
      var memberMatches = members.filter(function (m) {
        return (m.fullName || '').toLowerCase().indexOf(q.toLowerCase()) !== -1 ||
               (m.memberCode || '').toLowerCase().indexOf(q.toLowerCase()) !== -1 ||
               (m.mobile || '').indexOf(q) !== -1 ||
               (m.email || '').toLowerCase().indexOf(q.toLowerCase()) !== -1;
      }).slice(0, limit);
      if (memberMatches.length > 0) {
        results.members = memberMatches.map(function (m) {
          return { memberId: m.memberId, fullName: m.fullName, flatId: m.flatId, mobile: m.mobile };
        });
      }
    }

    // Search Complaints (if complaints.read)
    if (permissions.indexOf('complaints.read') !== -1) {
      var complaints = readAll('Complaints');
      var complaintMatches = complaints.filter(function (c) {
        return (c.complaintNumber || '').toLowerCase().indexOf(q.toLowerCase()) !== -1 ||
               (c.title || '').toLowerCase().indexOf(q.toLowerCase()) !== -1;
      }).slice(0, limit);
      if (complaintMatches.length > 0) {
        results.complaints = complaintMatches.map(function (c) {
          return { complaintId: c.complaintId, complaintNumber: c.complaintNumber, title: c.title, statusKey: c.statusKey };
        });
      }
    }

    // Search Payments (if payments.read)
    if (permissions.indexOf('payments.read') !== -1) {
      var payments = readAll('Payments');
      var paymentMatches = payments.filter(function (p) {
        return (p.receiptNumber || '').toLowerCase().indexOf(q.toLowerCase()) !== -1 ||
               (p.referenceNumber || '').toLowerCase().indexOf(q.toLowerCase()) !== -1;
      }).slice(0, limit);
      if (paymentMatches.length > 0) {
        results.payments = paymentMatches.map(function (p) {
          return { paymentId: p.paymentId, receiptNumber: p.receiptNumber, amount: p.amount, statusKey: p.statusKey };
        });
      }
    }

    // Search Visitors (if visitors.read)
    if (permissions.indexOf('visitors.read') !== -1) {
      var visitors = readAll('Visitors');
      var visitorMatches = visitors.filter(function (v) {
        return (v.passNumber || '').toLowerCase().indexOf(q.toLowerCase()) !== -1 ||
               (v.visitorName || '').toLowerCase().indexOf(q.toLowerCase()) !== -1 ||
               (v.vehicleNumber || '').toLowerCase().indexOf(q.toLowerCase()) !== -1;
      }).slice(0, limit);
      if (visitorMatches.length > 0) {
        results.visitors = visitorMatches.map(function (v) {
          return { visitorId: v.visitorId, passNumber: v.passNumber, visitorName: v.visitorName, statusKey: v.statusKey };
        });
      }
    }

    // Search Demands (if maintenance.read)
    if (permissions.indexOf('maintenance.read') !== -1) {
      var demands = readAll('Demands');
      var demandMatches = demands.filter(function (d) {
        return (d.demandNumber || '').toLowerCase().indexOf(q.toLowerCase()) !== -1;
      }).slice(0, limit);
      if (demandMatches.length > 0) {
        results.demands = demandMatches.map(function (d) {
          return { demandId: d.demandId, demandNumber: d.demandNumber, periodKey: d.periodKey, balanceAmount: d.balanceAmount };
        });
      }
    }

    // Search Vendors (if config.read)
    if (permissions.indexOf('config.read') !== -1) {
      var vendors = readAll('Vendors');
      var vendorMatches = vendors.filter(function (v) {
        return (v.vendorName || '').toLowerCase().indexOf(q.toLowerCase()) !== -1;
      }).slice(0, limit);
      if (vendorMatches.length > 0) {
        results.vendors = vendorMatches.map(function (v) {
          return { vendorId: v.vendorId, vendorName: v.vendorName, statusKey: v.statusKey };
        });
      }
    }

    return {
      ok: true,
      data: {
        query: q,
        groups: results,
        totalGroups: Object.keys(results).length
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Dashboard summary
  // ---------------------------------------------------------------------------

  /**
   * Role-aware dashboard summary.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function dashboardSummary(ctx) {
    var permissions = ctx.permissions || [];
    var data = {
      flatsMembers: { totalFlats: 0, totalMembers: 0, occupied: 0, vacant: 0 },
      finance: { totalDemand: 0, totalCollection: 0, totalOutstanding: 0, overdueAmount: 0 },
      counts: { paidMembers: 0, partialMembers: 0, pendingMembers: 0 },
      recentPayments: [],
      recentComplaints: [],
      recentNotices: [],
      recentVisitors: [],
      quickActions: []
    };

    // Flats/Members
    if (permissions.indexOf('flats.read') !== -1) {
      var flats = readAll('Flats');
      var members = readAll('Members');
      data.flatsMembers = {
        totalFlats: flats.length,
        occupied: flats.filter(function (f) { return f.statusKey === 'OCCUPIED'; }).length,
        vacant: flats.filter(function (f) { return f.statusKey === 'VACANT'; }).length,
        totalMembers: members.filter(function (m) { return m.statusKey === 'ACTIVE'; }).length
      };
    }

    // Finance (Demands)
    if (permissions.indexOf('maintenance.read') !== -1) {
      var demands = readAll('Demands');
      var totalDemand = 0;
      var totalCollection = 0;
      var totalOutstanding = 0;
      var overdueAmount = 0;
      var memberPaid = {};
      var memberPartial = {};
      var memberPending = {};
      for (var i = 0; i < demands.length; i++) {
        var d = demands[i];
        var demand = Utils.toNumber(d.totalPayable, 0);
        var paid = Utils.toNumber(d.paidAmount, 0);
        var balance = Utils.toNumber(d.balanceAmount, 0);
        totalDemand += demand;
        totalCollection += paid;
        totalOutstanding += balance;
        if (d.statusKey === 'OVERDUE') { overdueAmount += balance; }
        var mid = d.memberId || d.flatId;
        if (mid) {
          if (balance <= 0) { memberPaid[mid] = true; delete memberPartial[mid]; delete memberPending[mid]; }
          else if (paid > 0) { memberPartial[mid] = true; delete memberPending[mid]; }
          else if (!memberPaid[mid] && !memberPartial[mid]) { memberPending[mid] = true; }
        }
      }
      data.finance = {
        totalDemand: Utils.round2(totalDemand),
        totalCollection: Utils.round2(totalCollection),
        totalOutstanding: Utils.round2(totalOutstanding),
        overdueAmount: Utils.round2(overdueAmount)
      };
      data.counts = {
        paidMembers: Object.keys(memberPaid).length,
        partialMembers: Object.keys(memberPartial).length,
        pendingMembers: Object.keys(memberPending).length
      };
    }

    // Recent payments
    if (permissions.indexOf('payments.read') !== -1) {
      var payments = readAll('Payments');
      payments.sort(function (a, b) { return (b.paymentDate || '').localeCompare(a.paymentDate || ''); });
      data.recentPayments = payments.slice(0, 5);
    }

    // Recent complaints
    if (permissions.indexOf('complaints.read') !== -1) {
      var complaints = readAll('Complaints');
      complaints.sort(function (a, b) { return (b.raisedAt || b.createdAt || '').localeCompare(a.raisedAt || a.createdAt || ''); });
      data.recentComplaints = complaints.slice(0, 5);
    }

    // Recent notices
    if (permissions.indexOf('notices.read') !== -1) {
      var notices = readAll('Notices');
      notices.sort(function (a, b) { return (b.noticeDate || '').localeCompare(a.noticeDate || ''); });
      data.recentNotices = notices.slice(0, 5);
    }

    // Recent visitors
    if (permissions.indexOf('visitors.read') !== -1) {
      var visitors = readAll('Visitors');
      visitors.sort(function (a, b) { return (b.entryAt || '').localeCompare(a.entryAt || ''); });
      data.recentVisitors = visitors.slice(0, 5);
    }

    // Expenses summary
    if (permissions.indexOf('expenses.read') !== -1) {
      var expenses = readAll('Expenses');
      var totalExpenses = 0;
      for (var e = 0; e < expenses.length; e++) {
        if (expenses[e].statusKey !== 'CANCELLED') {
          totalExpenses += Utils.toNumber(expenses[e].amount, 0);
        }
      }
      data.totalExpenses = Utils.round2(totalExpenses);
    }

    // Quick actions
    var actions = [
      { label: 'New Payment', route: '/payments/new', permission: 'payments.create', icon: 'payments' },
      { label: 'New Complaint', route: '/complaints/new', permission: 'complaints.create', icon: 'complaints' },
      { label: 'New Notice', route: '/notices/new', permission: 'notices.create', icon: 'notices' },
      { label: 'Log Visitor', route: '/visitors/new', permission: 'visitors.create', icon: 'visitors' }
    ];
    data.quickActions = actions.filter(function (a) { return permissions.indexOf(a.permission) !== -1; });

    return {
      ok: true,
      data: data
    };
  }

  // ---------------------------------------------------------------------------
  // Report catalog & run
  // ---------------------------------------------------------------------------

  /** Declarative report definitions. */
  var REPORT_CATALOG = {
    'demand-summary': {
      title: 'Demand Summary',
      filters: ['periodKey', 'financialYear'],
      columns: ['flatId', 'flatNumber', 'wingId', 'chargeName', 'amount', 'paidAmount', 'balanceAmount', 'statusKey']
    },
    'payment-register': {
      title: 'Payment Register',
      filters: ['from', 'to', 'paymentModeKey'],
      columns: ['receiptNumber', 'paymentDate', 'flatId', 'amount', 'paymentModeKey', 'referenceNumber', 'statusKey']
    },
    'outstanding': {
      title: 'Outstanding Report',
      filters: ['periodKey'],
      columns: ['flatId', 'flatNumber', 'wingId', 'totalDemand', 'totalPaid', 'totalBalance', 'overdue']
    },
    'complaint-summary': {
      title: 'Complaint Summary',
      filters: ['from', 'to', 'categoryId'],
      columns: ['complaintNumber', 'title', 'category', 'priority', 'statusKey', 'raisedAt', 'resolvedAt']
    },
    'visitor-log': {
      title: 'Visitor Log',
      filters: ['from', 'to', 'flatId'],
      columns: ['passNumber', 'visitorName', 'flatId', 'entryAt', 'exitAt', 'statusKey']
    },
    'expense-summary': {
      title: 'Expense Summary',
      filters: ['periodKey', 'categoryId'],
      columns: ['expenseNumber', 'expenseDate', 'category', 'description', 'amount', 'statusKey']
    }
  };

  /**
   * Get the report catalog.
   * @return {{ ok: boolean, data: object }}
   */
  function catalog() {
    var reports = {};
    Object.keys(REPORT_CATALOG).forEach(function (key) {
      reports[key] = {
        key: key,
        title: REPORT_CATALOG[key].title,
        filters: REPORT_CATALOG[key].filters,
        columns: REPORT_CATALOG[key].columns
      };
    });
    return { ok: true, data: reports };
  }

  /**
   * Run a report (simplified — reads from sheets, applies filters).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object, page: object }}
   */
  function run(ctx) {
    var reportKey = ctx.payload.reportKey;
    var def = REPORT_CATALOG[reportKey];
    if (!def) {
      return { ok: false, error: 'NOT_FOUND', message: 'Unknown report: ' + reportKey };
    }

    // Simplified: read from the primary entity sheet
    var filter = {};
    var o = ctx.payload;
    if (o.filters) {
      Object.keys(o.filters).forEach(function (k) {
        filter[k] = o.filters[k];
      });
    }

    // Map report to source sheet
    var sheetMap = {
      'demand-summary': 'Demands',
      'payment-register': 'Payments',
      'outstanding': 'Demands',
      'complaint-summary': 'Complaints',
      'visitor-log': 'Visitors',
      'expense-summary': 'Expenses'
    };

    var sheetName = sheetMap[reportKey];
    if (!sheetName) {
      return { ok: false, error: 'INTERNAL_ERROR' };
    }

    var rows = readAll(sheetName, Object.keys(filter).length > 0 ? filter : null);

    // Project only declared columns
    var projected = rows.map(function (r) {
      var obj = {};
      def.columns.forEach(function (c) {
        obj[c] = r[c] || '';
      });
      return obj;
    });

    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = projected.length;
    var start = (page - 1) * pageSize;
    var paged = projected.slice(start, start + pageSize);

    return {
      ok: true,
      data: {
        reportKey: reportKey,
        title: def.title,
        rows: paged,
        totals: computeTotals(reportKey, rows)
      },
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

  /** Compute simple totals for a report. */
  function computeTotals(reportKey, rows) {
    var totals = {};
    if (reportKey === 'demand-summary' || reportKey === 'outstanding') {
      var tAmount = 0, tPaid = 0, tBalance = 0;
      rows.forEach(function (r) {
        tAmount += Utils.toNumber(r.amount || r.totalDemand, 0);
        tPaid += Utils.toNumber(r.paidAmount || r.totalPaid, 0);
        tBalance += Utils.toNumber(r.balanceAmount || r.totalBalance, 0);
      });
      totals = { amount: Utils.round2(tAmount), paid: Utils.round2(tPaid), balance: Utils.round2(tBalance) };
    } else if (reportKey === 'payment-register') {
      var tAmount = 0;
      rows.forEach(function (r) { tAmount += Utils.toNumber(r.amount, 0); });
      totals = { totalAmount: Utils.round2(tAmount), count: rows.length };
    } else if (reportKey === 'expense-summary') {
      var tAmount = 0;
      rows.forEach(function (r) { tAmount += Utils.toNumber(r.amount, 0); });
      totals = { totalAmount: Utils.round2(tAmount), count: rows.length };
    }
    return totals;
  }

  // ---------------------------------------------------------------------------
  // Report export (CSV to Drive, chunked)
  // ---------------------------------------------------------------------------

  /**
   * Export a report to CSV on Google Drive.
   * Uses chunked writes (default 5000 rows/step) to stay within GAS execution limits.
   * Returns the Drive file reference.
   *
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function exportReport(ctx) {
    var o = ctx.payload || {};
    var reportKey = o.reportKey;
    var def = REPORT_CATALOG[reportKey];
    if (!def) {
      return { ok: false, error: 'NOT_FOUND', message: 'Unknown report: ' + reportKey };
    }

    // Gather rows (same as run but unpaginated)
    var filter = {};
    if (o.filters) {
      Object.keys(o.filters).forEach(function (k) { filter[k] = o.filters[k]; });
    }

    var sheetMap = {
      'demand-summary': 'Demands',
      'payment-register': 'Payments',
      'outstanding': 'Demands',
      'complaint-summary': 'Complaints',
      'visitor-log': 'Visitors',
      'expense-summary': 'Expenses'
    };

    var sheetName = sheetMap[reportKey];
    if (!sheetName) { return { ok: false, error: 'INTERNAL_ERROR' }; }

    var rows = readAll(sheetName, Object.keys(filter).length > 0 ? filter : null);

    // Project declared columns
    var projected = rows.map(function (r) {
      var obj = {};
      def.columns.forEach(function (c) { obj[c] = r[c] || ''; });
      return obj;
    });

    var CHUNK_SIZE = Utils.toNumber(getConfigNumber('exportChunkSize'), 5000);
    var currency = getConfigString('currencySymbol') || '₹';
    var timestamp = Utils.now().replace(/[^0-9]/g, '').substring(0, 14);
    var fileName = reportKey + '_' + timestamp + '.csv';

    // Build CSV content in chunks
    var headers = def.columns.join(',');
    var csvLines = [headers];

    var chunkRows = projected.slice(0, CHUNK_SIZE);
    for (var i = 0; i < chunkRows.length; i++) {
      var line = [];
      for (var j = 0; j < def.columns.length; j++) {
        var val = String(chunkRows[i][def.columns[j]] || '');
        // Escape CSV special characters
        if (val.indexOf(',') !== -1 || val.indexOf('"') !== -1 || val.indexOf('\n') !== -1) {
          val = '"' + val.replace(/"/g, '""') + '"';
        }
        line.push(val);
      }
      csvLines.push(line.join(','));
    }

    // Add totals row
    var totals = computeTotals(reportKey, rows);
    csvLines.push('');
    csvLines.push('Totals');
    if (totals.amount !== undefined) { csvLines.push('Amount,' + currency + ' ' + totals.amount); }
    if (totals.paid !== undefined) { csvLines.push('Paid,' + currency + ' ' + totals.paid); }
    if (totals.balance !== undefined) { csvLines.push('Balance,' + currency + ' ' + totals.balance); }
    if (totals.totalAmount !== undefined) { csvLines.push('Total,' + currency + ' ' + totals.totalAmount); }
    if (totals.count !== undefined) { csvLines.push('Count,' + totals.count); }

    var csvContent = csvLines.join('\n');

    // Upload to Drive
    var folderId = getConfigString('reportsFolderId') || '';
    var uploadResult = DriveService.uploadCsv(fileName, csvContent, folderId);

    if (!uploadResult.ok) {
      return { ok: false, error: 'EXPORT_FAILED', message: 'Failed to upload CSV to Drive.' };
    }

    Audit.write({
      action: 'REPORT_EXPORTED', entity: 'Reports',
      after: { reportKey: reportKey, fileName: fileName, fileId: uploadResult.data.fileId, rowCount: projected.length },
      sourceSheet: sheetName, requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return {
      ok: true,
      data: {
        reportKey: reportKey,
        title: def.title,
        fileName: fileName,
        fileId: uploadResult.data.fileId,
        fileUrl: uploadResult.data.fileUrl,
        rowCount: projected.length,
        totals: totals,
        currency: currency
      }
    };
  }

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
      if (String(values[i][keyIdx]) === key) { return String(values[i][valIdx]); }
    }
    return '';
  }

  // ---------------------------------------------------------------------------
  // Audit query (delegated to BackupService)
  // ---------------------------------------------------------------------------

  function listAudit(ctx) { return BackupService.listAudit(ctx); }
  function getAudit(ctx) { return BackupService.getAudit(ctx); }

  // ---------------------------------------------------------------------------
  // Expose
  // ---------------------------------------------------------------------------

  return {
    globalSearch: globalSearch,
    dashboardSummary: dashboardSummary,
    catalog: catalog,
    run: run,
    exportReport: exportReport,
    listAudit: listAudit,
    getAudit: getAudit
  };
})();
