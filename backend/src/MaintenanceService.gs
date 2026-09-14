/**
 * MaintenanceService.js — billing periods, demand generation, carry-forward, interest, adjustments.
 *
 * Rules:
 * - Billing_Periods status: OPEN -> GENERATED -> LOCKED -> CLOSED; no edits once LOCKED.
 * - Demands unique: periodKey + flatId + chargeTypeId; generation is idempotent.
 * - Previous period balanceAmount carried forward as previousDueAmount.
 * - Snapshots (chargeNameSnapshot, rateSnapshot, basisSnapshot, quantitySnapshot) keep history immutable.
 * - balanceAmount = totalPayable - paidAmount (server-computed, never client-supplied).
 * - Charge types and calculation methods (FLAT|FIXED|AREA|PER_MEMBER|CUSTOM) are data, never hardcoded.
 * - Interest_Rules: configurable rate, SIMPLE|COMPOUND, frequency, grace days, rounding; one isDefault.
 * - Adjustment types { INTEREST_WAIVER, DISCOUNT, PENALTY, ROUND_OFF, CORRECTION, WRITE_OFF }; reason mandatory.
 * - Active flats only; per-flat Flat_Charges applicability honoured.
 */
var MaintenanceService = (function () {
  'use strict';

  var ADJUSTMENT_TYPES = ['INTEREST_WAIVER', 'DISCOUNT', 'PENALTY', 'ROUND_OFF', 'CORRECTION', 'WRITE_OFF'];
  var CALC_METHODS = ['FLAT', 'FIXED', 'AREA', 'PER_MEMBER', 'CUSTOM'];

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Get a config value by key (string). Returns default if not set. */
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

  /** Get a config value as boolean. */
  function getConfigBoolean(key) {
    var v = getConfigString(key).toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
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
      if (!rec[Schema.idColumnOf(sheetName)] && !rec[Schema.get(sheetName).idColumn]) { continue; }
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

  /** Get the default interest rule. */
  function getDefaultInterestRule() {
    var rules = readAll('Interest_Rules', { isDefault: 'TRUE', status: 'ACTIVE' });
    if (rules.length > 0) { return rules[0]; }
    // Fallback: any active rule
    var allActive = readAll('Interest_Rules', { status: 'ACTIVE' });
    return allActive.length > 0 ? allActive[0] : null;
  }

  /** Generate a demand number using Numbering_Config. */
  function generateDemandNumber() {
    var config = findByUnique('Numbering_Config', { docType: 'DEMAND' });
    if (!config) { return 'DMN-' + Utils.now().replace(/[^0-9]/g, '').substring(0, 8) + '-' + Utils.newId('DMD').split('-').pop(); }
    var seq = Utils.toNumber(config.nextSequence, 1);
    var padded = String(seq).padStart(Utils.toNumber(config.sequenceLength, 4), '0');
    var fy = Utils.financialYear(new Date(), getConfigNumber('financialYearStartMonth') || 4);
    var number = (config.prefix || 'DMN') + '/' + fy + '/' + padded;
    // Increment sequence
    Repository.withLock(function () {
      Repository.updateById('Numbering_Config', config.numberingId, {
        nextSequence: String(seq + 1)
      }, { userId: 'SYSTEM' });
    }, 'maintenance:numbering');
    return number;
  }

  // ---------------------------------------------------------------------------
  // Periods
  // ---------------------------------------------------------------------------

  /**
   * List billing periods.
   * @param {object} ctx  handler context
   * @return {{ ok: boolean, data: object }}
   */
  function listPeriods(ctx) {
    var o = ctx.payload || {};
    var filter = {};
    if (o.financialYear) { filter.financialYear = o.financialYear; }

    var periods = readAll('Billing_Periods', Object.keys(filter).length > 0 ? filter : null);
    // Sort by periodKey descending (newest first)
    periods.sort(function (a, b) { return (b.periodKey || '').localeCompare(a.periodKey || ''); });

    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = periods.length;
    var start = (page - 1) * pageSize;
    var paged = periods.slice(start, start + pageSize);

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
   * Ensure a billing period exists for a given periodKey (YYYY-MM).
   * Idempotent: returns existing if already created.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function ensurePeriod(ctx) {
    var periodKey = ctx.payload.periodKey;
    if (!periodKey || !Utils.isPeriodFormat(periodKey)) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Invalid periodKey format. Use YYYY-MM.' };
    }

    var existing = findByUnique('Billing_Periods', { periodKey: periodKey });
    if (existing) {
      return { ok: true, data: existing };
    }

    var fy = Utils.financialYear(
      Utils.parseDate(periodKey + '-01'),
      getConfigNumber('financialYearStartMonth') || 4
    );
    var dueDay = getConfigNumber('billingDueDay') || 10;
    var periodFrom = periodKey + '-01';
    var periodTo = new Date(Date.UTC(
      parseInt(periodKey.split('-')[0], 10),
      parseInt(periodKey.split('-')[1], 10),
      0
    ));
    var periodToStr = Utils.formatDate(periodTo);
    var dueDate = periodKey + '-' + String(dueDay).padStart(2, '0');

    var record = {
      periodKey: periodKey,
      periodFrom: periodFrom,
      periodTo: periodToStr,
      financialYear: fy,
      dueDate: dueDate,
      statusKey: 'OPEN',
      generatedAt: '',
      generatedBy: '',
      lockedAt: '',
      lockedBy: '',
      remarks: ''
    };

    var created = Repository.withLock(function () {
      return Repository.insert('Billing_Periods', record, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'maintenance:ensure-period');

    Audit.write({
      action: 'PERIOD_CREATED',
      entity: 'Billing_Periods',
      entityId: created.periodId,
      after: created,
      sourceSheet: 'Billing_Periods',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: created };
  }

  /**
   * Lock a billing period (no more demand/payment edits).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function lockPeriod(ctx) {
    var periodKey = ctx.payload.periodKey;
    var period = findByUnique('Billing_Periods', { periodKey: periodKey });
    if (!period) { return { ok: false, error: 'NOT_FOUND' }; }

    if (period.statusKey === 'LOCKED' || period.statusKey === 'CLOSED') {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Period is already locked or closed.' };
    }

    var ts = Utils.now();
    var patch = {
      statusKey: 'LOCKED',
      lockedAt: ts,
      lockedBy: ctx.user ? ctx.user.userId : ''
    };

    var updated = Repository.withLock(function () {
      return Repository.updateById('Billing_Periods', period.periodId, patch, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'maintenance:lock-period');

    Audit.write({
      action: 'PERIOD_LOCKED',
      entity: 'Billing_Periods',
      entityId: period.periodId,
      before: period,
      after: updated,
      sourceSheet: 'Billing_Periods',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: updated };
  }

  /**
   * Unlock a billing period (reason mandatory, audited).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function unlockPeriod(ctx) {
    var periodKey = ctx.payload.periodKey;
    var reason = ctx.payload.reason;
    if (!reason || !String(reason).trim()) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Reason is mandatory for unlocking a period.' };
    }

    var period = findByUnique('Billing_Periods', { periodKey: periodKey });
    if (!period) { return { ok: false, error: 'NOT_FOUND' }; }

    if (period.statusKey !== 'LOCKED') {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Period is not locked.' };
    }

    var patch = {
      statusKey: 'OPEN',
      lockedAt: '',
      lockedBy: '',
      remarks: reason
    };

    var updated = Repository.withLock(function () {
      return Repository.updateById('Billing_Periods', period.periodId, patch, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'maintenance:unlock-period');

    Audit.write({
      action: 'PERIOD_UNLOCKED',
      entity: 'Billing_Periods',
      entityId: period.periodId,
      before: period,
      after: updated,
      reason: reason,
      sourceSheet: 'Billing_Periods',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: updated };
  }

  // ---------------------------------------------------------------------------
  // Demands
  // ---------------------------------------------------------------------------

  /**
   * List demands with pagination and filters.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object, page: object }}
   */
  function listDemands(ctx) {
    var o = ctx.payload || {};
    var filter = {};
    if (o.periodKey) { filter.periodKey = o.periodKey; }
    if (o.flatId) { filter.flatId = o.flatId; }
    if (o.statusKey) { filter.statusKey = o.statusKey; }
    // MEMBER_SELF: filter by user's flatId
    if (ctx.payload && ctx.payload.flatId) { filter.flatId = ctx.payload.flatId; }

    var demands = readAll('Demands', Object.keys(filter).length > 0 ? filter : null);
    demands.sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });

    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = demands.length;
    var start = (page - 1) * pageSize;
    var paged = demands.slice(start, start + pageSize);

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
   * Get a single demand by ID.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function getDemand(ctx) {
    var demand = Repository.findById('Demands', ctx.payload.demandId);
    if (!demand) { return { ok: false, error: 'NOT_FOUND' }; }
    return { ok: true, data: demand };
  }

  /**
   * Calculate the demand amount for a flat + charge type.
   * @param {object} flat
   * @param {object} chargeType
   * @param {object} flatCharge  per-flat override (or null)
   * @param {Array}  members     active members of the flat
   * @return {{ amount: number, rateSnapshot: number, basisSnapshot: string, quantitySnapshot: number }}
   */
  function calculateDemandAmount(flat, chargeType, flatCharge, members) {
    var method = chargeType.calculationMethod || 'FLAT';
    var amount = 0;
    var rate = 0;
    var basis = method;
    var quantity = 1;

    // Use per-flat override if available and active
    if (flatCharge && (flatCharge.isActive === 'TRUE' || flatCharge.isActive === true)) {
      amount = Utils.toNumber(flatCharge.amountOverride, 0);
      if (amount > 0) {
        return { amount: Utils.round2(amount), rateSnapshot: amount, basisSnapshot: 'OVERRIDE', quantitySnapshot: 1 };
      }
    }

    // Use Charge_Rates for period-specific rate if available
    var rates = readAll('Charge_Rates', { chargeTypeId: chargeType.chargeTypeId, status: 'ACTIVE' });
    var effectiveRate = null;
    var today = Utils.today();
    for (var i = 0; i < rates.length; i++) {
      var r = rates[i];
      if (r.effectiveFrom && r.effectiveFrom > today) { continue; }
      if (r.effectiveTo && r.effectiveTo < today) { continue; }
      effectiveRate = r;
      break; // take the first matching (should be sorted by effectiveFrom desc)
    }

    rate = effectiveRate ? Utils.toNumber(effectiveRate.amount, 0) : Utils.toNumber(chargeType.defaultAmount, 0);

    switch (method) {
      case 'FLAT':
      case 'FIXED':
        amount = rate;
        quantity = 1;
        break;
      case 'AREA':
        quantity = Utils.toNumber(flat.carpetArea || flat.builtUpArea, 1);
        amount = rate * quantity;
        break;
      case 'PER_MEMBER':
        quantity = members ? members.length : 1;
        amount = rate * quantity;
        break;
      case 'CUSTOM':
        amount = rate;
        quantity = 1;
        break;
      default:
        amount = rate;
        quantity = 1;
    }

    return {
      amount: Utils.round2(amount),
      rateSnapshot: rate,
      basisSnapshot: basis,
      quantitySnapshot: quantity
    };
  }

  /**
   * Get the previous period's balance for a flat + charge type.
   * @param {string} periodKey
   * @param {string} flatId
   * @param {string} chargeTypeId
   * @return {number} previous due amount
   */
  function getPreviousDue(periodKey, flatId, chargeTypeId) {
    // Parse periodKey to get previous month
    var parts = periodKey.split('-');
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    month--;
    if (month < 1) { month = 12; year--; }
    var prevKey = year + '-' + String(month).padStart(2, '0');

    var prev = findByUnique('Demands', {
      periodKey: prevKey,
      flatId: flatId,
      chargeTypeId: chargeTypeId
    });

    if (prev) {
      var balance = Utils.toNumber(prev.balanceAmount, 0);
      return balance > 0 ? balance : 0;
    }
    return 0;
  }

  /**
   * Generate demands for a billing period.
   * Idempotent: skips existing demand rows, reports duplicateSkipped.
   *
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function generateDemands(ctx) {
    var periodKey = ctx.payload.periodKey;
    var period = findByUnique('Billing_Periods', { periodKey: periodKey });
    if (!period) { return { ok: false, error: 'NOT_FOUND', message: 'Billing period not found. Run periods.ensure first.' }; }

    if (period.statusKey === 'LOCKED' || period.statusKey === 'CLOSED') {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Cannot generate demands for a locked/closed period.' };
    }

    // Get active flats
    var flats = readAll('Flats', { statusKey: 'OCCUPIED' });
    if (ctx.payload.flatIds && Array.isArray(ctx.payload.flatIds) && ctx.payload.flatIds.length > 0) {
      flats = flats.filter(function (f) { return ctx.payload.flatIds.indexOf(f.flatId) !== -1; });
    }

    // Get active charge types
    var chargeTypes = readAll('Charge_Types', { status: 'ACTIVE' });
    if (ctx.payload.chargeTypeIds && Array.isArray(ctx.payload.chargeTypeIds) && ctx.payload.chargeTypeIds.length > 0) {
      chargeTypes = chargeTypes.filter(function (ct) { return ctx.payload.chargeTypeIds.indexOf(ct.chargeTypeId) !== -1; });
    }

    var created = [];
    var skipped = 0;
    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : 'SYSTEM';

    for (var f = 0; f < flats.length; f++) {
      var flat = flats[f];
      // Get active members for the flat
      var members = readAll('Members', { flatId: flat.flatId, statusKey: 'ACTIVE' });
      var primaryMember = null;
      for (var m = 0; m < members.length; m++) {
        if (members[m].isPrimary === 'TRUE' || members[m].isPrimary === true) {
          primaryMember = members[m];
          break;
        }
      }
      if (!primaryMember && members.length > 0) { primaryMember = members[0]; }

      for (var c = 0; c < chargeTypes.length; c++) {
        var chargeType = chargeTypes[c];

        // Check if this flat has this charge type active
        var flatCharge = findByUnique('Flat_Charges', { flatId: flat.flatId, chargeTypeId: chargeType.chargeTypeId });

        // If flatCharge exists and is inactive, skip
        if (flatCharge && (flatCharge.isActive === 'FALSE' || flatCharge.isActive === false)) {
          continue;
        }

        // If no flatCharge row and no default, skip (charge not applicable)
        if (!flatCharge && chargeType.status !== 'ACTIVE') {
          continue;
        }

        // Check idempotency
        var existing = findByUnique('Demands', {
          periodKey: periodKey,
          flatId: flat.flatId,
          chargeTypeId: chargeType.chargeTypeId
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Calculate amount
        var calc = calculateDemandAmount(flat, chargeType, flatCharge, members);

        // Check interest applicability
        var interestApplicable = chargeType.interestApplicable === 'TRUE' || chargeType.interestApplicable === true;

        // Get previous due
        var previousDue = getPreviousDue(periodKey, flat.flatId, chargeType.chargeTypeId);

        var demand = {
          demandNumber: generateDemandNumber(),
          periodId: period.periodId,
          periodKey: periodKey,
          flatId: flat.flatId,
          memberId: primaryMember ? primaryMember.memberId : '',
          chargeTypeId: chargeType.chargeTypeId,
          chargeNameSnapshot: chargeType.chargeName || chargeType.chargeCode || '',
          calculationMethodSnapshot: calc.basisSnapshot,
          rateSnapshot: calc.rateSnapshot,
          basisSnapshot: calc.basisSnapshot,
          quantitySnapshot: calc.quantitySnapshot,
          amount: calc.amount,
          previousDueAmount: previousDue,
          interestAmount: 0,
          adjustmentAmount: 0,
          totalPayable: Utils.round2(calc.amount + previousDue),
          paidAmount: 0,
          balanceAmount: Utils.round2(calc.amount + previousDue),
          statusKey: 'PENDING',
          dueDate: period.dueDate || '',
          isCarriedForward: previousDue > 0 ? 'TRUE' : 'FALSE',
          generatedAt: ts,
          generatedBy: userId,
          cancelledAt: '',
          cancelledBy: '',
          cancelReason: '',
          remarks: ''
        };

        var createdDemand = Repository.withLock(function (d) {
          return Repository.insert('Demands', d, { userId: userId });
        }.bind(null, demand), 'maintenance:generate-demand');

        created.push(createdDemand);
      }
    }

    // Update period status to GENERATED
    if (created.length > 0) {
      Repository.withLock(function () {
        Repository.updateById('Billing_Periods', period.periodId, {
          statusKey: 'GENERATED',
          generatedAt: ts,
          generatedBy: userId
        }, { userId: userId });
      }, 'maintenance:period-generated');
    }

    Audit.write({
      action: 'DEMANDS_GENERATED',
      entity: 'Billing_Periods',
      entityId: period.periodId,
      after: { periodKey: periodKey, created: created.length, skipped: skipped },
      sourceSheet: 'Demands',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return {
      ok: true,
      data: {
        created: created.length,
        skipped: skipped,
        total: flats.length * chargeTypes.length,
        rows: created,
        period: period
      }
    };
  }

  /**
   * Cancel a demand (refused when paidAmount > 0).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function cancelDemand(ctx) {
    var demand = Repository.findById('Demands', ctx.payload.demandId);
    if (!demand) { return { ok: false, error: 'NOT_FOUND' }; }

    var paidAmount = Utils.toNumber(demand.paidAmount, 0);
    if (paidAmount > 0) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Cannot cancel a demand with payments.' };
    }

    if (demand.statusKey === 'CANCELLED') {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Demand is already cancelled.' };
    }

    var ts = Utils.now();
    var patch = {
      statusKey: 'CANCELLED',
      cancelledAt: ts,
      cancelledBy: ctx.user ? ctx.user.userId : '',
      cancelReason: ctx.payload.reason || ''
    };

    var updated = Repository.withLock(function () {
      return Repository.updateById('Demands', demand.demandId, patch, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'maintenance:cancel-demand');

    Audit.write({
      action: 'DEMAND_CANCELLED',
      entity: 'Demands',
      entityId: demand.demandId,
      before: demand,
      after: updated,
      reason: ctx.payload.reason,
      sourceSheet: 'Demands',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: updated };
  }

  /**
   * Demand summary for a period or financial year.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function demandSummary(ctx) {
    var o = ctx.payload || {};
    var filter = {};
    if (o.periodKey) { filter.periodKey = o.periodKey; }

    var demands = readAll('Demands', Object.keys(filter).length > 0 ? filter : null);

    var total = demands.length;
    var totalAmount = 0;
    var totalPaid = 0;
    var totalBalance = 0;
    var totalInterest = 0;
    var counts = { pending: 0, partial: 0, paid: 0, overdue: 0, cancelled: 0 };

    for (var i = 0; i < demands.length; i++) {
      var d = demands[i];
      var amount = Utils.toNumber(d.amount, 0) + Utils.toNumber(d.previousDueAmount, 0);
      var paid = Utils.toNumber(d.paidAmount, 0);
      var balance = Utils.toNumber(d.balanceAmount, 0);
      var interest = Utils.toNumber(d.interestAmount, 0);

      totalAmount += amount;
      totalPaid += paid;
      totalBalance += balance;
      totalInterest += interest;

      switch (d.statusKey) {
        case 'PENDING': counts.pending++; break;
        case 'PARTIAL': counts.partial++; break;
        case 'PAID': counts.paid++; break;
        case 'OVERDUE': counts.overdue++; break;
        case 'CANCELLED': counts.cancelled++; break;
      }
    }

    return {
      ok: true,
      data: {
        total: total,
        totalAmount: Utils.round2(totalAmount),
        totalPaid: Utils.round2(totalPaid),
        totalBalance: Utils.round2(totalBalance),
        totalInterest: Utils.round2(totalInterest),
        counts: counts
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Interest
  // ---------------------------------------------------------------------------

  /**
   * Preview interest computation for a period (read-only).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function interestPreview(ctx) {
    var periodKey = ctx.payload.periodKey;
    if (!periodKey) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'periodKey is required.' };
    }

    var rule = getDefaultInterestRule();
    if (!rule) {
      return { ok: true, data: { items: [], total: 0, rule: null } };
    }

    var flatId = ctx.payload.flatId;
    var filter = { periodKey: periodKey, statusKey: 'PENDING' };
    if (flatId) { filter.flatId = flatId; }

    var demands = readAll('Demands', filter);
    var items = [];
    var totalInterest = 0;

    var period = findByUnique('Billing_Periods', { periodKey: periodKey });
    var dueDate = period && period.dueDate ? new Date(period.dueDate) : new Date();
    var today = new Date();
    var graceDays = Utils.toNumber(rule.graceDays, 0);
    var graceDeadline = new Date(dueDate.getTime() + graceDays * 24 * 60 * 60 * 1000);

    if (today <= graceDeadline) {
      return { ok: true, data: { items: [], total: 0, rule: rule } };
    }

    var daysOverdue = Math.floor((today - graceDeadline) / (24 * 60 * 60 * 1000));
    var ratePercent = Utils.toNumber(rule.ratePercent, 0);
    var compoundMethod = rule.compoundMethod || 'SIMPLE';
    var frequency = rule.frequency || 'MONTHLY';
    var minAmount = Utils.toNumber(rule.minAmount, 0);

    for (var i = 0; i < demands.length; i++) {
      var d = demands[i];
      var balance = Utils.toNumber(d.balanceAmount, 0);
      if (balance < minAmount) { continue; }

      var interest = 0;
      if (compoundMethod === 'COMPOUND' && frequency === 'MONTHLY') {
        // Compound monthly: balance * (rate/12/100) * months
        var months = Math.max(1, Math.ceil(daysOverdue / 30));
        interest = balance * (ratePercent / 100 / 12) * months;
      } else {
        // Simple: balance * rate/100 * days/365
        interest = balance * (ratePercent / 100) * (daysOverdue / 365);
      }

      // Round to nearest roundTo
      var roundTo = Utils.toNumber(rule.roundTo, 1);
      if (roundTo > 0) {
        interest = Math.round(interest / roundTo) * roundTo;
      } else {
        interest = Utils.round2(interest);
      }

      if (interest > 0) {
        totalInterest += interest;
        items.push({
          demandId: d.demandId,
          flatId: d.flatId,
          periodKey: d.periodKey,
          balanceAmount: balance,
          daysOverdue: daysOverdue,
          interestAmount: interest
        });
      }
    }

    return {
      ok: true,
      data: {
        items: items,
        total: Utils.round2(totalInterest),
        rule: rule,
        daysOverdue: daysOverdue
      }
    };
  }

  /**
   * Apply interest to demands (creates interest ledger entries).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function applyInterest(ctx) {
    var periodKey = ctx.payload.periodKey;
    if (!periodKey) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'periodKey is required.' };
    }

    var rule = getDefaultInterestRule();
    if (!rule) {
      return { ok: true, data: { applied: 0, total: 0 } };
    }

    var flatId = ctx.payload.flatId;
    var filter = { periodKey: periodKey, statusKey: 'PENDING' };
    if (flatId) { filter.flatId = flatId; }

    var demands = readAll('Demands', filter);
    var period = findByUnique('Billing_Periods', { periodKey: periodKey });
    var dueDate = period && period.dueDate ? new Date(period.dueDate) : new Date();
    var today = new Date();
    var graceDays = Utils.toNumber(rule.graceDays, 0);
    var graceDeadline = new Date(dueDate.getTime() + graceDays * 24 * 60 * 60 * 1000);

    if (today <= graceDeadline) {
      return { ok: true, data: { applied: 0, total: 0, message: 'Within grace period.' } };
    }

    var daysOverdue = Math.floor((today - graceDeadline) / (24 * 60 * 60 * 1000));
    var ratePercent = Utils.toNumber(rule.ratePercent, 0);
    var compoundMethod = rule.compoundMethod || 'SIMPLE';
    var frequency = rule.frequency || 'MONTHLY';
    var minAmount = Utils.toNumber(rule.minAmount, 0);

    var applied = 0;
    var totalInterest = 0;
    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : 'SYSTEM';

    for (var i = 0; i < demands.length; i++) {
      var d = demands[i];
      var balance = Utils.toNumber(d.balanceAmount, 0);
      if (balance < minAmount) { continue; }

      var interest = 0;
      if (compoundMethod === 'COMPOUND' && frequency === 'MONTHLY') {
        var months = Math.max(1, Math.ceil(daysOverdue / 30));
        interest = balance * (ratePercent / 100 / 12) * months;
      } else {
        interest = balance * (ratePercent / 100) * (daysOverdue / 365);
      }

      var roundTo = Utils.toNumber(rule.roundTo, 1);
      if (roundTo > 0) {
        interest = Math.round(interest / roundTo) * roundTo;
      } else {
        interest = Utils.round2(interest);
      }

      if (interest <= 0) { continue; }

      var newInterestTotal = Utils.toNumber(d.interestAmount, 0) + interest;
      var newTotalPayable = Utils.toNumber(d.amount, 0) + Utils.toNumber(d.previousDueAmount, 0) + newInterestTotal + Utils.toNumber(d.adjustmentAmount, 0);
      var newBalance = newTotalPayable - Utils.toNumber(d.paidAmount, 0);

      Repository.withLock(function (demandId, int, ntp, nb) {
        Repository.updateById('Demands', demandId, {
          interestAmount: Utils.round2(Utils.toNumber(int, 0) + interest),
          totalPayable: Utils.round2(ntp),
          balanceAmount: Utils.round2(nb)
        }, { userId: userId });
      }.bind(null, d.demandId, d.interestAmount, newTotalPayable, newBalance), 'maintenance:apply-interest');

      // Write ledger entry
      Repository.withLock(function () {
        Repository.insert('Ledger', {
          entryDate: ts,
          periodKey: periodKey,
          flatId: d.flatId,
          memberId: d.memberId || '',
          entryType: 'INTEREST',
          refType: 'Demand',
          refId: d.demandId,
          refNumber: d.demandNumber || '',
          debitAmount: Utils.round2(interest),
          creditAmount: 0,
          runningBalance: 0,
          narration: 'Interest for ' + periodKey + ' (' + rule.ratePercent + '% ' + (compoundMethod === 'COMPOUND' ? 'compound' : 'simple') + ')'
        }, { userId: userId });
      }, 'maintenance:interest-ledger');

      totalInterest += interest;
      applied++;
    }

    Audit.write({
      action: 'INTEREST_APPLIED',
      entity: 'Billing_Periods',
      entityId: period ? period.periodId : '',
      after: { periodKey: periodKey, applied: applied, total: Utils.round2(totalInterest), daysOverdue: daysOverdue },
      sourceSheet: 'Demands',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return {
      ok: true,
      data: {
        applied: applied,
        total: Utils.round2(totalInterest),
        daysOverdue: daysOverdue
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Adjustments
  // ---------------------------------------------------------------------------

  /**
   * List adjustments with pagination.
   * @param {object} ctx
   * @return {{ ok: boolean, data: Array, page: object }}
   */
  function listAdjustments(ctx) {
    var o = ctx.payload || {};
    var filter = {};
    if (o.flatId) { filter.flatId = o.flatId; }
    if (o.periodKey) { filter.periodKey = o.periodKey; }
    if (ctx.payload && ctx.payload.flatId) { filter.flatId = ctx.payload.flatId; }

    var adjustments = readAll('Adjustments', Object.keys(filter).length > 0 ? filter : null);
    adjustments.sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });

    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = adjustments.length;
    var start = (page - 1) * pageSize;
    var paged = adjustments.slice(start, start + pageSize);

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
   * Create an adjustment (reason mandatory).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function createAdjustment(ctx) {
    var o = ctx.payload;
    if (!o.reason || !String(o.reason).trim()) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Reason is mandatory for adjustments.' };
    }

    if (ADJUSTMENT_TYPES.indexOf(o.adjustmentType) === -1) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Invalid adjustment type.' };
    }

    var amount = Utils.toNumber(o.amount, 0);
    if (amount <= 0) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Amount must be positive.' };
    }

    var sign = o.sign === '-1' || o.sign === -1 ? -1 : 1;

    // If demandId provided, verify it exists
    var demand = null;
    if (o.demandId) {
      demand = Repository.findById('Demands', o.demandId);
      if (!demand) { return { ok: false, error: 'NOT_FOUND' }; }
    }

    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : 'SYSTEM';

    var adjustment = {
      flatId: o.flatId,
      memberId: demand ? (demand.memberId || '') : (o.memberId || ''),
      demandId: o.demandId || '',
      periodKey: o.periodKey || (demand ? demand.periodKey : ''),
      adjustmentType: o.adjustmentType,
      amount: Utils.round2(amount),
      sign: String(sign),
      reason: o.reason,
      approvedBy: userId,
      approvedAt: ts,
      statusKey: 'ACTIVE',
      attachmentRef: o.attachmentRef || ''
    };

    var created = Repository.withLock(function () {
      return Repository.insert('Adjustments', adjustment, { userId: userId });
    }, 'maintenance:create-adjustment');

    // Update demand if linked
    if (demand) {
      var currentAdj = Utils.toNumber(demand.adjustmentAmount, 0);
      var newAdj = currentAdj + (amount * sign);
      var newTotalPayable = Utils.toNumber(demand.amount, 0) + Utils.toNumber(demand.previousDueAmount, 0) + Utils.toNumber(demand.interestAmount, 0) + newAdj;
      var newBalance = newTotalPayable - Utils.toNumber(demand.paidAmount, 0);

      Repository.withLock(function () {
        Repository.updateById('Demands', demand.demandId, {
          adjustmentAmount: Utils.round2(newAdj),
          totalPayable: Utils.round2(newTotalPayable),
          balanceAmount: Utils.round2(newBalance)
        }, { userId: userId });
      }, 'maintenance:adjustment-demand');

      // Write ledger entry
      Repository.withLock(function () {
        Repository.insert('Ledger', {
          entryDate: ts,
          periodKey: adjustment.periodKey,
          flatId: adjustment.flatId,
          memberId: adjustment.memberId,
          entryType: o.adjustmentType === 'INTEREST_WAIVER' ? 'WAIVER' : 'ADJUSTMENT',
          refType: 'Adjustment',
          refId: created.adjustmentId,
          refNumber: '',
          debitAmount: sign < 0 ? 0 : Utils.round2(amount),
          creditAmount: sign < 0 ? Utils.round2(amount) : 0,
          runningBalance: 0,
          narration: o.adjustmentType + ': ' + o.reason
        }, { userId: userId });
      }, 'maintenance:adjustment-ledger');
    }

    Audit.write({
      action: 'ADJUSTMENT_CREATED',
      entity: 'Adjustments',
      entityId: created.adjustmentId,
      after: created,
      reason: o.reason,
      sourceSheet: 'Adjustments',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: created };
  }

  // ---------------------------------------------------------------------------
  // Expose
  // ---------------------------------------------------------------------------

  return {
    listPeriods: listPeriods,
    ensurePeriod: ensurePeriod,
    lockPeriod: lockPeriod,
    unlockPeriod: unlockPeriod,
    listDemands: listDemands,
    getDemand: getDemand,
    generateDemands: generateDemands,
    cancelDemand: cancelDemand,
    demandSummary: demandSummary,
    interestPreview: interestPreview,
    applyInterest: applyInterest,
    listAdjustments: listAdjustments,
    createAdjustment: createAdjustment,
    // Expose helpers for testing
    calculateDemandAmount: calculateDemandAmount,
    getPreviousDue: getPreviousDue,
    getDefaultInterestRule: getDefaultInterestRule
  };
})();
