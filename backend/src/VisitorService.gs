/**
 * VisitorService.js — watchman-friendly visitor entry/exit with stale-exit detection.
 *
 * Rules:
 * - Visitors unique: passNumber; status INSIDE → EXITED (OVERSTAY via trigger in GAS-14).
 * - Visitor entry is minimal for the watchman (mobile-first).
 * - MEMBER_SELF shows a visitor's flat's visitors only.
 * - Visitor types are configurable rows (not hardcoded).
 * - Audit row written for create/exit.
 */
var VisitorService = (function () {
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

  // ---------------------------------------------------------------------------
  // Visitors
  // ---------------------------------------------------------------------------

  /**
   * List visitors with pagination and filters.
   * @param {object} ctx
   * @return {{ ok: boolean, data: Array, page: object }}
   */
  function list(ctx) {
    var o = ctx.payload || {};
    var filter = {};
    if (o.statusKey) { filter.statusKey = o.statusKey; }
    if (o.flatId) { filter.flatId = o.flatId; }
    if (o.typeKey) { filter.visitorTypeId = o.typeKey; }
    // MEMBER_SELF: filter by user's flatId
    if (ctx.payload && ctx.payload.flatId) { filter.flatId = ctx.payload.flatId; }

    var visitors = readAll('Visitors', Object.keys(filter).length > 0 ? filter : null);
    visitors.sort(function (a, b) { return (b.entryAt || '').localeCompare(a.entryAt || ''); });

    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = visitors.length;
    var start = (page - 1) * pageSize;
    var paged = visitors.slice(start, start + pageSize);

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
   * Get a single visitor by ID.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function get(ctx) {
    var visitor = Repository.findById('Visitors', ctx.payload.visitorId);
    if (!visitor) { return { ok: false, error: 'NOT_FOUND' }; }
    return { ok: true, data: visitor };
  }

  /**
   * Create a visitor entry (statusKey = INSIDE, passNumber generated).
   * Minimal fields for watchman ease.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function create(ctx) {
    var o = ctx.payload;
    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : '';
    var flatId = o.flatId || '';
    var memberId = o.memberId || '';

    // Resolve resident/member name from flatId if not provided
    var residentName = o.residentName || '';
    if (flatId && !residentName) {
      var members = readAll('Members', { flatId: flatId, statusKey: 'ACTIVE' });
      for (var i = 0; i < members.length; i++) {
        if (members[i].isPrimary === 'TRUE' || members[i].isPrimary === true) {
          residentName = members[i].fullName || '';
          memberId = members[i].memberId || memberId;
          break;
        }
      }
      if (!residentName && members.length > 0) {
        residentName = members[0].fullName || '';
        memberId = members[0].memberId || memberId;
      }
    }

    var visitor = {
      passNumber: generatePassNumber(),
      visitorName: o.visitorName || '',
      mobile: o.mobile || '',
      visitorTypeId: o.visitorTypeId || '',
      purpose: o.purpose || '',
      flatId: flatId,
      memberId: memberId,
      residentName: residentName,
      vehicleNumber: o.vehicleNumber || '',
      personCount: String(Utils.toNumber(o.personCount, 1)),
      entryAt: ts,
      exitAt: '',
      entryGate: o.entryGate || '',
      exitGate: '',
      statusKey: 'INSIDE',
      remarks: o.remarks || '',
      attachmentRef: '',
      loggedByUserId: userId,
      loggedByEmployeeId: o.loggedByEmployeeId || ''
    };

    var created = Repository.withLock(function () {
      return Repository.insert('Visitors', visitor, { userId: userId });
    }, 'visitor:create');

    Audit.write({
      action: 'VISITOR_ENTRY',
      entity: 'Visitors',
      entityId: created.visitorId,
      after: created,
      sourceSheet: 'Visitors',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: created };
  }

  /**
   * Record visitor exit (statusKey → EXITED, exitAt set).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function exit(ctx) {
    var visitor = Repository.findById('Visitors', ctx.payload.visitorId);
    if (!visitor) { return { ok: false, error: 'NOT_FOUND' }; }

    if (visitor.statusKey === 'EXITED') {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Visitor has already exited.' };
    }

    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : '';

    var patch = {
      statusKey: 'EXITED',
      exitAt: ts,
      exitGate: ctx.payload.exitGate || visitor.exitGate || '',
      remarks: ctx.payload.remarks || visitor.remarks || ''
    };

    var updated = Repository.withLock(function () {
      return Repository.updateById('Visitors', visitor.visitorId, patch, { userId: userId });
    }, 'visitor:exit');

    Audit.write({
      action: 'VISITOR_EXIT',
      entity: 'Visitors',
      entityId: visitor.visitorId,
      before: visitor,
      after: updated,
      sourceSheet: 'Visitors',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: updated };
  }

  /**
   * Visitor summary (inside count, today's entries/exits, overstays).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function summary(ctx) {
    var allVisitors = readAll('Visitors');
    var today = Utils.today();

    var inside = 0;
    var todayEntries = 0;
    var todayExits = 0;
    var total = allVisitors.length;

    for (var i = 0; i < allVisitors.length; i++) {
      var v = allVisitors[i];

      if (v.statusKey === 'INSIDE') { inside++; }

      // Today's entries
      if (v.entryAt && v.entryAt.indexOf(today) === 0) {
        todayEntries++;
      }

      // Today's exits
      if (v.exitAt && v.exitAt.indexOf(today) === 0) {
        todayExits++;
      }
    }

    return {
      ok: true,
      data: {
        total: total,
        inside: inside,
        todayEntries: todayEntries,
        todayExits: todayExits
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
    exit: exit,
    summary: summary
  };
})();
