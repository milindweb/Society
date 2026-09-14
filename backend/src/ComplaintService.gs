/**
 * ComplaintService.js — complaint workflow (raise → assign → status → resolve → close).
 *
 * Rules:
 * - Complaints unique: complaintNumber; status domain COMPLAINT.
 * - Status flow: OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED (also REOPENED, CANCELLED).
 * - Complaint_Updates append-only; Complaints.statusKey always equals the latest update's status.
 * - Assignment target: assignedToType in { MEMBER, EMPLOYEE, VENDOR, NONE } + assignedToId.
 * - Resolve requires correctiveAction + resolutionRemarks; reopen increments reopenCount.
 * - MEMBER_SELF narrows complaints to the caller's flat.
 * - Categories, priorities are configurable rows (not hardcoded).
 * - Audit row written for create/assign/transition.
 */
var ComplaintService = (function () {
  'use strict';

  /** Legal transitions: statusKey -> set of allowed next statuses. */
  var TRANSITIONS = {
    'OPEN':       ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
    'ASSIGNED':   ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
    'IN_PROGRESS': ['ASSIGNED', 'RESOLVED', 'REOPENED', 'CANCELLED'],
    'RESOLVED':   ['CLOSED', 'REOPENED'],
    'CLOSED':     ['REOPENED'],
    'REOPENED':   ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
    'CANCELLED':  []
  };

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

  /** Generate a complaint number using Numbering_Config. */
  function generateComplaintNumber() {
    var config = findByUnique('Numbering_Config', { docType: 'COMPLAINT' });
    if (!config) { return 'CMP-' + Utils.now().replace(/[^0-9]/g, '').substring(0, 8) + '-' + Utils.newId('CMP').split('-').pop(); }
    var seq = Utils.toNumber(config.nextSequence, 1);
    var padded = String(seq).padStart(Utils.toNumber(config.sequenceLength, 4), '0');
    var fy = Utils.financialYear(new Date());
    var number = (config.prefix || 'CMP') + '/' + fy + '/' + padded;
    Repository.withLock(function () {
      Repository.updateById('Numbering_Config', config.numberingId, {
        nextSequence: String(seq + 1)
      }, { userId: 'SYSTEM' });
    }, 'complaint:numbering');
    return number;
  }

  /** Generate a visitor pass number using Numbering_Config. */
  function generatePassNumber() {
    var config = findByUnique('Numbering_Config', { docType: 'VISITOR' });
    if (!config) { return 'VIS-' + Utils.now().replace(/[^0-9]/g, '').substring(0, 8) + '-' + Utils.newId('VIS').split('-').pop(); }
    var seq = Utils.toNumber(config.nextSequence, 1);
    var padded = String(seq).padStart(Utils.toNumber(config.sequenceLength, 4), '0');
    var fy = Utils.financialYear(new Date());
    var number = (config.prefix || 'VIS') + '/' + fy + '/' + padded;
    Repository.withLock(function () {
      Repository.updateById('Numbering_Config', config.numberingId, {
        nextSequence: String(seq + 1)
      }, { userId: 'SYSTEM' });
    }, 'visitor:numbering');
    return number;
  }

  /** Write a Complaint_Updates append-only row. */
  function addComplaintUpdate(complaintId, statusKey, remarks, correctiveAction, actionByType, actionById, userId) {
    var ts = Utils.now();
    var update = {
      complaintId: complaintId,
      statusKey: statusKey,
      remarks: remarks || '',
      correctiveAction: correctiveAction || '',
      actionTakenByType: actionByType || '',
      actionTakenById: actionById || '',
      actionTakenAt: ts,
      attachmentRef: ''
    };
    return Repository.withLock(function () {
      return Repository.insert('Complaint_Updates', update, { userId: userId || 'SYSTEM' });
    }, 'complaint:add-update');
  }

  // ---------------------------------------------------------------------------
  // Complaints
  // ---------------------------------------------------------------------------

  /**
   * List complaints with pagination and filters.
   * @param {object} ctx
   * @return {{ ok: boolean, data: Array, page: object }}
   */
  function list(ctx) {
    var o = ctx.payload || {};
    var filter = {};
    if (o.statusKey) { filter.statusKey = o.statusKey; }
    if (o.categoryId) { filter.categoryId = o.categoryId; }
    if (o.priorityKey) { filter.priorityKey = o.priorityKey; }
    if (o.flatId) { filter.flatId = o.flatId; }
    // MEMBER_SELF: filter by user's flatId
    if (ctx.payload && ctx.payload.flatId) { filter.flatId = ctx.payload.flatId; }

    var complaints = readAll('Complaints', Object.keys(filter).length > 0 ? filter : null);
    complaints.sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });

    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = complaints.length;
    var start = (page - 1) * pageSize;
    var paged = complaints.slice(start, start + pageSize);

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
   * Get a single complaint with its update history.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function get(ctx) {
    var complaint = Repository.findById('Complaints', ctx.payload.complaintId);
    if (!complaint) { return { ok: false, error: 'NOT_FOUND' }; }

    // Fetch updates
    var updates = readAll('Complaint_Updates', { complaintId: complaint.complaintId });
    updates.sort(function (a, b) { return (a.actionTakenAt || '').localeCompare(b.actionTakenAt || ''); });

    return {
      ok: true,
      data: {
        complaint: complaint,
        updates: updates
      }
    };
  }

  /**
   * Create a complaint (statusKey = OPEN).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function create(ctx) {
    var o = ctx.payload;
    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : '';
    var flatId = o.flatId || (ctx.user ? ctx.user.flatId : '');
    var memberId = o.memberId || (ctx.user ? ctx.user.memberId : '');

    var complaint = {
      complaintNumber: generateComplaintNumber(),
      categoryId: o.categoryId || '',
      priorityKey: o.priorityKey || '',
      title: o.title || '',
      description: o.description || '',
      flatId: flatId,
      memberId: memberId,
      raisedByMemberId: memberId,
      raisedAt: ts,
      source: o.source || 'WEB',
      statusKey: 'OPEN',
      assignedToType: '',
      assignedToId: '',
      assignedAt: '',
      assignedBy: '',
      targetDate: '',
      resolvedAt: '',
      closedAt: '',
      closedBy: '',
      correctiveAction: '',
      resolutionRemarks: '',
      attachmentRef: o.attachmentRef || '',
      reopenCount: '0'
    };

    var created = Repository.withLock(function () {
      return Repository.insert('Complaints', complaint, { userId: userId });
    }, 'complaint:create');

    // Add initial update row
    addComplaintUpdate(created.complaintId, 'OPEN', 'Complaint raised', '', '', memberId, userId);

    Audit.write({
      action: 'COMPLAINT_CREATED',
      entity: 'Complaints',
      entityId: created.complaintId,
      after: created,
      sourceSheet: 'Complaints',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: created };
  }

  /**
   * Update a complaint (whitelist: description, priorityKey, categoryId, title).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function update(ctx) {
    var complaint = Repository.findById('Complaints', ctx.payload.complaintId);
    if (!complaint) { return { ok: false, error: 'NOT_FOUND' }; }

    var ALLOWED = ['description', 'priorityKey', 'categoryId', 'title', 'attachmentRef'];
    var patch = {};
    var o = ctx.payload;
    for (var i = 0; i < ALLOWED.length; i++) {
      if (o.hasOwnProperty(ALLOWED[i])) { patch[ALLOWED[i]] = o[ALLOWED[i]]; }
    }

    if (Object.keys(patch).length === 0) {
      return { ok: true, data: complaint };
    }

    var updated = Repository.withLock(function () {
      return Repository.updateById('Complaints', complaint.complaintId, patch, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'complaint:update');

    return { ok: true, data: updated };
  }

  /**
   * Assign a complaint (statusKey → ASSIGNED + update row).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function assign(ctx) {
    var complaint = Repository.findById('Complaints', ctx.payload.complaintId);
    if (!complaint) { return { ok: false, error: 'NOT_FOUND' }; }

    var allowedNext = TRANSITIONS[complaint.statusKey] || [];
    if (allowedNext.indexOf('ASSIGNED') === -1) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Cannot assign from status: ' + complaint.statusKey };
    }

    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : '';
    var patch = {
      statusKey: 'ASSIGNED',
      assignedToType: ctx.payload.assignedToType || 'NONE',
      assignedToId: ctx.payload.assignedToId || '',
      assignedAt: ts,
      assignedBy: userId,
      targetDate: ctx.payload.targetDate || ''
    };

    var updated = Repository.withLock(function () {
      var u = Repository.updateById('Complaints', complaint.complaintId, patch, { userId: userId });
      addComplaintUpdate(complaint.complaintId, 'ASSIGNED', ctx.payload.remarks || 'Assigned to ' + (patch.assignedToType || 'none'), '', patch.assignedToType, patch.assignedToId, userId);
      return u;
    }, 'complaint:assign');

    Audit.write({
      action: 'COMPLAINT_ASSIGNED',
      entity: 'Complaints',
      entityId: complaint.complaintId,
      before: complaint,
      after: updated,
      sourceSheet: 'Complaints',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: updated };
  }

  /**
   * Transition a complaint to a new status (legal transitions only).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function transition(ctx) {
    var complaint = Repository.findById('Complaints', ctx.payload.complaintId);
    if (!complaint) { return { ok: false, error: 'NOT_FOUND' }; }

    var newStatus = ctx.payload.statusKey;
    if (!newStatus) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'statusKey is required.' };
    }

    var allowedNext = TRANSITIONS[complaint.statusKey] || [];
    if (allowedNext.indexOf(newStatus) === -1) {
      return {
        ok: false,
        error: 'VALIDATION_ERROR',
        message: 'Cannot transition from ' + complaint.statusKey + ' to ' + newStatus + '. Allowed: ' + allowedNext.join(', ')
      };
    }

    // Resolve requires correctiveAction + resolutionRemarks
    if (newStatus === 'RESOLVED') {
      if (!ctx.payload.correctiveAction || !String(ctx.payload.correctiveAction).trim()) {
        return { ok: false, error: 'VALIDATION_ERROR', message: 'correctiveAction is required for resolving.' };
      }
      if (!ctx.payload.remarks || !String(ctx.payload.remarks).trim()) {
        return { ok: false, error: 'VALIDATION_ERROR', message: 'resolutionRemarks are required for resolving.' };
      }
    }

    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : '';
    var patch = {
      statusKey: newStatus,
      correctiveAction: ctx.payload.correctiveAction || complaint.correctiveAction || '',
      resolutionRemarks: ctx.payload.remarks || complaint.resolutionRemarks || ''
    };

    if (newStatus === 'RESOLVED') {
      patch.resolvedAt = ts;
    } else if (newStatus === 'CLOSED') {
      patch.closedAt = ts;
      patch.closedBy = userId;
    } else if (newStatus === 'REOPENED') {
      var reopenCount = Utils.toNumber(complaint.reopenCount, 0) + 1;
      patch.reopenCount = String(reopenCount);
    }

    var updated = Repository.withLock(function () {
      var u = Repository.updateById('Complaints', complaint.complaintId, patch, { userId: userId });
      addComplaintUpdate(
        complaint.complaintId,
        newStatus,
        ctx.payload.remarks || '',
        ctx.payload.correctiveAction || '',
        '',
        userId,
        userId
      );
      return u;
    }, 'complaint:transition');

    Audit.write({
      action: 'COMPLAINT_' + newStatus,
      entity: 'Complaints',
      entityId: complaint.complaintId,
      before: complaint,
      after: updated,
      reason: ctx.payload.remarks,
      sourceSheet: 'Complaints',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: updated };
  }

  /**
   * Get complaint history (update rows in ascending order).
   * @param {object} ctx
   * @return {{ ok: boolean, data: Array, page: object }}
   */
  function history(ctx) {
    var complaintId = ctx.payload.complaintId;
    var updates = readAll('Complaint_Updates', { complaintId: complaintId });
    updates.sort(function (a, b) { return (a.actionTakenAt || '').localeCompare(b.actionTakenAt || ''); });

    var o = ctx.payload || {};
    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = updates.length;
    var start = (page - 1) * pageSize;
    var paged = updates.slice(start, start + pageSize);

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
   * Complaint summary (counts by status/priority/category, avg resolution days).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function summary(ctx) {
    var complaints = readAll('Complaints');

    var total = complaints.length;
    var counts = { open: 0, assigned: 0, inProgress: 0, resolved: 0, closed: 0, cancelled: 0, reopened: 0 };
    var byPriority = {};
    var byCategory = {};
    var totalResolutionDays = 0;
    var resolvedCount = 0;

    for (var i = 0; i < complaints.length; i++) {
      var c = complaints[i];
      switch (c.statusKey) {
        case 'OPEN': counts.open++; break;
        case 'ASSIGNED': counts.assigned++; break;
        case 'IN_PROGRESS': counts.inProgress++; break;
        case 'RESOLVED': counts.resolved++; break;
        case 'CLOSED': counts.closed++; break;
        case 'CANCELLED': counts.cancelled++; break;
        case 'REOPENED': counts.reopened++; break;
      }

      var pKey = c.priorityKey || 'UNSET';
      byPriority[pKey] = (byPriority[pKey] || 0) + 1;

      var catKey = c.categoryId || 'UNSET';
      byCategory[catKey] = (byCategory[catKey] || 0) + 1;

      // Calculate resolution time for resolved/closed complaints
      if (c.resolvedAt && c.raisedAt) {
        var raised = new Date(c.raisedAt);
        var resolved = new Date(c.resolvedAt);
        var days = Math.floor((resolved - raised) / (24 * 60 * 60 * 1000));
        if (days >= 0) {
          totalResolutionDays += days;
          resolvedCount++;
        }
      }
    }

    return {
      ok: true,
      data: {
        total: total,
        counts: counts,
        byPriority: byPriority,
        byCategory: byCategory,
        avgResolutionDays: resolvedCount > 0 ? Utils.round2(totalResolutionDays / resolvedCount) : 0
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
    assign: assign,
    transition: transition,
    history: history,
    summary: summary,
    // Expose for testing
    TRANSITIONS: TRANSITIONS
  };
})();
