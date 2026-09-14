/**
 * PaymentService.js — payment recording, allocation, reversal, receipts, ledger.
 *
 * Rules (database-schema.md §9, §15):
 * - Payments.amount immutable after POSTED; correction = REVERSED + reversal row (never in-place edit).
 * - Allocation is oldest-due-first (deterministic, server-side); partial payment supported.
 * - sum(allocations) <= amount; unallocatedAmount = amount - allocatedAmount (server-computed).
 * - Ledger append-only; entryType in { OPENING, DEMAND, INTEREST, PAYMENT, ADJUSTMENT, WAIVER,
 *   PENALTY, REVERSAL, WRITE_OFF }.
 * - Ledger.runningBalance = replay of all entries (debit - credit); stored for fast reads.
 * - Receipts immutable: exactly one per POSTED payment (1:1), created in the same lock.
 * - receiptNumber from Numbering_Config; record/cancel/reverse are one lock + one batch.
 * - Financial corrections use reversal/adjustment only — never destructive deletion.
 * - Client-supplied amount/balanceAmount/runningBalance are ignored.
 */
var PaymentService = (function () {
  'use strict';

  var ENTRY_TYPES = ['OPENING', 'DEMAND', 'INTEREST', 'PAYMENT', 'ADJUSTMENT', 'WAIVER', 'PENALTY', 'REVERSAL', 'WRITE_OFF'];

  // ---------------------------------------------------------------------------
  // Helpers (shared with MaintenanceService — inline to avoid circular deps)
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
      if (!rec[Schema.idColumnOf(sheetName)]) { continue; }
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

  /** Find a record by unique key fields. */
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
      var match = Object.keys(uniqueKey).every(function (k) {
        return String(rec[k]) === String(uniqueKey[k]);
      });
      if (match) { return rec; }
    }
    return null;
  }

  /** Get a config value by key (string). */
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

  /** Get a config value as number. */
  function getConfigNumber(key) {
    var v = getConfigString(key);
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  /** Generate a document number using Numbering_Config. */
  function generateDocNumber(docType) {
    var config = findByUnique('Numbering_Config', { docType: docType });
    if (!config) {
      var prefix = docType === 'RECEIPT' ? 'RCP' : docType.substring(0, 3);
      return prefix + '-' + Utils.now().replace(/[^0-9]/g, '').substring(0, 8) + '-' + Utils.newId(prefix).split('-').pop();
    }
    var seq = Utils.toNumber(config.nextSequence, 1);
    var padded = String(seq).padStart(Utils.toNumber(config.sequenceLength, 4), '0');
    var fy = Utils.financialYear(new Date(), getConfigNumber('financialYearStartMonth') || 4);
    var number = (config.prefix || docType.substring(0, 3)) + '/' + fy + '/' + padded;
    // Increment sequence
    Repository.withLock(function () {
      Repository.updateById('Numbering_Config', config.numberingId, {
        nextSequence: String(seq + 1)
      }, { userId: 'SYSTEM' });
    }, 'payment:numbering:' + docType);
    return number;
  }

  /** Build paginated response. */
  function buildPage(page, pageSize, total) {
    var totalPages = Math.ceil(total / pageSize) || 1;
    return {
      page: page,
      pageSize: pageSize,
      total: total,
      totalPages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
  }

  // ---------------------------------------------------------------------------
  // Payments — list / get
  // ---------------------------------------------------------------------------

  /**
   * List payments with pagination and filters.
   * @param {object} ctx  handler context (ctx.payload: page, pageSize, flatId, statusKey, paymentModeKey)
   * @return {{ ok: boolean, data: Array, page: object }}
   */
  function listPayments(ctx) {
    var o = ctx.payload || {};
    var filter = {};
    if (o.flatId) { filter.flatId = o.flatId; }
    if (o.statusKey) { filter.statusKey = o.statusKey; }
    if (o.paymentModeKey) { filter.paymentModeKey = o.paymentModeKey; }

    var payments = readAll('Payments', Object.keys(filter).length > 0 ? filter : null);
    payments.sort(function (a, b) { return (b.paymentDate || b.createdAt || '').localeCompare(a.paymentDate || a.createdAt || ''); });

    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = payments.length;
    var start = (page - 1) * pageSize;
    var paged = payments.slice(start, start + pageSize);

    return {
      ok: true,
      data: paged,
      page: buildPage(page, pageSize, total)
    };
  }

  /**
   * Get a single payment by ID.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function getPayment(ctx) {
    var payment = Repository.findById('Payments', ctx.payload.paymentId);
    if (!payment) { return { ok: false, error: 'NOT_FOUND' }; }
    return { ok: true, data: payment };
  }

  // ---------------------------------------------------------------------------
  // Payments — record (payment + allocations + receipt + ledger in one lock)
  // ---------------------------------------------------------------------------

  /**
   * Record a payment with oldest-due-first allocation.
   *
   * Creates: Payment row, Payment_Allocation rows, Receipt row, Ledger entries.
   * All in one lock to maintain consistency.
   *
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function recordPayment(ctx) {
    var o = ctx.payload;

    // Validate required fields
    if (!o.flatId) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'flatId is required.' };
    }
    var amount = Utils.toNumber(o.amount, 0);
    if (amount <= 0) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Amount must be greater than zero.' };
    }
    if (!o.paymentModeKey) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'paymentModeKey is required.' };
    }

    // Verify flat exists
    var flat = Repository.findById('Flats', o.flatId);
    if (!flat) { return { ok: false, error: 'NOT_FOUND', message: 'Flat not found.' }; }

    // Get primary member
    var members = readAll('Members', { flatId: o.flatId, statusKey: 'ACTIVE' });
    var primaryMember = null;
    for (var m = 0; m < members.length; m++) {
      if (members[m].isPrimary === 'TRUE' || members[m].isPrimary === true) {
        primaryMember = members[m];
        break;
      }
    }
    if (!primaryMember && members.length > 0) { primaryMember = members[0]; }
    var memberId = primaryMember ? primaryMember.memberId : (o.memberId || '');

    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : 'SYSTEM';
    var paymentDate = o.paymentDate || Utils.today();

    // Build payment record
    var receiptNumber = generateDocNumber('RECEIPT');
    var payment = {
      receiptNumber: receiptNumber,
      paymentDate: paymentDate,
      flatId: o.flatId,
      memberId: memberId,
      amount: Utils.round2(amount),
      allocatedAmount: 0,
      unallocatedAmount: Utils.round2(amount),
      paymentModeKey: o.paymentModeKey,
      referenceNumber: o.referenceNumber || '',
      bankName: o.bankName || '',
      remarks: o.remarks || '',
      statusKey: 'POSTED',
      receivedBy: userId,
      receivedAt: ts,
      cancelledAt: '',
      cancelledBy: '',
      cancelReason: '',
      reversedFromPaymentId: '',
      attachmentRef: o.attachmentRef || ''
    };

    // Get outstanding demands for this flat (oldest-due-first)
    var demands = readAll('Demands', { flatId: o.flatId });
    // Filter to demands with balance > 0, not cancelled
    var outstandingDemands = demands.filter(function (d) {
      return d.statusKey !== 'CANCELLED' && Utils.toNumber(d.balanceAmount, 0) > 0;
    });
    // Sort by periodKey ascending (oldest first)
    outstandingDemands.sort(function (a, b) {
      return (a.periodKey || '').localeCompare(b.periodKey || '');
    });

    // Allocate payment across demands (oldest-due-first)
    var allocations = [];
    var remainingAmount = Utils.round2(amount);
    var totalAllocated = 0;

    for (var i = 0; i < outstandingDemands.length && remainingAmount > 0; i++) {
      var demand = outstandingDemands[i];
      var demandBalance = Utils.toNumber(demand.balanceAmount, 0);
      var allocAmount = Math.min(remainingAmount, demandBalance);
      allocAmount = Utils.round2(allocAmount);

      if (allocAmount <= 0) { continue; }

      allocations.push({
        demandId: demand.demandId,
        periodKey: demand.periodKey,
        flatId: o.flatId,
        amount: allocAmount,
        demand: demand
      });

      totalAllocated += allocAmount;
      remainingAmount = Utils.round2(remainingAmount - allocAmount);
    }

    totalAllocated = Utils.round2(totalAllocated);
    var unallocated = Utils.round2(amount - totalAllocated);

    // Execute everything in one lock
    var result = Repository.withLock(function () {
      // 1. Insert payment
      payment.allocatedAmount = totalAllocated;
      payment.unallocatedAmount = unallocated;
      var createdPayment = Repository.insert('Payments', payment, { userId: userId });

      // 2. Insert allocations and update demands
      var createdAllocations = [];
      for (var j = 0; j < allocations.length; j++) {
        var alloc = allocations[j];

        // Insert allocation row
        var allocRow = {
          paymentId: createdPayment.paymentId,
          demandId: alloc.demandId,
          periodKey: alloc.periodKey,
          flatId: alloc.flatId,
          amount: alloc.amount
        };
        var createdAlloc = Repository.insert('Payment_Allocations', allocRow, { userId: userId });
        createdAllocations.push(createdAlloc);

        // Update demand: paidAmount, balanceAmount, statusKey
        var d = alloc.demand;
        var newPaid = Utils.toNumber(d.paidAmount, 0) + alloc.amount;
        var newBalance = Utils.toNumber(d.totalPayable, 0) - newPaid;
        newPaid = Utils.round2(newPaid);
        newBalance = Utils.round2(newBalance);

        var demandStatus = 'PENDING';
        if (newBalance <= 0) {
          demandStatus = 'PAID';
        } else if (newPaid > 0) {
          demandStatus = 'PARTIAL';
        }

        Repository.updateById('Demands', alloc.demandId, {
          paidAmount: newPaid,
          balanceAmount: newBalance,
          statusKey: demandStatus
        }, { userId: userId });

        // Write ledger entry for demand allocation
        Repository.insert('Ledger', {
          entryDate: ts,
          periodKey: alloc.periodKey,
          flatId: alloc.flatId,
          memberId: d.memberId || '',
          entryType: 'PAYMENT',
          refType: 'Payment',
          refId: createdPayment.paymentId,
          refNumber: receiptNumber,
          debitAmount: 0,
          creditAmount: alloc.amount,
          runningBalance: 0,
          narration: 'Payment allocated to ' + (d.demandNumber || alloc.demandId) + ' (' + alloc.periodKey + ')'
        }, { userId: userId });
      }

      // 3. Insert receipt (1:1 with payment)
      var receipt = {
        receiptNumber: receiptNumber,
        paymentId: createdPayment.paymentId,
        flatId: o.flatId,
        memberId: memberId,
        amount: Utils.round2(amount),
        paymentDate: paymentDate,
        issuedAt: ts,
        issuedBy: userId,
        templateKey: o.templateKey || 'DEFAULT',
        driveFileId: '',
        printCount: 0,
        lastPrintedAt: '',
        statusKey: 'POSTED'
      };
      var createdReceipt = Repository.insert('Receipts', receipt, { userId: userId });

      return {
        payment: createdPayment,
        allocations: createdAllocations,
        receipt: createdReceipt
      };
    }, 'payment:record');

    // Audit
    Audit.write({
      action: 'PAYMENT_RECORDED',
      entity: 'Payments',
      entityId: result.payment.paymentId,
      entityLabel: receiptNumber,
      after: {
        amount: amount,
        allocated: totalAllocated,
        unallocated: unallocated,
        allocationCount: allocations.length,
        flatId: o.flatId
      },
      sourceSheet: 'Payments',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: result };
  }

  // ---------------------------------------------------------------------------
  // Payments — allocate (manual allocation to specific demands)
  // ---------------------------------------------------------------------------

  /**
   * Manually allocate an existing payment's unallocated amount to specific demands.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function allocatePayment(ctx) {
    var o = ctx.payload;
    if (!o.paymentId) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'paymentId is required.' };
    }
    if (!o.demandId) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'demandId is required.' };
    }

    var payment = Repository.findById('Payments', o.paymentId);
    if (!payment) { return { ok: false, error: 'NOT_FOUND' }; }
    if (payment.statusKey !== 'POSTED') {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Payment is not POSTED.' };
    }

    var unallocated = Utils.toNumber(payment.unallocatedAmount, 0);
    if (unallocated <= 0) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'No unallocated amount remaining.' };
    }

    var demand = Repository.findById('Demands', o.demandId);
    if (!demand) { return { ok: false, error: 'NOT_FOUND', message: 'Demand not found.' }; }

    // Verify same flat
    if (demand.flatId !== payment.flatId) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Demand does not belong to the same flat.' };
    }

    var demandBalance = Utils.toNumber(demand.balanceAmount, 0);
    if (demandBalance <= 0) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Demand has no outstanding balance.' };
    }

    var allocAmount = Math.min(unallocated, demandBalance);
    allocAmount = Utils.round2(allocAmount);

    if (allocAmount <= 0) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Nothing to allocate.' };
    }

    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : 'SYSTEM';

    var result = Repository.withLock(function () {
      // Insert allocation
      var allocRow = {
        paymentId: payment.paymentId,
        demandId: demand.demandId,
        periodKey: demand.periodKey,
        flatId: payment.flatId,
        amount: allocAmount
      };
      var createdAlloc = Repository.insert('Payment_Allocations', allocRow, { userId: userId });

      // Update payment unallocated/allocated
      var newAllocated = Utils.toNumber(payment.allocatedAmount, 0) + allocAmount;
      var newUnallocated = Utils.round2(Utils.toNumber(payment.amount, 0) - newAllocated);
      Repository.updateById('Payments', payment.paymentId, {
        allocatedAmount: Utils.round2(newAllocated),
        unallocatedAmount: newUnallocated
      }, { userId: userId });

      // Update demand
      var newPaid = Utils.toNumber(demand.paidAmount, 0) + allocAmount;
      var newBalance = Utils.toNumber(demand.totalPayable, 0) - newPaid;
      newPaid = Utils.round2(newPaid);
      newBalance = Utils.round2(newBalance);

      var demandStatus = 'PENDING';
      if (newBalance <= 0) { demandStatus = 'PAID'; }
      else if (newPaid > 0) { demandStatus = 'PARTIAL'; }

      Repository.updateById('Demands', demand.demandId, {
        paidAmount: newPaid,
        balanceAmount: newBalance,
        statusKey: demandStatus
      }, { userId: userId });

      // Ledger entry
      Repository.insert('Ledger', {
        entryDate: ts,
        periodKey: demand.periodKey,
        flatId: payment.flatId,
        memberId: demand.memberId || '',
        entryType: 'PAYMENT',
        refType: 'Payment',
        refId: payment.paymentId,
        refNumber: payment.receiptNumber || '',
        debitAmount: 0,
        creditAmount: allocAmount,
        runningBalance: 0,
        narration: 'Manual allocation to ' + (demand.demandNumber || demand.demandId)
      }, { userId: userId });

      return { allocation: createdAlloc, allocated: allocAmount, unallocated: newUnallocated };
    }, 'payment:allocate');

    Audit.write({
      action: 'PAYMENT_ALLOCATED',
      entity: 'Payments',
      entityId: payment.paymentId,
      after: { demandId: o.demandId, allocated: result.allocated, remaining: result.unallocated },
      sourceSheet: 'Payment_Allocations',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: result };
  }

  // ---------------------------------------------------------------------------
  // Payments — cancel (refunds unallocated, reverses allocations)
  // ---------------------------------------------------------------------------

  /**
   * Cancel a POSTED payment. Reverses all allocations and posts reversal ledger entries.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function cancelPayment(ctx) {
    var o = ctx.payload;
    if (!o.paymentId) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'paymentId is required.' };
    }
    var reason = o.reason || '';
    if (!reason || !String(reason).trim()) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Reason is mandatory for cancellation.' };
    }

    var payment = Repository.findById('Payments', o.paymentId);
    if (!payment) { return { ok: false, error: 'NOT_FOUND' }; }
    if (payment.statusKey === 'CANCELLED') {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Payment is already cancelled.' };
    }

    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : 'SYSTEM';

    var result = Repository.withLock(function () {
      // Get allocations for this payment
      var allocs = readAll('Payment_Allocations', { paymentId: payment.paymentId });

      // Reverse each allocation: update demand paidAmount/balance
      for (var i = 0; i < allocs.length; i++) {
        var alloc = allocs[i];
        var demand = Repository.findById('Demands', alloc.demandId);
        if (demand) {
          var newPaid = Utils.toNumber(demand.paidAmount, 0) - Utils.toNumber(alloc.amount, 0);
          newPaid = Math.max(0, Utils.round2(newPaid));
          var newBalance = Utils.toNumber(demand.totalPayable, 0) - newPaid;
          newBalance = Utils.round2(newBalance);

          var demandStatus = 'PENDING';
          if (newBalance <= 0) { demandStatus = 'PAID'; }
          else if (newPaid > 0) { demandStatus = 'PARTIAL'; }

          Repository.updateById('Demands', alloc.demandId, {
            paidAmount: newPaid,
            balanceAmount: newBalance,
            statusKey: demandStatus
          }, { userId: userId });

          // Reversal ledger entry
          Repository.insert('Ledger', {
            entryDate: ts,
            periodKey: alloc.periodKey,
            flatId: alloc.flatId,
            memberId: demand.memberId || '',
            entryType: 'REVERSAL',
            refType: 'Payment',
            refId: payment.paymentId,
            refNumber: payment.receiptNumber || '',
            debitAmount: Utils.toNumber(alloc.amount, 0),
            creditAmount: 0,
            runningBalance: 0,
            narration: 'Reversal of allocation for ' + (demand.demandNumber || alloc.demandId) + ' — ' + reason
          }, { userId: userId });
        }
      }

      // Update payment status
      var updatedPayment = Repository.updateById('Payments', payment.paymentId, {
        statusKey: 'CANCELLED',
        cancelledAt: ts,
        cancelledBy: userId,
        cancelReason: reason
      }, { userId: userId });

      // Cancel receipt if exists
      var receipts = readAll('Receipts', { paymentId: payment.paymentId });
      for (var r = 0; r < receipts.length; r++) {
        Repository.updateById('Receipts', receipts[r].receiptId, {
          statusKey: 'CANCELLED'
        }, { userId: userId });
      }

      return { payment: updatedPayment, allocationsReversed: allocs.length };
    }, 'payment:cancel');

    Audit.write({
      action: 'PAYMENT_CANCELLED',
      entity: 'Payments',
      entityId: payment.paymentId,
      before: payment,
      after: result.payment,
      reason: reason,
      sourceSheet: 'Payments',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: result };
  }

  // ---------------------------------------------------------------------------
  // Payments — reverse (creates a new reversal payment row, like cancel but audit-friendly)
  // ---------------------------------------------------------------------------

  /**
   * Reverse a POSTED payment. Creates a new reversal payment row linked to the original.
   * Original payment remains but its allocations are undone.
   *
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function reversePayment(ctx) {
    var o = ctx.payload;
    if (!o.paymentId) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'paymentId is required.' };
    }
    var reason = o.reason || '';
    if (!reason || !String(reason).trim()) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Reason is mandatory for reversal.' };
    }

    var payment = Repository.findById('Payments', o.paymentId);
    if (!payment) { return { ok: false, error: 'NOT_FOUND' }; }
    if (payment.statusKey !== 'POSTED') {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Only POSTED payments can be reversed.' };
    }

    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : 'SYSTEM';
    var receiptNumber = generateDocNumber('RECEIPT');

    var result = Repository.withLock(function () {
      // Get allocations
      var allocs = readAll('Payment_Allocations', { paymentId: payment.paymentId });

      // Reverse each allocation
      for (var i = 0; i < allocs.length; i++) {
        var alloc = allocs[i];
        var demand = Repository.findById('Demands', alloc.demandId);
        if (demand) {
          var newPaid = Utils.toNumber(demand.paidAmount, 0) - Utils.toNumber(alloc.amount, 0);
          newPaid = Math.max(0, Utils.round2(newPaid));
          var newBalance = Utils.toNumber(demand.totalPayable, 0) - newPaid;
          newBalance = Utils.round2(newBalance);

          var demandStatus = 'PENDING';
          if (newBalance <= 0) { demandStatus = 'PAID'; }
          else if (newPaid > 0) { demandStatus = 'PARTIAL'; }

          Repository.updateById('Demands', alloc.demandId, {
            paidAmount: newPaid,
            balanceAmount: newBalance,
            statusKey: demandStatus
          }, { userId: userId });

          // Reversal ledger entry
          Repository.insert('Ledger', {
            entryDate: ts,
            periodKey: alloc.periodKey,
            flatId: alloc.flatId,
            memberId: demand.memberId || '',
            entryType: 'REVERSAL',
            refType: 'Payment',
            refId: payment.paymentId,
            refNumber: payment.receiptNumber || '',
            debitAmount: Utils.toNumber(alloc.amount, 0),
            creditAmount: 0,
            runningBalance: 0,
            narration: 'Reversal of ' + (demand.demandNumber || alloc.demandId) + ' — ' + reason
          }, { userId: userId });
        }
      }

      // Mark original payment as REVERSED
      Repository.updateById('Payments', payment.paymentId, {
        statusKey: 'REVERSED',
        cancelledAt: ts,
        cancelledBy: userId,
        cancelReason: reason
      }, { userId: userId });

      // Create reversal payment row (negative mirror)
      var reversalPayment = {
        receiptNumber: receiptNumber,
        paymentDate: Utils.today(),
        flatId: payment.flatId,
        memberId: payment.memberId,
        amount: Utils.round2(-Utils.toNumber(payment.amount, 0)),
        allocatedAmount: 0,
        unallocatedAmount: Utils.round2(-Utils.toNumber(payment.amount, 0)),
        paymentModeKey: payment.paymentModeKey,
        referenceNumber: 'REVERSAL:' + payment.receiptNumber,
        bankName: payment.bankName,
        remarks: reason,
        statusKey: 'POSTED',
        receivedBy: userId,
        receivedAt: ts,
        cancelledAt: '',
        cancelledBy: '',
        cancelReason: '',
        reversedFromPaymentId: payment.paymentId,
        attachmentRef: ''
      };
      var createdReversal = Repository.insert('Payments', reversalPayment, { userId: userId });

      // Cancel original receipt
      var receipts = readAll('Receipts', { paymentId: payment.paymentId });
      for (var r = 0; r < receipts.length; r++) {
        Repository.updateById('Receipts', receipts[r].receiptId, {
          statusKey: 'CANCELLED'
        }, { userId: userId });
      }

      return {
        originalPayment: payment,
        reversalPayment: createdReversal,
        allocationsReversed: allocs.length
      };
    }, 'payment:reverse');

    Audit.write({
      action: 'PAYMENT_REVERSED',
      entity: 'Payments',
      entityId: payment.paymentId,
      entityLabel: payment.receiptNumber,
      before: payment,
      after: result.reversalPayment,
      reason: reason,
      sourceSheet: 'Payments',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: result };
  }

  // ---------------------------------------------------------------------------
  // Receipts — list / get / print
  // ---------------------------------------------------------------------------

  /**
   * List receipts with pagination and filters.
   * @param {object} ctx
   * @return {{ ok: boolean, data: Array, page: object }}
   */
  function listReceipts(ctx) {
    var o = ctx.payload || {};
    var filter = {};
    if (o.flatId) { filter.flatId = o.flatId; }
    if (o.statusKey) { filter.statusKey = o.statusKey; }

    var receipts = readAll('Receipts', Object.keys(filter).length > 0 ? filter : null);
    receipts.sort(function (a, b) { return (b.issuedAt || '').localeCompare(a.issuedAt || ''); });

    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = receipts.length;
    var start = (page - 1) * pageSize;
    var paged = receipts.slice(start, start + pageSize);

    return {
      ok: true,
      data: paged,
      page: buildPage(page, pageSize, total)
    };
  }

  /**
   * Get a single receipt by ID.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function getReceipt(ctx) {
    var receipt = Repository.findById('Receipts', ctx.payload.receiptId);
    if (!receipt) { return { ok: false, error: 'NOT_FOUND' }; }
    return { ok: true, data: receipt };
  }

  /**
   * Print a receipt (increments printCount, audited).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function printReceipt(ctx) {
    var receipt = Repository.findById('Receipts', ctx.payload.receiptId);
    if (!receipt) { return { ok: false, error: 'NOT_FOUND' }; }
    if (receipt.statusKey !== 'POSTED') {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Only POSTED receipts can be printed.' };
    }

    var newCount = Utils.toNumber(receipt.printCount, 0) + 1;
    var ts = Utils.now();

    var updated = Repository.withLock(function () {
      return Repository.updateById('Receipts', receipt.receiptId, {
        printCount: String(newCount),
        lastPrintedAt: ts
      }, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'payment:print-receipt');

    Audit.write({
      action: 'RECEIPT_PRINTED',
      entity: 'Receipts',
      entityId: receipt.receiptId,
      entityLabel: receipt.receiptNumber,
      before: { printCount: receipt.printCount },
      after: { printCount: String(newCount), lastPrintedAt: ts },
      sourceSheet: 'Receipts',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: updated };
  }

  // ---------------------------------------------------------------------------
  // Ledger — get / summary
  // ---------------------------------------------------------------------------

  /**
   * Get ledger entries for a flat with pagination.
   * @param {object} ctx
   * @return {{ ok: boolean, data: Array, page: object }}
   */
  function getLedger(ctx) {
    var o = ctx.payload || {};
    if (!o.flatId) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'flatId is required.' };
    }

    var filter = { flatId: o.flatId };
    if (o.periodKey) { filter.periodKey = o.periodKey; }
    if (o.entryType) { filter.entryType = o.entryType; }

    var entries = readAll('Ledger', filter);
    entries.sort(function (a, b) {
      return (a.entryDate || '').localeCompare(b.entryDate || '') ||
        (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = entries.length;
    var start = (page - 1) * pageSize;
    var paged = entries.slice(start, start + pageSize);

    return {
      ok: true,
      data: paged,
      page: buildPage(page, pageSize, total)
    };
  }

  /**
   * Ledger summary for a flat: total debit, credit, running balance.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function ledgerSummary(ctx) {
    var o = ctx.payload || {};
    if (!o.flatId) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'flatId is required.' };
    }

    var filter = { flatId: o.flatId };
    if (o.periodKey) { filter.periodKey = o.periodKey; }

    var entries = readAll('Ledger', filter);
    // Sort by date then createdAt for replay
    entries.sort(function (a, b) {
      return (a.entryDate || '').localeCompare(b.entryDate || '') ||
        (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    var totalDebit = 0;
    var totalCredit = 0;
    var runningBalance = 0;
    var byPeriod = {};
    var byType = {};

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var debit = Utils.toNumber(e.debitAmount, 0);
      var credit = Utils.toNumber(e.creditAmount, 0);
      totalDebit += debit;
      totalCredit += credit;
      runningBalance = Utils.round2(runningBalance + debit - credit);

      // By period
      var pk = e.periodKey || 'unknown';
      if (!byPeriod[pk]) { byPeriod[pk] = { debit: 0, credit: 0, balance: 0 }; }
      byPeriod[pk].debit = Utils.round2(byPeriod[pk].debit + debit);
      byPeriod[pk].credit = Utils.round2(byPeriod[pk].credit + credit);
      byPeriod[pk].balance = Utils.round2(byPeriod[pk].debit - byPeriod[pk].credit);

      // By type
      var et = e.entryType || 'unknown';
      if (!byType[et]) { byType[et] = { debit: 0, credit: 0 }; }
      byType[et].debit = Utils.round2(byType[et].debit + debit);
      byType[et].credit = Utils.round2(byType[et].credit + credit);
    }

    return {
      ok: true,
      data: {
        flatId: o.flatId,
        totalDebit: Utils.round2(totalDebit),
        totalCredit: Utils.round2(totalCredit),
        runningBalance: runningBalance,
        entryCount: entries.length,
        byPeriod: byPeriod,
        byType: byType
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Expose
  // ---------------------------------------------------------------------------

  return {
    listPayments: listPayments,
    getPayment: getPayment,
    recordPayment: recordPayment,
    allocatePayment: allocatePayment,
    cancelPayment: cancelPayment,
    reversePayment: reversePayment,
    listReceipts: listReceipts,
    getReceipt: getReceipt,
    printReceipt: printReceipt,
    getLedger: getLedger,
    ledgerSummary: ledgerSummary,
    // Expose helpers for testing
    readAll: readAll,
    findByUnique: findByUnique,
    generateDocNumber: generateDocNumber
  };
})();
