/**
 * ExpenseService.js — society expense management.
 *
 * Rules:
 * - Expenses unique: expenseNumber (from Numbering_Config); status POSTED, CANCELLED.
 * - Expense categories are configurable; cancel requires a reason; never hard-delete.
 * - expenses.summary returns monthly, category-wise and vendor-wise totals.
 * - Audit row written for expense create/update/cancel.
 */
var ExpenseService = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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
        var match = Object.keys(filter).every(function (k) { return String(rec[k]) === String(filter[k]); });
        if (!match) { continue; }
      }
      rows.push(rec);
    }
    return rows;
  }

  function findByUnique(sheetName, uniqueKey) {
    var result = Repository.countBy(sheetName, uniqueKey);
    if (!result.exists) { return null; }
    var sheet = Repository.getSheet(sheetName);
    var columns = Schema.columnsOf(sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return null; }
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow(sheetName, values[i]);
      var match = Object.keys(uniqueKey).every(function (k) { return String(rec[k]) === String(uniqueKey[k]); });
      if (match) { return rec; }
    }
    return null;
  }

  function generateExpenseNumber() {
    var sheet = Repository.getSheet('Numbering_Config');
    var columns = Schema.columnsOf('Numbering_Config');
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return 'EXP-' + Utils.now().replace(/[^0-9]/g, '').substring(0, 8); }
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow('Numbering_Config', values[i]);
      if (rec.docType === 'EXPENSE') {
        var seq = Utils.toNumber(rec.nextSequence, 1);
        var padded = String(seq).padStart(Utils.toNumber(rec.sequenceLength, 4), '0');
        var fy = Utils.financialYear(new Date());
        var number = (rec.prefix || 'EXP') + '/' + fy + '/' + padded;
        Repository.withLock(function () {
          Repository.updateById('Numbering_Config', rec.numberingId, { nextSequence: String(seq + 1) }, { userId: 'SYSTEM' });
        }, 'expense:numbering');
        return number;
      }
    }
    return 'EXP-' + Utils.now().replace(/[^0-9]/g, '').substring(0, 8);
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  function list(ctx) {
    var o = ctx.payload || {};
    var filter = {};
    if (o.categoryId) { filter.categoryId = o.categoryId; }
    if (o.vendorId) { filter.vendorId = o.vendorId; }
    if (o.statusKey) { filter.statusKey = o.statusKey; }

    var expenses = readAll('Expenses', Object.keys(filter).length > 0 ? filter : null);

    if (o.from) { expenses = expenses.filter(function (e) { return (e.expenseDate || '') >= o.from; }); }
    if (o.to) { expenses = expenses.filter(function (e) { return (e.expenseDate || '') <= o.to; }); }

    expenses.sort(function (a, b) { return (b.expenseDate || '').localeCompare(a.expenseDate || ''); });

    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = expenses.length;
    var start = (page - 1) * pageSize;
    var paged = expenses.slice(start, start + pageSize);

    return {
      ok: true, data: paged,
      page: { page: page, pageSize: pageSize, total: total, totalPages: Math.ceil(total / pageSize) || 1, hasNext: page < Math.ceil(total / pageSize), hasPrev: page > 1 }
    };
  }

  function get(ctx) {
    var expense = Repository.findById('Expenses', ctx.payload.expenseId);
    if (!expense) { return { ok: false, error: 'NOT_FOUND' }; }
    return { ok: true, data: expense };
  }

  function create(ctx) {
    var o = ctx.payload;
    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : '';

    var expense = {
      expenseNumber: generateExpenseNumber(),
      expenseDate: o.expenseDate || Utils.today(),
      periodKey: o.periodKey || Utils.currentPeriod(),
      categoryId: o.categoryId || '',
      description: o.description || '',
      vendorId: o.vendorId || '',
      payeeName: o.payeeName || '',
      amount: String(Utils.toNumber(o.amount, 0)),
      paymentModeKey: o.paymentModeKey || '',
      referenceNumber: o.referenceNumber || '',
      paidBy: o.paidBy || userId,
      attachmentRef: o.attachmentRef || '',
      remarks: o.remarks || '',
      statusKey: 'POSTED',
      cancelledAt: '',
      cancelledBy: '',
      cancelReason: ''
    };

    var created = Repository.withLock(function () {
      return Repository.insert('Expenses', expense, { userId: userId });
    }, 'expense:create');

    Audit.write({
      action: 'EXPENSE_CREATED', entity: 'Expenses', entityId: created.expenseId,
      after: created, sourceSheet: 'Expenses', requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: created };
  }

  function update(ctx) {
    var expense = Repository.findById('Expenses', ctx.payload.expenseId);
    if (!expense) { return { ok: false, error: 'NOT_FOUND' }; }

    if (expense.statusKey === 'CANCELLED') {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Cannot update a cancelled expense.' };
    }

    var ALLOWED = ['expenseDate', 'categoryId', 'description', 'vendorId', 'payeeName', 'amount', 'paymentModeKey', 'referenceNumber', 'remarks', 'attachmentRef'];
    var patch = {};
    var o = ctx.payload;
    for (var i = 0; i < ALLOWED.length; i++) {
      if (o.hasOwnProperty(ALLOWED[i])) { patch[ALLOWED[i]] = o[ALLOWED[i]]; }
    }
    if (patch.amount !== undefined) { patch.amount = String(Utils.toNumber(patch.amount, 0)); }

    if (Object.keys(patch).length === 0) { return { ok: true, data: expense }; }

    var updated = Repository.withLock(function () {
      return Repository.updateById('Expenses', expense.expenseId, patch, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'expense:update');

    Audit.write({
      action: 'EXPENSE_UPDATED', entity: 'Expenses', entityId: expense.expenseId,
      before: expense, after: updated, sourceSheet: 'Expenses', requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: updated };
  }

  function cancel(ctx) {
    var expense = Repository.findById('Expenses', ctx.payload.expenseId);
    if (!expense) { return { ok: false, error: 'NOT_FOUND' }; }

    if (expense.statusKey === 'CANCELLED') {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Expense is already cancelled.' };
    }

    if (!ctx.payload.reason || !String(ctx.payload.reason).trim()) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Reason is mandatory for cancellation.' };
    }

    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : '';
    var patch = {
      statusKey: 'CANCELLED',
      cancelledAt: ts,
      cancelledBy: userId,
      cancelReason: ctx.payload.reason
    };

    var updated = Repository.withLock(function () {
      return Repository.updateById('Expenses', expense.expenseId, patch, { userId: userId });
    }, 'expense:cancel');

    Audit.write({
      action: 'EXPENSE_CANCELLED', entity: 'Expenses', entityId: expense.expenseId,
      before: expense, after: updated, reason: ctx.payload.reason, sourceSheet: 'Expenses', requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: updated };
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  function summary(ctx) {
    var o = ctx.payload || {};
    var expenses = readAll('Expenses', { statusKey: 'POSTED' });

    if (o.periodKey) { expenses = expenses.filter(function (e) { return e.periodKey === o.periodKey; }); }
    if (o.from) { expenses = expenses.filter(function (e) { return (e.expenseDate || '') >= o.from; }); }
    if (o.to) { expenses = expenses.filter(function (e) { return (e.expenseDate || '') <= o.to; }); }
    if (o.categoryId) { expenses = expenses.filter(function (e) { return e.categoryId === o.categoryId; }); }
    if (o.vendorId) { expenses = expenses.filter(function (e) { return e.vendorId === o.vendorId; }); }

    var totalAmount = 0;
    var byCategory = {};
    var byVendor = {};
    var byMonth = {};

    for (var i = 0; i < expenses.length; i++) {
      var e = expenses[i];
      var amount = Utils.toNumber(e.amount, 0);
      totalAmount += amount;

      var cat = e.categoryId || 'UNCATEGORIZED';
      byCategory[cat] = (byCategory[cat] || 0) + amount;

      var vendor = e.vendorId || 'DIRECT';
      byVendor[vendor] = (byVendor[vendor] || 0) + amount;

      var month = (e.periodKey || e.expenseDate || '').substring(0, 7);
      if (month) { byMonth[month] = (byMonth[month] || 0) + amount; }
    }

    // Round totals
    Object.keys(byCategory).forEach(function (k) { byCategory[k] = Utils.round2(byCategory[k]); });
    Object.keys(byVendor).forEach(function (k) { byVendor[k] = Utils.round2(byVendor[k]); });
    Object.keys(byMonth).forEach(function (k) { byMonth[k] = Utils.round2(byMonth[k]); });

    return {
      ok: true,
      data: {
        total: expenses.length,
        totalAmount: Utils.round2(totalAmount),
        byCategory: byCategory,
        byVendor: byVendor,
        byMonth: byMonth
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Expose
  // ---------------------------------------------------------------------------

  return {
    list: list,
    get: get,
    create: create,
    update: update,
    cancel: cancel,
    summary: summary
  };
})();
