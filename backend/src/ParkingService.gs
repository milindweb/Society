/**
 * ParkingService.js — parking slot allocation (permanent/temporary, conflict-safe).
 *
 * Rules:
 * - Parking_Slots unique: slotNumber; status AVAILABLE, ALLOCATED, BLOCKED, MAINTENANCE.
 * - One ACTIVE allocation per slot and per vehicle; conflict → CONFLICT_ERROR.
 * - allocationType in { PERMANENT, TEMPORARY }; temporary uses endDate.
 * - Audit row written for allocation create/end.
 */
var ParkingService = (function () {
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
      if (String(values[i][keyIdx]) === key) { return Utils.toNumber(values[i][valIdx], 0); }
    }
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Allocations
  // ---------------------------------------------------------------------------

  /**
   * List parking allocations with pagination and filters.
   */
  function listAllocations(ctx) {
    var o = ctx.payload || {};
    var filter = {};
    if (o.parkingSlotId) { filter.parkingSlotId = o.parkingSlotId; }
    if (o.flatId) { filter.flatId = o.flatId; }
    if (o.statusKey) { filter.statusKey = o.statusKey; }

    var allocs = readAll('Parking_Allocations', Object.keys(filter).length > 0 ? filter : null);
    allocs.sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });

    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = allocs.length;
    var start = (page - 1) * pageSize;
    var paged = allocs.slice(start, start + pageSize);

    return {
      ok: true,
      data: paged,
      page: {
        page: page, pageSize: pageSize, total: total,
        totalPages: Math.ceil(total / pageSize) || 1,
        hasNext: page < Math.ceil(total / pageSize),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Get a single allocation by ID.
   */
  function getAllocation(ctx) {
    var alloc = Repository.findById('Parking_Allocations', ctx.payload.allocationId);
    if (!alloc) { return { ok: false, error: 'NOT_FOUND' }; }
    return { ok: true, data: alloc };
  }

  /**
   * Create a parking allocation (ACTIVE). Refuses if slot or vehicle already has an ACTIVE allocation.
   */
  function createAllocation(ctx) {
    var o = ctx.payload;
    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : '';

    // Check slot conflict
    var existingSlot = readAll('Parking_Allocations', { parkingSlotId: o.parkingSlotId, statusKey: 'ACTIVE' });
    if (existingSlot.length > 0) {
      return { ok: false, error: 'CONFLICT_ERROR', message: 'This parking slot already has an active allocation.' };
    }

    // Check vehicle conflict (if vehicleId provided)
    if (o.vehicleId) {
      var existingVehicle = readAll('Parking_Allocations', { vehicleId: o.vehicleId, statusKey: 'ACTIVE' });
      if (existingVehicle.length > 0) {
        return { ok: false, error: 'CONFLICT_ERROR', message: 'This vehicle already has an active parking allocation.' };
      }
    }

    var allocation = {
      parkingSlotId: o.parkingSlotId,
      flatId: o.flatId,
      memberId: o.memberId || '',
      vehicleId: o.vehicleId || '',
      vehicleNumber: o.vehicleNumber || '',
      allocationType: o.allocationType || 'PERMANENT',
      startDate: o.startDate || Utils.today(),
      endDate: o.endDate || '',
      monthlyCharge: String(Utils.toNumber(o.monthlyCharge, 0)),
      statusKey: 'ACTIVE',
      remarks: o.remarks || ''
    };

    var created = Repository.withLock(function () {
      return Repository.insert('Parking_Allocations', allocation, { userId: userId });
    }, 'parking:create-allocation');

    // Update slot status
    Repository.withLock(function () {
      Repository.updateById('Parking_Slots', o.parkingSlotId, {
        statusKey: 'ALLOCATED'
      }, { userId: userId });
    }, 'parking:update-slot-status');

    Audit.write({
      action: 'PARKING_ALLOCATED',
      entity: 'Parking_Allocations',
      entityId: created.allocationId,
      after: created,
      sourceSheet: 'Parking_Allocations',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: created };
  }

  /**
   * End a parking allocation (statusKey → ENDED).
   */
  function endAllocation(ctx) {
    var alloc = Repository.findById('Parking_Allocations', ctx.payload.allocationId);
    if (!alloc) { return { ok: false, error: 'NOT_FOUND' }; }

    if (alloc.statusKey !== 'ACTIVE') {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Allocation is not active.' };
    }

    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : '';
    var patch = {
      statusKey: 'ENDED',
      endDate: ctx.payload.endDate || ts.substring(0, 10),
      remarks: ctx.payload.reason || alloc.remarks || ''
    };

    var updated = Repository.withLock(function () {
      return Repository.updateById('Parking_Allocations', alloc.allocationId, patch, { userId: userId });
    }, 'parking:end-allocation');

    // Check if slot has other active allocations
    var otherActive = readAll('Parking_Allocations', { parkingSlotId: alloc.parkingSlotId, statusKey: 'ACTIVE' });
    if (otherActive.length === 0) {
      Repository.withLock(function () {
        Repository.updateById('Parking_Slots', alloc.parkingSlotId, {
          statusKey: 'AVAILABLE'
        }, { userId: userId });
      }, 'parking:slot-available');
    }

    Audit.write({
      action: 'PARKING_ENDED',
      entity: 'Parking_Allocations',
      entityId: alloc.allocationId,
      before: alloc,
      after: updated,
      reason: ctx.payload.reason,
      sourceSheet: 'Parking_Allocations',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: updated };
  }

  /**
   * Parking summary: slots total/available/allocated/blocked, active temporary, charge collection.
   */
  function summary(ctx) {
    var slots = readAll('Parking_Slots');
    var allocs = readAll('Parking_Allocations', { statusKey: 'ACTIVE' });

    var totalSlots = slots.length;
    var available = slots.filter(function (s) { return s.statusKey === 'AVAILABLE'; }).length;
    var allocated = slots.filter(function (s) { return s.statusKey === 'ALLOCATED'; }).length;
    var blocked = slots.filter(function (s) { return s.statusKey === 'BLOCKED' || s.statusKey === 'MAINTENANCE'; }).length;
    var activeTemporary = allocs.filter(function (a) { return a.allocationType === 'TEMPORARY'; }).length;

    var totalCharge = 0;
    allocs.forEach(function (a) {
      totalCharge += Utils.toNumber(a.monthlyCharge, 0);
    });

    return {
      ok: true,
      data: {
        totalSlots: totalSlots,
        available: available,
        allocated: allocated,
        blocked: blocked,
        activeTemporary: activeTemporary,
        monthlyChargeCollection: Utils.round2(totalCharge)
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Expose
  // ---------------------------------------------------------------------------

  return {
    listAllocations: listAllocations,
    getAllocation: getAllocation,
    createAllocation: createAllocation,
    endAllocation: endAllocation,
    summary: summary
  };
})();
