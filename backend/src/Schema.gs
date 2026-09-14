/**
 * Schema.js — SINGLE SOURCE OF TRUTH for spreadsheets, sheets, columns, IDs, tail columns,
 * master-data entity descriptors and setup seeds.
 *
 * Every other file reads sheet/column knowledge from here. Nothing else may declare a sheet name or
 * column list (structure.md section 5). Tests assert that code never drifts from this file.
 */
var Schema = (function () {
  'use strict';

  var SCHEMA_VERSION = 1;
  var APP_VERSION = '1.0.0';

  /** Logical spreadsheet names (physical ids come from Script Properties). */
  var SPREADSHEETS = { AUTH: 'AUTH', SOCIETY: 'SOCIETY' };

  /** Row-1 header tails appended after every sheet's own columns. */
  var TAILS = {
    AUDIT: ['createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
    APPEND: ['createdAt', 'createdBy'],
    NONE: []
  };

  function cols(s) {
    return String(s).split(',').map(function (c) { return c.trim(); })
      .filter(function (c) { return c.length > 0; });
  }

  /**
   * Sheet definition helper.
   * @param {string} ss 'AUTH' | 'SOCIETY'
   * @param {string} prefix id prefix ('' when the sheet uses a natural key)
   * @param {string} idColumn primary-key column
   * @param {string} tail 'AUDIT' | 'APPEND' | 'NONE'
   * @param {string} colsCsv own columns, excluding the tail
   * @param {object} [opts] { label, archive, immutable, sortDefault }
   */
  function def(ss, prefix, idColumn, tail, colsCsv, opts) {
    var o = opts || {};
    return {
      spreadsheet: ss,
      prefix: prefix,
      idColumn: idColumn,
      tail: tail,
      own: cols(colsCsv),
      label: o.label || '',
      archive: !!o.archive,
      immutable: !!o.immutable,
      sortDefault: o.sortDefault || 'createdAt'
    };
  }

  // ------------------------------------------------------------- AUTH spreadsheet
  var SHEETS = {
    Users: def(SPREADSHEETS.AUTH, 'USR', 'userId', 'AUDIT',
      'username, email, mobile, fullName, passwordHash, passwordSalt, passwordAlgo, roleKeys, ' +
      'memberId, employeeId, flatId, statusKey, mustChangePassword, lastLoginAt, failedAttempts, ' +
      'lockedUntil, passwordChangedAt', { label: 'Users' }),

    Roles: def(SPREADSHEETS.AUTH, '', 'roleKey', 'AUDIT',
      'roleKey, roleName, description, isSystem, sortOrder, status', { label: 'Roles' }),

    Permissions: def(SPREADSHEETS.AUTH, '', 'permissionKey', 'NONE',
      'permissionKey, module, action, description, derivedFromRoute, status', { label: 'Permissions' }),

    Role_Permissions: def(SPREADSHEETS.AUTH, 'RPR', 'rolePermissionId', 'AUDIT',
      'roleKey, permissionKey, isAllowed', { label: 'Role Permissions' }),

    Sessions: def(SPREADSHEETS.AUTH, 'SES', 'sessionId', 'APPEND',
      'userId, tokenHash, issuedAt, expiresAt, lastSeenAt, deviceInfo, ipHash, statusKey, ' +
      'revokedAt, revokedBy', { label: 'Sessions', archive: true, immutable: true }),

    Auth_Audit: def(SPREADSHEETS.AUTH, 'AAU', 'authAuditId', 'APPEND',
      'ts, actorUserId, action, entity, entityId, detailJson, result, ipHash',
      { label: 'Auth Audit', archive: true, immutable: true }),

    // ---------------------------------------------------------- SOCIETY: system
    _Meta: def(SPREADSHEETS.SOCIETY, '', 'metaKey', 'NONE', 'metaValue, updatedAt, updatedBy',
      { label: 'Schema Meta' }),

    Society_Config: def(SPREADSHEETS.SOCIETY, '', 'configKey', 'NONE',
      'configValue, valueType, groupKey, label, description, isSecret, sortOrder, status, ' +
      'updatedAt, updatedBy', { label: 'Society Configuration' }),

    Status_Config: def(SPREADSHEETS.SOCIETY, 'STS', 'statusId', 'AUDIT',
      'domain, statusKey, statusName, isOpen, isTerminal, colorToken, sortOrder, status',
      { label: 'Statuses' }),

    // ---------------------------------------------------------- SOCIETY: types
    Wings: def(SPREADSHEETS.SOCIETY, 'WNG', 'wingId', 'AUDIT', 'wingName, description, sortOrder, status',
      { label: 'Wings' }),

    Flat_Types: def(SPREADSHEETS.SOCIETY, 'FTY', 'flatTypeId', 'AUDIT',
      'typeName, description, sortOrder, status', { label: 'Flat Types' }),

    Employee_Types: def(SPREADSHEETS.SOCIETY, 'ETY', 'employeeTypeId', 'AUDIT',
      'typeKey, typeName, description, sortOrder, status', { label: 'Employee Types' }),

    Vehicle_Types: def(SPREADSHEETS.SOCIETY, 'VTY', 'vehicleTypeId', 'AUDIT',
      'typeKey, typeName, isChargeable, sortOrder, status', { label: 'Vehicle Types' }),

    Notice_Types: def(SPREADSHEETS.SOCIETY, 'NTY', 'noticeTypeId', 'AUDIT',
      'typeKey, typeName, requiresAttachment, sortOrder, status', { label: 'Notice Types' }),

    Visitor_Types: def(SPREADSHEETS.SOCIETY, 'VST', 'visitorTypeId', 'AUDIT',
      'typeKey, typeName, requiresApproval, sortOrder, status', { label: 'Visitor Types' }),

    Parking_Types: def(SPREADSHEETS.SOCIETY, 'PTY', 'parkingTypeId', 'AUDIT',
      'typeKey, typeName, isChargeable, sortOrder, status', { label: 'Parking Types' }),

    Meeting_Types: def(SPREADSHEETS.SOCIETY, 'MTY', 'meetingTypeId', 'AUDIT',
      'typeKey, typeName, quorumPercent, sortOrder, status', { label: 'Meeting Types' }),

    Document_Categories: def(SPREADSHEETS.SOCIETY, 'DCAT', 'categoryId', 'AUDIT',
      'categoryKey, categoryName, driveFolderKey, driveFolderId, retentionMonths, sortOrder, status',
      { label: 'Document Categories' }),

    Complaint_Categories: def(SPREADSHEETS.SOCIETY, 'CCAT', 'categoryId', 'AUDIT',
      'categoryKey, categoryName, defaultAssigneeType, slaHours, sortOrder, status',
      { label: 'Complaint Categories' }),

    Complaint_Priorities: def(SPREADSHEETS.SOCIETY, 'CPRI', 'priorityId', 'AUDIT',
      'priorityKey, priorityName, slaHours, colorToken, sortOrder, status',
      { label: 'Complaint Priorities' }),

    Expense_Categories: def(SPREADSHEETS.SOCIETY, 'ECAT', 'categoryId', 'AUDIT',
      'categoryKey, categoryName, description, isSalaryCategory, sortOrder, status',
      { label: 'Expense Categories' }),

    Payment_Modes: def(SPREADSHEETS.SOCIETY, '', 'modeKey', 'AUDIT',
      'modeName, description, isCashLike, sortOrder, status', { label: 'Payment Modes' }),

    Charge_Types: def(SPREADSHEETS.SOCIETY, 'CTY', 'chargeTypeId', 'AUDIT',
      'chargeCode, chargeName, description, calculationMethod, defaultAmount, ratePerUnit, unitLabel, ' +
      'interestApplicable, sortOrder, status, effectiveFrom, effectiveTo', { label: 'Charge Types' }),

    Charge_Rates: def(SPREADSHEETS.SOCIETY, 'CRATE', 'chargeRateId', 'AUDIT',
      'chargeTypeId, amount, ratePerUnit, effectiveFrom, effectiveTo, remarks, status',
      { label: 'Charge Rates' }),

    Interest_Rules: def(SPREADSHEETS.SOCIETY, 'IRL', 'interestRuleId', 'AUDIT',
      'ruleName, ratePercent, compoundMethod, frequency, graceDays, minAmount, roundTo, isDefault, ' +
      'status, remarks', { label: 'Interest Rules' }),

    Numbering_Config: def(SPREADSHEETS.SOCIETY, 'NCFG', 'numberingId', 'AUDIT',
      'docType, pattern, prefix, sequenceLength, resetPolicy, nextSequence, lastResetToken, status',
      { label: 'Numbering' }),

    Billing_Periods: def(SPREADSHEETS.SOCIETY, 'BPR', 'periodId', 'AUDIT',
      'periodKey, periodFrom, periodTo, financialYear, dueDate, statusKey, generatedAt, generatedBy, ' +
      'lockedAt, lockedBy, remarks', { label: 'Billing Periods' }),

    // ---------------------------------------------------------- SOCIETY: master data
    Flats: def(SPREADSHEETS.SOCIETY, 'FLT', 'flatId', 'AUDIT',
      'wingId, flatNumber, floor, flatTypeId, carpetArea, builtUpArea, statusKey, occupancyType, ' +
      'sortOrder, remarks', { label: 'Flats' }),

    Members: def(SPREADSHEETS.SOCIETY, 'MBR', 'memberId', 'AUDIT',
      'flatId, memberCode, fullName, relationType, isPrimary, mobile, altMobile, email, address, ' +
      'moveInDate, moveOutDate, dateOfBirth, gender, emergencyName, emergencyMobile, idProofType, ' +
      'idProofNumber, statusKey, notes', { label: 'Members' }),

    Family_Members: def(SPREADSHEETS.SOCIETY, 'FAM', 'familyMemberId', 'AUDIT',
      'memberId, flatId, fullName, relation, dateOfBirth, gender, mobile, occupation, statusKey',
      { label: 'Family Members' }),

    Vehicles: def(SPREADSHEETS.SOCIETY, 'VEH', 'vehicleId', 'AUDIT',
      'memberId, flatId, vehicleTypeKey, vehicleNumber, makeModel, colour, statusKey',
      { label: 'Vehicles' }),

    Flat_Charges: def(SPREADSHEETS.SOCIETY, 'FCH', 'flatChargeId', 'AUDIT',
      'flatId, chargeTypeId, isActive, amountOverride, effectiveFrom, effectiveTo, remarks',
      { label: 'Flat Charges' }),

    Parking_Slots: def(SPREADSHEETS.SOCIETY, 'PRK', 'parkingSlotId', 'AUDIT',
      'slotNumber, parkingTypeId, wingId, floorLevel, location, statusKey, remarks',
      { label: 'Parking Slots' }),

    Employees: def(SPREADSHEETS.SOCIETY, 'EMP', 'employeeId', 'AUDIT',
      'employeeCode, fullName, employeeTypeId, mobile, altMobile, email, address, joinDate, exitDate, ' +
      'monthlySalary, statusKey, bankName, bankAccount, ifsc, emergencyName, emergencyMobile, ' +
      'idProofType, idProofNumber, notes', { label: 'Employees' }),

    Vendors: def(SPREADSHEETS.SOCIETY, 'VND', 'vendorId', 'AUDIT',
      'vendorName, categoryKey, contactPerson, mobile, altMobile, email, address, gstNumber, ' +
      'panNumber, bankName, bankAccount, ifsc, statusKey, notes', { label: 'Vendors' }),

    Vendors_AMC: def(SPREADSHEETS.SOCIETY, 'AMC', 'amcId', 'AUDIT',
      'vendorId, title, description, categoryKey, startDate, endDate, amount, paymentFrequencyKey, ' +
      'renewalReminderDays, documentId, statusKey, remarks', { label: 'Vendor AMC' }),

    // ---------------------------------------------------------- SOCIETY: finance
    Demands: def(SPREADSHEETS.SOCIETY, 'DMD', 'demandId', 'AUDIT',
      'demandNumber, periodId, periodKey, flatId, memberId, chargeTypeId, chargeNameSnapshot, ' +
      'calculationMethodSnapshot, rateSnapshot, basisSnapshot, quantitySnapshot, amount, ' +
      'previousDueAmount, interestAmount, adjustmentAmount, totalPayable, paidAmount, balanceAmount, ' +
      'statusKey, dueDate, isCarriedForward, generatedAt, generatedBy, cancelledAt, cancelledBy, ' +
      'cancelReason, remarks', { label: 'Demands' }),

    Payments: def(SPREADSHEETS.SOCIETY, 'PAY', 'paymentId', 'AUDIT',
      'receiptNumber, paymentDate, flatId, memberId, amount, allocatedAmount, unallocatedAmount, ' +
      'paymentModeKey, referenceNumber, bankName, remarks, statusKey, receivedBy, receivedAt, ' +
      'cancelledAt, cancelledBy, cancelReason, reversedFromPaymentId, attachmentRef',
      { label: 'Payments' }),

    Payment_Allocations: def(SPREADSHEETS.SOCIETY, 'PAL', 'allocationId', 'APPEND',
      'paymentId, demandId, periodKey, flatId, amount', { label: 'Payment Allocations', immutable: true }),

    Ledger: def(SPREADSHEETS.SOCIETY, 'LED', 'ledgerId', 'APPEND',
      'entryDate, periodKey, flatId, memberId, entryType, refType, refId, refNumber, debitAmount, ' +
      'creditAmount, runningBalance, narration', { label: 'Ledger', immutable: true }),

    Adjustments: def(SPREADSHEETS.SOCIETY, 'ADJ', 'adjustmentId', 'AUDIT',
      'flatId, memberId, demandId, periodKey, adjustmentType, amount, sign, reason, approvedBy, ' +
      'approvedAt, statusKey, attachmentRef', { label: 'Adjustments' }),

    Receipts: def(SPREADSHEETS.SOCIETY, 'RCP', 'receiptId', 'APPEND',
      'receiptNumber, paymentId, flatId, memberId, amount, paymentDate, issuedAt, issuedBy, ' +
      'templateKey, driveFileId, printCount, lastPrintedAt, statusKey',
      { label: 'Receipts', immutable: true }),

    Expenses: def(SPREADSHEETS.SOCIETY, 'EXP', 'expenseId', 'AUDIT',
      'expenseNumber, expenseDate, periodKey, categoryId, description, vendorId, payeeName, amount, ' +
      'paymentModeKey, referenceNumber, paidBy, attachmentRef, remarks, statusKey, cancelledAt, ' +
      'cancelledBy, cancelReason', { label: 'Expenses' }),

    // ---------------------------------------------------------- SOCIETY: operations
    Complaints: def(SPREADSHEETS.SOCIETY, 'CMP', 'complaintId', 'AUDIT',
      'complaintNumber, categoryId, priorityKey, title, description, flatId, memberId, ' +
      'raisedByMemberId, raisedAt, source, statusKey, assignedToType, assignedToId, assignedAt, ' +
      'assignedBy, targetDate, resolvedAt, closedAt, closedBy, correctiveAction, resolutionRemarks, ' +
      'attachmentRef, reopenCount', { label: 'Complaints' }),

    Complaint_Updates: def(SPREADSHEETS.SOCIETY, 'CUP', 'complaintUpdateId', 'APPEND',
      'complaintId, statusKey, remarks, correctiveAction, actionTakenByType, actionTakenById, ' +
      'actionTakenAt, attachmentRef', { label: 'Complaint Updates', immutable: true }),

    Visitors: def(SPREADSHEETS.SOCIETY, 'VIS', 'visitorId', 'AUDIT',
      'passNumber, visitorName, mobile, visitorTypeId, purpose, flatId, memberId, residentName, ' +
      'vehicleNumber, personCount, entryAt, exitAt, entryGate, exitGate, statusKey, remarks, ' +
      'attachmentRef, loggedByUserId, loggedByEmployeeId', { label: 'Visitors' }),

    Notices: def(SPREADSHEETS.SOCIETY, 'NOT', 'noticeId', 'AUDIT',
      'noticeNumber, title, noticeTypeId, noticeDate, publishDate, expiryDate, description, ' +
      'audienceType, audienceRef, isPublished, publishedAt, publishedBy, unpublishReason, isPinned, ' +
      'attachmentRef, statusKey', { label: 'Notices' }),

    Meetings: def(SPREADSHEETS.SOCIETY, 'MTG', 'meetingId', 'AUDIT',
      'meetingNumber, meetingTypeKey, title, meetingDate, startTime, endTime, venue, agenda, ' +
      'minutes, resolutions, quorumRequired, quorumPresent, conductedBy, statusKey, linkedDocumentIds',
      { label: 'Meetings' }),

    Meeting_Attendance: def(SPREADSHEETS.SOCIETY, 'MTA', 'meetingAttendanceId', 'AUDIT',
      'meetingId, attendeeType, attendeeId, attendeeName, flatId, roleInMeeting, isPresent, remarks',
      { label: 'Meeting Attendance' }),

    Documents: def(SPREADSHEETS.SOCIETY, 'DOC', 'documentId', 'AUDIT',
      'documentNumber, title, categoryId, description, tags, linkedEntityType, linkedEntityId, ' +
      'fileRef, versionNo, isArchived, effectiveDate, expiryDate, uploadedAt, uploadedBy, statusKey',
      { label: 'Documents' }),

    Parking_Allocations: def(SPREADSHEETS.SOCIETY, 'PKA', 'allocationId', 'AUDIT',
      'parkingSlotId, flatId, memberId, vehicleId, vehicleNumber, allocationType, startDate, endDate, ' +
      'monthlyCharge, statusKey, remarks', { label: 'Parking Allocations' }),

    Employee_Attendance: def(SPREADSHEETS.SOCIETY, 'ATT', 'attendanceId', 'AUDIT',
      'employeeId, attendanceDate, statusKey, inTime, outTime, workedHours, overtimeHours, remarks, ' +
      'markedByUserId, markedAt', { label: 'Employee Attendance' }),

    Employee_Salary: def(SPREADSHEETS.SOCIETY, 'SAL', 'salaryId', 'AUDIT',
      'employeeId, periodKey, baseSalary, workingDays, presentDays, absentDays, leaveDays, halfDays, ' +
      'holidayDays, perDayAmount, attendanceAdjustment, overtimeHours, overtimeAmount, allowanceAmount, ' +
      'advanceDeduction, otherDeduction, bonusAmount, otherAdjustment, netSalary, paymentDate, ' +
      'paymentModeKey, referenceNumber, statusKey, remarks, attachmentRef', { label: 'Employee Salary' }),

    // ---------------------------------------------------------- SOCIETY: system records
    Audit_Log: def(SPREADSHEETS.SOCIETY, 'AUD', 'auditId', 'APPEND',
      'ts, actorUserId, actorName, actorRoleKeys, action, entity, entityId, entityLabel, beforeJson, ' +
      'afterJson, changedFields, reason, sourceSheet, ipHash, requestId, result',
      { label: 'Audit Log', archive: true, immutable: true }),

    Backups: def(SPREADSHEETS.SOCIETY, 'BKP', 'backupId', 'APPEND',
      'scope, spreadsheetIds, driveFolderId, filesJson, sheetRowCountsJson, appVersion, schemaVersion, ' +
      'sizeBytes, checksum, statusKey, notes', { label: 'Backups', immutable: true }),

    Archive_Jobs: def(SPREADSHEETS.SOCIETY, 'ARC', 'archiveJobId', 'APPEND',
      'entity, sourceSheet, targetSheet, fromDate, toDate, movedCount, skippedCount, statusKey, ' +
      'startedAt, finishedAt, startedBy, errorMessage', { label: 'Archive Jobs', immutable: true }),

    Archive_Index: def(SPREADSHEETS.SOCIETY, 'ARX', 'archiveIndexId', 'APPEND',
      'entity, archiveSheet, originalId, keyFieldsJson, archivedAt, archivedBy, reason',
      { label: 'Archive Index', immutable: true })
  };

  /** Sheets that are appended-once and must never be edited in place. */
  function isImmutable(name) { var d = SHEETS[name]; return !!(d && d.immutable); }

  /** Full header list for a sheet: idColumn + own columns followed by its declared tail. */
  function columnsOf(name) {
    var d = SHEETS[name];
    if (!d) { throw new Error('Unknown sheet: ' + name); }
    var cols = [];
    if (d.idColumn && d.own.indexOf(d.idColumn) === -1) {
      cols.push(d.idColumn);
    }
    return cols.concat(d.own).concat(TAILS[d.tail] || []);
  }

  function get(name) {
    var d = SHEETS[name];
    if (!d) { throw new Error('Unknown sheet: ' + name); }
    return d;
  }

  function exists(name) { return !!SHEETS[name]; }

  function spreadsheetOf(name) { return get(name).spreadsheet; }

  function idColumnOf(name) { return get(name).idColumn; }

  function prefixOf(name) { return get(name).prefix; }

  function sheetNames() { return Object.keys(SHEETS); }

  function sheetNamesFor(spreadsheet) {
    return sheetNames().filter(function (n) { return SHEETS[n].spreadsheet === spreadsheet; });
  }

  /** Archive sheet name for an archivable sheet (created lazily by Setup/BackupService). */
  function archiveSheetName(sheetName) { return 'Archive_' + sheetName; }

  function archivableSheets() {
    return sheetNames().filter(function (n) { return SHEETS[n].archive; });
  }

  /** Resolve a sheet name from a logical entity label (used by Audit_Log / Archive_Index). */
  function entityToSheet(entity) {
    var names = sheetNames();
    for (var i = 0; i < names.length; i++) {
      if (names[i].toLowerCase() === String(entity).toLowerCase()) { return names[i]; }
    }
    return null;
  }

  /** Sheet used by a master-data entity key (delegates to SchemaMeta to avoid a cycle). */
  function sheetForMasterEntity(entityKey) {
    if (typeof SchemaMeta === 'undefined') { return null; }
    var def_ = SchemaMeta.MASTER_ENTITIES[entityKey];
    return def_ ? def_.sheet : null;
  }

  /** Archive sheet names required for archivable sheets (schema test S10). */
  function requiredArchiveSheets() {
    return archivableSheets().map(archiveSheetName);
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    APP_VERSION: APP_VERSION,
    SPREADSHEETS: SPREADSHEETS,
    TAILS: TAILS,
    SHEETS: SHEETS,
    cols: cols,
    def: def,
    get: get,
    exists: exists,
    columnsOf: columnsOf,
    spreadsheetOf: spreadsheetOf,
    idColumnOf: idColumnOf,
    prefixOf: prefixOf,
    isImmutable: isImmutable,
    sheetNames: sheetNames,
    sheetNamesFor: sheetNamesFor,
    archivableSheets: archivableSheets,
    archiveSheetName: archiveSheetName,
    entityToSheet: entityToSheet,
    sheetForMasterEntity: sheetForMasterEntity,
    requiredArchiveSheets: requiredArchiveSheets
  };
})();