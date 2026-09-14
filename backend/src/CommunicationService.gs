/**
 * CommunicationService.js — Notices and Meetings CRUD, attendance marking.
 *
 * Authority: GAS-10-Notices-and-Meetings.md, SRS §6, §8, database-schema.md §11.
 *
 * Key rules:
 * - Notices unique: noticeNumber; status DRAFT → PUBLISHED → EXPIRED; unpublish requires reason.
 * - audienceType in { ALL, ROLE, WING, FLAT, MEMBER } + audienceRef; MEMBER_SELF filtered by audience.
 * - Meetings unique: meetingNumber; status SCHEDULED → COMPLETED / CANCELLED / POSTPONED.
 * - Meeting_Attendance: attendeeType in { MEMBER, EMPLOYEE, VENDOR, GUEST }; upsert per attendee.
 * - linkedDocumentIds links meetings to the Documents module.
 * - quorumRequired/quorumPresent tracked on attendance mark.
 * - Notice types and meeting types are configurable rows (not hardcoded).
 * - MEMBER_SELF: notices filtered by audience; meetings accessible to members of the flat.
 */
var CommunicationService = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Helpers — findByUnique (same pattern as VisitorService / PaymentService)
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Notice actions
  // ---------------------------------------------------------------------------

  /**
   * notices.list — paginated notice list with MEMBER_SELF audience filtering.
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, page?: object, error?: string }}
   */
  function listNotices(ctx) {
    var p = ctx.payload || {};
    var filter = {};
    if (p.noticeTypeId) { filter.noticeTypeId = p.noticeTypeId; }
    if (p.isPublished !== undefined) { filter.isPublished = p.isPublished ? 'TRUE' : 'FALSE'; }

    var result = Repository.readSheet('Notices', {
      page: p.page || 1,
      pageSize: p.pageSize || CONFIG.pageSizeDefault(),
      search: p.search || '',
      searchFields: ['title', 'description', 'noticeNumber'],
      sort: p.sort || 'noticeDate',
      sortDir: p.sortDir || 'desc',
      filter: filter
    });

    // Resolve notice type names
    var typeMap = buildNoticeTypeMap();
    var notices = result.rows.map(function (n) {
      n.noticeTypeName = typeMap[n.noticeTypeId] || '';
      return n;
    });

    // MEMBER_SELF audience filtering
    if (ctx.user && ctx.user.flatId) {
      notices = filterByAudience(notices, ctx.user);
    }

    return { ok: true, data: notices, page: result.page };
  }

  /**
   * notices.get — single notice.
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string }}
   */
  function getNotice(ctx) {
    var noticeId = ctx.payload.noticeId;
    var notice = Repository.findById('Notices', noticeId);
    if (!notice) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    // Resolve notice type name
    var typeMap = buildNoticeTypeMap();
    notice.noticeTypeName = typeMap[notice.noticeTypeId] || '';

    return { ok: true, data: notice };
  }

  /**
   * notices.create — create a notice with status DRAFT.
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string, details?: Array }}
   */
  function createNotice(ctx) {
    var p = ctx.payload || {};
    var errors = [];

    // Validate noticeTypeId
    if (p.noticeTypeId) {
      var type = Repository.findById('Notice_Types', p.noticeTypeId);
      if (!type) {
        errors.push({ field: 'noticeTypeId', message: 'Notice type not found.' });
      } else if (type.status === 'INACTIVE') {
        errors.push({ field: 'noticeTypeId', message: 'Notice type is inactive.' });
      }
    }

    // Validate audienceType
    var validAudiences = ['ALL', 'ROLE', 'WING', 'FLAT', 'MEMBER'];
    if (p.audienceType && validAudiences.indexOf(p.audienceType) === -1) {
      errors.push({ field: 'audienceType', message: 'Invalid audience type.' });
    }

    if (errors.length > 0) {
      return { ok: false, error: 'VALIDATION_ERROR', details: errors };
    }

    var record = {
      noticeNumber: generateNoticeNumber(),
      title: String(p.title || '').trim(),
      noticeTypeId: p.noticeTypeId || '',
      noticeDate: p.noticeDate || Utils.today(),
      publishDate: '',
      expiryDate: p.expiryDate || '',
      description: p.description || '',
      audienceType: p.audienceType || 'ALL',
      audienceRef: p.audienceRef || '',
      isPublished: 'FALSE',
      publishedAt: '',
      publishedBy: '',
      unpublishReason: '',
      isPinned: p.isPinned ? 'TRUE' : 'FALSE',
      attachmentRef: p.attachmentRef || '',
      statusKey: 'DRAFT'
    };

    var created = Repository.withLock(function () {
      return Repository.insert('Notices', record, { userId: ctx.user.userId });
    }, 'notices:create');

    Audit.write({
      action: 'NOTICE_CREATED',
      entity: 'Notices',
      entityId: created.noticeId,
      entityLabel: created.title,
      after: created,
      sourceSheet: 'Notices',
      requestId: ctx.requestId,
      actor: { userId: ctx.user.userId, name: ctx.user.fullName || '', roleKeys: Utils.csvToArray(ctx.user.roleKeys) }
    });

    return { ok: true, data: created };
  }

  /**
   * notices.update — update a notice (only DRAFT notices are editable).
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string, details?: Array }}
   */
  function updateNotice(ctx) {
    var p = ctx.payload || {};
    var noticeId = p.noticeId;
    var existing = Repository.findById('Notices', noticeId);
    if (!existing) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    // Only DRAFT notices are editable
    if (existing.statusKey !== 'DRAFT') {
      return { ok: false, error: 'CONFLICT_ERROR', message: 'Only draft notices can be edited.' };
    }

    var errors = [];
    var patch = {};

    // Validate noticeTypeId if changing
    if (p.noticeTypeId && p.noticeTypeId !== existing.noticeTypeId) {
      var type = Repository.findById('Notice_Types', p.noticeTypeId);
      if (!type) {
        errors.push({ field: 'noticeTypeId', message: 'Notice type not found.' });
      }
      patch.noticeTypeId = p.noticeTypeId;
    }

    // Validate audienceType if changing
    if (p.audienceType && p.audienceType !== existing.audienceType) {
      var validAudiences = ['ALL', 'ROLE', 'WING', 'FLAT', 'MEMBER'];
      if (validAudiences.indexOf(p.audienceType) === -1) {
        errors.push({ field: 'audienceType', message: 'Invalid audience type.' });
      }
      patch.audienceType = p.audienceType;
    }

    // Copy allowed fields
    var allowedFields = ['title', 'noticeDate', 'expiryDate', 'description', 'audienceRef', 'isPinned', 'attachmentRef'];
    for (var i = 0; i < allowedFields.length; i++) {
      var field = allowedFields[i];
      if (p[field] !== undefined) {
        patch[field] = p[field];
      }
    }

    if (errors.length > 0) {
      return { ok: false, error: 'VALIDATION_ERROR', details: errors };
    }

    if (Object.keys(patch).length === 0) {
      return { ok: true, data: existing };
    }

    var beforeState = Object.assign({}, existing);

    var updated = Repository.withLock(function () {
      return Repository.updateById('Notices', noticeId, patch, { userId: ctx.user.userId });
    }, 'notices:update');

    Audit.write({
      action: 'NOTICE_UPDATED',
      entity: 'Notices',
      entityId: noticeId,
      entityLabel: updated.title || existing.title,
      before: beforeState,
      after: updated,
      sourceSheet: 'Notices',
      requestId: ctx.requestId,
      actor: { userId: ctx.user.userId, name: ctx.user.fullName || '', roleKeys: Utils.csvToArray(ctx.user.roleKeys) }
    });

    return { ok: true, data: updated };
  }

  /**
   * notices.publish — publish a notice (status DRAFT → PUBLISHED).
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string }}
   */
  function publishNotice(ctx) {
    var noticeId = ctx.payload.noticeId;
    var existing = Repository.findById('Notices', noticeId);
    if (!existing) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    if (existing.statusKey !== 'DRAFT') {
      return { ok: false, error: 'CONFLICT_ERROR', message: 'Only draft notices can be published.' };
    }

    var patch = {
      statusKey: 'PUBLISHED',
      isPublished: 'TRUE',
      publishedAt: Utils.now(),
      publishedBy: ctx.user.userId,
      publishDate: ctx.payload.publishDate || Utils.today()
    };
    if (ctx.payload.expiryDate) {
      patch.expiryDate = ctx.payload.expiryDate;
    }

    var beforeState = Object.assign({}, existing);

    var updated = Repository.withLock(function () {
      return Repository.updateById('Notices', noticeId, patch, { userId: ctx.user.userId });
    }, 'notices:publish');

    Audit.write({
      action: 'NOTICE_PUBLISHED',
      entity: 'Notices',
      entityId: noticeId,
      entityLabel: existing.title,
      before: beforeState,
      after: updated,
      sourceSheet: 'Notices',
      requestId: ctx.requestId,
      actor: { userId: ctx.user.userId, name: ctx.user.fullName || '', roleKeys: Utils.csvToArray(ctx.user.roleKeys) }
    });

    return { ok: true, data: updated };
  }

  /**
   * notices.unpublish — unpublish a notice (requires reason, audited).
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string }}
   */
  function unpublishNotice(ctx) {
    var noticeId = ctx.payload.noticeId;
    var reason = ctx.payload.reason;
    var existing = Repository.findById('Notices', noticeId);
    if (!existing) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    if (existing.statusKey !== 'PUBLISHED') {
      return { ok: false, error: 'CONFLICT_ERROR', message: 'Only published notices can be unpublished.' };
    }

    var patch = {
      statusKey: 'DRAFT',
      isPublished: 'FALSE',
      unpublishReason: reason || ''
    };

    var beforeState = Object.assign({}, existing);

    var updated = Repository.withLock(function () {
      return Repository.updateById('Notices', noticeId, patch, { userId: ctx.user.userId });
    }, 'notices:unpublish');

    Audit.write({
      action: 'NOTICE_UNPUBLISHED',
      entity: 'Notices',
      entityId: noticeId,
      entityLabel: existing.title,
      before: beforeState,
      after: updated,
      reason: reason,
      sourceSheet: 'Notices',
      requestId: ctx.requestId,
      actor: { userId: ctx.user.userId, name: ctx.user.fullName || '', roleKeys: Utils.csvToArray(ctx.user.roleKeys) }
    });

    return { ok: true, data: updated };
  }

  // ---------------------------------------------------------------------------
  // Meeting actions
  // ---------------------------------------------------------------------------

  /**
   * meetings.list — paginated meeting list.
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, page?: object, error?: string }}
   */
  function listMeetings(ctx) {
    var p = ctx.payload || {};
    var filter = {};
    if (p.meetingTypeId) { filter.meetingTypeKey = p.meetingTypeId; }
    if (p.statusKey) { filter.statusKey = p.statusKey; }

    var result = Repository.readSheet('Meetings', {
      page: p.page || 1,
      pageSize: p.pageSize || CONFIG.pageSizeDefault(),
      search: p.search || '',
      searchFields: ['title', 'venue', 'agenda', 'meetingNumber'],
      sort: p.sort || 'meetingDate',
      sortDir: p.sortDir || 'desc',
      filter: filter
    });

    // Resolve meeting type names
    var typeMap = buildMeetingTypeMap();
    var meetings = result.rows.map(function (m) {
      m.meetingTypeName = typeMap[m.meetingTypeKey] || '';
      return m;
    });

    return { ok: true, data: meetings, page: result.page };
  }

  /**
   * meetings.get — single meeting with attendance and linked document references.
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string }}
   */
  function getMeeting(ctx) {
    var meetingId = ctx.payload.meetingId;
    var meeting = Repository.findById('Meetings', meetingId);
    if (!meeting) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    // Resolve meeting type name
    var typeMap = buildMeetingTypeMap();
    meeting.meetingTypeName = typeMap[meeting.meetingTypeKey] || '';

    // Get attendance
    var attendanceResult = Repository.readSheet('Meeting_Attendance', {
      filter: { meetingId: meetingId },
      pageSize: 200
    });
    meeting.attendance = attendanceResult.rows;

    // Resolve linked documents (if any)
    if (meeting.linkedDocumentIds) {
      var docIds = Utils.csvToArray(meeting.linkedDocumentIds);
      var docs = [];
      for (var i = 0; i < docIds.length; i++) {
        var doc = Repository.findById('Documents', docIds[i]);
        if (doc) { docs.push(doc); }
      }
      meeting.linkedDocuments = docs;
    } else {
      meeting.linkedDocuments = [];
    }

    return { ok: true, data: meeting };
  }

  /**
   * meetings.create — create a meeting with status SCHEDULED.
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string, details?: Array }}
   */
  function createMeeting(ctx) {
    var p = ctx.payload || {};
    var errors = [];

    // Validate meetingTypeKey
    if (p.meetingTypeKey) {
      var type = findByUnique('Meeting_Types', { typeKey: p.meetingTypeKey });
      if (!type) {
        errors.push({ field: 'meetingTypeKey', message: 'Meeting type not found.' });
      } else if (type.status === 'INACTIVE') {
        errors.push({ field: 'meetingTypeKey', message: 'Meeting type is inactive.' });
      }
    }

    if (errors.length > 0) {
      return { ok: false, error: 'VALIDATION_ERROR', details: errors };
    }

    var record = {
      meetingNumber: generateMeetingNumber(),
      meetingTypeKey: p.meetingTypeKey || '',
      title: String(p.title || '').trim(),
      meetingDate: p.meetingDate || Utils.today(),
      startTime: p.startTime || '',
      endTime: p.endTime || '',
      venue: p.venue || '',
      agenda: p.agenda || '',
      minutes: '',
      resolutions: '',
      quorumRequired: p.quorumRequired || '',
      quorumPresent: '',
      conductedBy: p.conductedBy || '',
      statusKey: 'SCHEDULED',
      linkedDocumentIds: ''
    };

    var created = Repository.withLock(function () {
      return Repository.insert('Meetings', record, { userId: ctx.user.userId });
    }, 'meetings:create');

    Audit.write({
      action: 'MEETING_CREATED',
      entity: 'Meetings',
      entityId: created.meetingId,
      entityLabel: created.title,
      after: created,
      sourceSheet: 'Meetings',
      requestId: ctx.requestId,
      actor: { userId: ctx.user.userId, name: ctx.user.fullName || '', roleKeys: Utils.csvToArray(ctx.user.roleKeys) }
    });

    return { ok: true, data: created };
  }

  /**
   * meetings.update — update a meeting.
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string, details?: Array }}
   */
  function updateMeeting(ctx) {
    var p = ctx.payload || {};
    var meetingId = p.meetingId;
    var existing = Repository.findById('Meetings', meetingId);
    if (!existing) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    var errors = [];
    var patch = {};

    // Validate meetingTypeKey if changing
    if (p.meetingTypeKey && p.meetingTypeKey !== existing.meetingTypeKey) {
      var type = findByUnique('Meeting_Types', { typeKey: p.meetingTypeKey });
      if (!type) {
        errors.push({ field: 'meetingTypeKey', message: 'Meeting type not found.' });
      }
      patch.meetingTypeKey = p.meetingTypeKey;
    }

    // Validate statusKey if changing
    if (p.statusKey && p.statusKey !== existing.statusKey) {
      var validStatuses = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'POSTPONED'];
      if (validStatuses.indexOf(p.statusKey) === -1) {
        errors.push({ field: 'statusKey', message: 'Invalid meeting status.' });
      }
      patch.statusKey = p.statusKey;
    }

    // Copy allowed fields
    var allowedFields = ['title', 'meetingDate', 'startTime', 'endTime', 'venue', 'agenda', 'minutes', 'resolutions', 'quorumRequired', 'conductedBy', 'linkedDocumentIds'];
    for (var i = 0; i < allowedFields.length; i++) {
      var field = allowedFields[i];
      if (p[field] !== undefined) {
        patch[field] = p[field];
      }
    }

    if (errors.length > 0) {
      return { ok: false, error: 'VALIDATION_ERROR', details: errors };
    }

    if (Object.keys(patch).length === 0) {
      return { ok: true, data: existing };
    }

    var beforeState = Object.assign({}, existing);

    var updated = Repository.withLock(function () {
      return Repository.updateById('Meetings', meetingId, patch, { userId: ctx.user.userId });
    }, 'meetings:update');

    Audit.write({
      action: 'MEETING_UPDATED',
      entity: 'Meetings',
      entityId: meetingId,
      entityLabel: updated.title || existing.title,
      before: beforeState,
      after: updated,
      sourceSheet: 'Meetings',
      requestId: ctx.requestId,
      actor: { userId: ctx.user.userId, name: ctx.user.fullName || '', roleKeys: Utils.csvToArray(ctx.user.roleKeys) }
    });

    return { ok: true, data: updated };
  }

  // ---------------------------------------------------------------------------
  // Meeting Attendance actions
  // ---------------------------------------------------------------------------

  /**
   * meetings.attendance.list — list attendance rows for a meeting.
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string }}
   */
  function listAttendance(ctx) {
    var meetingId = ctx.payload.meetingId;
    var meeting = Repository.findById('Meetings', meetingId);
    if (!meeting) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    var result = Repository.readSheet('Meeting_Attendance', {
      filter: { meetingId: meetingId },
      pageSize: 200
    });

    return { ok: true, data: result.rows };
  }

  /**
   * meetings.attendance.mark — upsert attendance rows and update quorumPresent.
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string, details?: Array }}
   */
  function markAttendance(ctx) {
    var p = ctx.payload || {};
    var meetingId = p.meetingId;
    var rows = p.rows || [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: 'VALIDATION_ERROR', details: [{ field: 'rows', message: 'Attendance rows are required.' }] };
    }

    var meeting = Repository.findById('Meetings', meetingId);
    if (!meeting) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    var errors = [];
    var validAttendeeTypes = ['MEMBER', 'EMPLOYEE', 'VENDOR', 'GUEST'];

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row.attendeeType || validAttendeeTypes.indexOf(row.attendeeType) === -1) {
        errors.push({ field: 'rows[' + i + '].attendeeType', message: 'Invalid attendee type.' });
      }
      if (!row.attendeeId && !row.attendeeName) {
        errors.push({ field: 'rows[' + i + '].attendeeId', message: 'Attendee ID or name is required.' });
      }
    }

    if (errors.length > 0) {
      return { ok: false, error: 'VALIDATION_ERROR', details: errors };
    }

    var upserted = [];
    var presentCount = 0;

    Repository.withLock(function () {
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var attendeeId = row.attendeeId || '';
        var attendeeType = row.attendeeType;

        // Find existing attendance row for this meeting + attendee
        var existingFilter = { meetingId: meetingId, attendeeType: attendeeType };
        if (attendeeId) { existingFilter.attendeeId = attendeeId; }

        var existingResult = Repository.readSheet('Meeting_Attendance', {
          filter: existingFilter,
          pageSize: 10
        });
        var existingRow = existingResult.rows.length > 0 ? existingResult.rows[0] : null;

        var patch = {
          attendeeName: row.attendeeName || '',
          flatId: row.flatId || '',
          roleInMeeting: row.roleInMeeting || '',
          isPresent: row.isPresent ? 'TRUE' : 'FALSE',
          remarks: row.remarks || ''
        };

        if (existingRow) {
          var updated = Repository.updateById('Meeting_Attendance', existingRow.meetingAttendanceId, patch, { userId: ctx.user.userId });
          upserted.push(updated);
        } else {
          var newRecord = {
            meetingId: meetingId,
            attendeeType: attendeeType,
            attendeeId: attendeeId,
            attendeeName: row.attendeeName || '',
            flatId: row.flatId || '',
            roleInMeeting: row.roleInMeeting || '',
            isPresent: row.isPresent ? 'TRUE' : 'FALSE',
            remarks: row.remarks || ''
          };
          var created = Repository.insert('Meeting_Attendance', newRecord, { userId: ctx.user.userId });
          upserted.push(created);
        }

        if (row.isPresent) { presentCount++; }
      }

      // Update quorumPresent on the meeting
      Repository.updateById('Meetings', meetingId, {
        quorumPresent: String(presentCount)
      }, { userId: ctx.user.userId });
    }, 'meetings:attendance:mark');

    Audit.write({
      action: 'MEETING_ATTENDANCE_MARKED',
      entity: 'Meetings',
      entityId: meetingId,
      entityLabel: meeting.title,
      after: { quorumPresent: String(presentCount), rowCount: rows.length },
      sourceSheet: 'Meeting_Attendance',
      requestId: ctx.requestId,
      actor: { userId: ctx.user.userId, name: ctx.user.fullName || '', roleKeys: Utils.csvToArray(ctx.user.roleKeys) }
    });

    return { ok: true, data: { attendance: upserted, quorumPresent: presentCount } };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Filter notices by audienceType/audienceRef for MEMBER_SELF.
   * ALL → visible to all; ROLE → visible to matching roles; WING → matching wing;
   * FLAT → matching flat; MEMBER → matching member.
   * @param {Array} notices
   * @param {object} user
   * @return {Array}
   */
  function filterByAudience(notices, user) {
    return notices.filter(function (n) {
      if (n.statusKey !== 'PUBLISHED') { return false; }
      var type = n.audienceType || 'ALL';
      if (type === 'ALL') { return true; }
      if (type === 'ROLE') {
        var roles = Utils.csvToArray(n.audienceRef);
        var userRoles = Utils.csvToArray(user.roleKeys);
        return roles.some(function (r) { return userRoles.indexOf(r) !== -1; });
      }
      if (type === 'WING') {
        // If user has a flatId, check if the flat's wing is in audienceRef
        if (!user.flatId) { return false; }
        var flat = Repository.findById('Flats', user.flatId);
        if (!flat) { return false; }
        var wings = Utils.csvToArray(n.audienceRef);
        return wings.indexOf(flat.wingId) !== -1;
      }
      if (type === 'FLAT') {
        var flatIds = Utils.csvToArray(n.audienceRef);
        return flatIds.indexOf(user.flatId) !== -1;
      }
      if (type === 'MEMBER') {
        var memberIds = Utils.csvToArray(n.audienceRef);
        return memberIds.indexOf(user.memberId) !== -1;
      }
      return false;
    });
  }

  /**
   * Generate a notice number using Numbering_Config pattern.
   * @return {string}
   */
  function generateNoticeNumber() {
    return generateDocNumber('NOTICE', 'NOT');
  }

  /**
   * Generate a meeting number using Numbering_Config pattern.
   * @return {string}
   */
  function generateMeetingNumber() {
    return generateDocNumber('MEETING', 'MTG');
  }

  /**
   * Generate a document number from Numbering_Config.
   * @param {string} docType
   * @param {string} fallbackPrefix
   * @return {string}
   */
  function generateDocNumber(docType, fallbackPrefix) {
    var rec = findByUnique('Numbering_Config', { docType: docType, status: 'ACTIVE' });
    if (rec) {
      var seq = parseInt(rec.nextSequence || '1', 10);
      var seqLen = parseInt(rec.sequenceLength || '4', 10);
      var seqStr = String(seq);
      while (seqStr.length < seqLen) { seqStr = '0' + seqStr; }

      var fy = Utils.financialYear();
      var pattern = rec.pattern || (fallbackPrefix + '/{fy}/{seq}');
      var number = pattern
        .replace('{fy}', fy)
        .replace('{yy}', fy.slice(-2))
        .replace('{mm}', Utils.formatDate(new Date()).slice(5, 7))
        .replace('{seq}', seqStr);

      Repository.withLock(function () {
        Repository.updateById('Numbering_Config', rec.numberingId, {
          nextSequence: String(seq + 1)
        }, { userId: 'SYSTEM' });
      }, 'numbering:increment');

      return number;
    }
    return fallbackPrefix + '/' + Utils.today();
  }

  /**
   * Build a map of noticeTypeId → typeName.
   * @return {object}
   */
  function buildNoticeTypeMap() {
    var map = {};
    var sheet = Repository.getSheet('Notice_Types');
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return map; }
    var columns = Schema.columnsOf('Notice_Types');
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow('Notice_Types', values[i]);
      if (rec.noticeTypeId && rec.status === 'ACTIVE') {
        map[rec.noticeTypeId] = rec.typeName;
      }
    }
    return map;
  }

  /**
   * Build a map of meetingTypeKey → typeName.
   * @return {object}
   */
  function buildMeetingTypeMap() {
    var map = {};
    var sheet = Repository.getSheet('Meeting_Types');
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return map; }
    var columns = Schema.columnsOf('Meeting_Types');
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow('Meeting_Types', values[i]);
      if (rec.meetingTypeId && rec.status === 'ACTIVE') {
        map[rec.typeKey] = rec.typeName;
      }
    }
    return map;
  }

  // ---------------------------------------------------------------------------
  // Expose
  // ---------------------------------------------------------------------------

  return {
    listNotices: listNotices,
    getNotice: getNotice,
    createNotice: createNotice,
    updateNotice: updateNotice,
    publishNotice: publishNotice,
    unpublishNotice: unpublishNotice,
    listMeetings: listMeetings,
    getMeeting: getMeeting,
    createMeeting: createMeeting,
    updateMeeting: updateMeeting,
    listAttendance: listAttendance,
    markAttendance: markAttendance
  };
})();
