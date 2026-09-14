/**
 * Routes.js — Declarative route catalog: action -> { permission, validate, handler, scope }.
 *
 * Authority: api-contract.md §7 (action catalog, 1:1 match required).
 * Scope: routing only; handlers delegate to services. No business rules here.
 *
 * Rules:
 * - PUBLIC_ACTIONS = auth.health, auth.login only.
 * - Every route declares either PUBLIC_ACTIONS membership or a permission.
 * - scope: PUBLIC | GLOBAL | MEMBER_SELF
 * - validate: function(payload) -> [{ field, message }] (empty array = valid)
 * - handler: function(ctx) -> data (ctx = { user, payload, requestId, now, config, permissions })
 * - Every mutating action requires clientRequestId (idempotency enforced by ApiRouter).
 */
var Routes = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Return empty (no validation errors). */
  function noValidate() { return []; }

  /** Build a field validation error. */
  function err(field, message) { return { field: field, message: message }; }

  /** Require a non-empty string field. */
  function requireField(name, label) {
    return function (p) {
      return (!p || !p[name] || !String(p[name]).trim()) ? [err(name, (label || name) + ' is required.')] : [];
    };
  }

  /** Require a valid ID field. */
  function requireId(name, label) {
    return function (p) {
      if (!p || !p[name] || !String(p[name]).trim()) {
        return [err(name, (label || name) + ' is required.')];
      }
      if (!Utils.isId(p[name])) {
        return [err(name, (label || name) + ' is not a valid ID.')];
      }
      return [];
    };
  }

  /** Combine multiple validators. */
  function validate() {
    var validators = Array.prototype.slice.call(arguments);
    return function (p) {
      var errors = [];
      for (var i = 0; i < validators.length; i++) {
        var errs = validators[i](p);
        if (errs && errs.length > 0) { errors = errors.concat(errs); }
      }
      return errors;
    };
  }

  /** Require pagination fields (page, pageSize). */
  function validatePagination(p) {
    var errors = [];
    if (p && p.page !== undefined) {
      var pg = parseInt(p.page, 10);
      if (!isFinite(pg) || pg < 1) { errors.push(err('page', 'Page must be >= 1.')); }
    }
    if (p && p.pageSize !== undefined) {
      var ps = parseInt(p.pageSize, 10);
      if (!isFinite(ps) || ps < 1 || ps > 100) { errors.push(err('pageSize', 'Page size must be 1-100.')); }
    }
    return errors;
  }

  /** Require clientRequestId on mutating actions. */
  function requireClientId(p) {
    if (!p || !p.clientRequestId || !String(p.clientRequestId).trim()) {
      return [err('clientRequestId', 'clientRequestId is required for mutating actions.')];
    }
    return [];
  }

  // ---------------------------------------------------------------------------
  // PUBLIC_ACTIONS
  // ---------------------------------------------------------------------------

  var PUBLIC_ACTIONS = ['auth.health', 'auth.login'];

  // ---------------------------------------------------------------------------
  // Route catalog
  // ---------------------------------------------------------------------------

  var catalog = {

    // =========================================================================
    // 7.1 Authentication & session
    // =========================================================================

    'auth.health': {
      permission: null,
      validate: noValidate,
      handler: function (ctx) { return AuthService.health ? AuthService.health(ctx) : { status: 'ok', schemaVersion: Schema.SCHEMA_VERSION, appVersion: Schema.APP_VERSION }; },
      scope: 'PUBLIC'
    },

    'auth.login': {
      permission: null,
      validate: validate(
        requireField('username', 'Username'),
        requireField('password', 'Password')
      ),
      handler: function (ctx) { return AuthService.login(ctx.payload); },
      scope: 'PUBLIC'
    },

    'auth.me': {
      permission: null,
      validate: noValidate,
      handler: function (ctx) { return AuthService.me(ctx.user); },
      scope: 'GLOBAL'
    },

    'auth.changePassword': {
      permission: null,
      validate: validate(
        requireField('currentPassword', 'Current password'),
        requireField('newPassword', 'New password')
      ),
      handler: function (ctx) {
        return AuthService.changePassword({
          userId: ctx.user.userId,
          currentPassword: ctx.payload.currentPassword,
          newPassword: ctx.payload.newPassword
        });
      },
      scope: 'GLOBAL'
    },

    'auth.logout': {
      permission: null,
      validate: noValidate,
      handler: function (ctx) { return AuthService.logout(ctx.session); },
      scope: 'GLOBAL'
    },

    'auth.sessions.list': {
      permission: null,
      validate: validatePagination,
      handler: function (ctx) { return AuthService.listSessions(ctx.user.userId); },
      scope: 'GLOBAL'
    },

    'auth.sessions.revoke': {
      permission: null,
      validate: requireId('sessionId', 'Session'),
      handler: function (ctx) {
        AuthService.revokeSession(ctx.payload.sessionId, ctx.user.userId);
        return { revoked: true };
      },
      scope: 'GLOBAL'
    },

    // =========================================================================
    // 7.2 Setup & configuration
    // =========================================================================

    'setup.status': {
      permission: null,
      validate: noValidate,
      handler: function (ctx) { return ConfigService.getStatus(ctx); },
      scope: 'GLOBAL'
    },

    'setup.complete': {
      permission: 'config.write',
      validate: noValidate,
      handler: function (ctx) { return ConfigService.completeSetup(ctx); },
      scope: 'GLOBAL'
    },

    'config.get': {
      permission: null,
      validate: noValidate,
      handler: function (ctx) { return ConfigService.getConfig(ctx); },
      scope: 'GLOBAL'
    },

    'config.update': {
      permission: 'config.write',
      validate: validate(requireClientId),
      handler: function (ctx) { return ConfigService.updateConfig(ctx); },
      scope: 'GLOBAL'
    },

    'config.enums': {
      permission: null,
      validate: noValidate,
      handler: function (ctx) { return ConfigService.getEnums(ctx); },
      scope: 'GLOBAL'
    },

    'config.entityMeta': {
      permission: 'config.read',
      validate: noValidate,
      handler: function (ctx) { return ConfigService.getEntityMeta(ctx); },
      scope: 'GLOBAL'
    },

    'config.entity.list': {
      permission: 'config.read',
      validate: validate(requireField('entity', 'Entity'), validatePagination),
      handler: function (ctx) { return ConfigService.listEntity(ctx); },
      scope: 'GLOBAL'
    },

    'config.entity.get': {
      permission: 'config.read',
      validate: validate(requireField('entity', 'Entity'), requireId('id', 'ID')),
      handler: function (ctx) { return ConfigService.getEntity(ctx); },
      scope: 'GLOBAL'
    },

    'config.entity.create': {
      permission: 'config.write',
      validate: validate(requireField('entity', 'Entity'), requireClientId),
      handler: function (ctx) { return ConfigService.createEntity(ctx); },
      scope: 'GLOBAL'
    },

    'config.entity.update': {
      permission: 'config.write',
      validate: validate(requireField('entity', 'Entity'), requireId('id', 'ID'), requireClientId),
      handler: function (ctx) { return ConfigService.updateEntity(ctx); },
      scope: 'GLOBAL'
    },

    'config.entity.setStatus': {
      permission: 'config.write',
      validate: validate(requireField('entity', 'Entity'), requireId('id', 'ID'), requireField('status', 'Status'), requireClientId),
      handler: function (ctx) { return ConfigService.setEntityStatus(ctx); },
      scope: 'GLOBAL'
    },

    // =========================================================================
    // 7.3 Flats & members
    // =========================================================================

    'flats.list': {
      permission: 'flats.read',
      validate: validatePagination,
      handler: function (ctx) { return MemberService.listFlats(ctx); },
      scope: 'GLOBAL'
    },

    'flats.get': {
      permission: 'flats.read',
      validate: requireId('flatId', 'Flat'),
      handler: function (ctx) { return MemberService.getFlat(ctx); },
      scope: 'GLOBAL'
    },

    'flats.create': {
      permission: 'flats.write',
      validate: validate(requireField('wingId', 'Wing'), requireField('flatNumber', 'Flat number'), requireClientId),
      handler: function (ctx) { return MemberService.createFlat(ctx); },
      scope: 'GLOBAL'
    },

    'flats.update': {
      permission: 'flats.write',
      validate: validate(requireId('flatId', 'Flat'), requireClientId),
      handler: function (ctx) { return MemberService.updateFlat(ctx); },
      scope: 'GLOBAL'
    },

    'flats.charges.list': {
      permission: 'flats.read',
      validate: requireId('flatId', 'Flat'),
      handler: function (ctx) { return MemberService.listFlatCharges(ctx); },
      scope: 'GLOBAL'
    },

    'flats.charges.set': {
      permission: 'maintenance.write',
      validate: validate(requireId('flatId', 'Flat'), requireId('chargeTypeId', 'Charge type'), requireClientId),
      handler: function (ctx) { return MemberService.setFlatCharge(ctx); },
      scope: 'GLOBAL'
    },

    'members.list': {
      permission: 'members.read',
      validate: validatePagination,
      handler: function (ctx) { return MemberService.listMembers(ctx); },
      scope: 'MEMBER_SELF'
    },

    'members.get': {
      permission: 'members.read',
      validate: requireId('memberId', 'Member'),
      handler: function (ctx) { return MemberService.getMember(ctx); },
      scope: 'MEMBER_SELF'
    },

    'members.create': {
      permission: 'members.write',
      validate: validate(
        requireField('flatId', 'Flat'),
        requireField('fullName', 'Full name'),
        requireClientId
      ),
      handler: function (ctx) { return MemberService.createMember(ctx); },
      scope: 'GLOBAL'
    },

    'members.update': {
      permission: 'members.write',
      validate: validate(requireId('memberId', 'Member'), requireClientId),
      handler: function (ctx) { return MemberService.updateMember(ctx); },
      scope: 'GLOBAL'
    },

    'members.archive': {
      permission: 'members.write',
      validate: validate(requireId('memberId', 'Member'), requireField('reason', 'Reason'), requireClientId),
      handler: function (ctx) { return MemberService.archiveMember(ctx); },
      scope: 'GLOBAL'
    },

    // =========================================================================
    // 7.4 Maintenance, demand & interest
    // =========================================================================

    'periods.list': {
      permission: 'maintenance.read',
      validate: validatePagination,
      handler: function (ctx) { return MaintenanceService.listPeriods(ctx); },
      scope: 'GLOBAL'
    },

    'periods.ensure': {
      permission: 'maintenance.generate',
      validate: validate(requireField('periodKey', 'Period'), requireClientId),
      handler: function (ctx) { return MaintenanceService.ensurePeriod(ctx); },
      scope: 'GLOBAL'
    },

    'periods.lock': {
      permission: 'maintenance.lock',
      validate: validate(requireField('periodKey', 'Period'), requireClientId),
      handler: function (ctx) { return MaintenanceService.lockPeriod(ctx); },
      scope: 'GLOBAL'
    },

    'periods.unlock': {
      permission: 'maintenance.lock',
      validate: validate(requireField('periodKey', 'Period'), requireField('reason', 'Reason'), requireClientId),
      handler: function (ctx) { return MaintenanceService.unlockPeriod(ctx); },
      scope: 'GLOBAL'
    },

    'demands.list': {
      permission: 'maintenance.read',
      validate: validatePagination,
      handler: function (ctx) { return MaintenanceService.listDemands(ctx); },
      scope: 'MEMBER_SELF'
    },

    'demands.get': {
      permission: 'maintenance.read',
      validate: requireId('demandId', 'Demand'),
      handler: function (ctx) { return MaintenanceService.getDemand(ctx); },
      scope: 'MEMBER_SELF'
    },

    'demands.generate': {
      permission: 'maintenance.generate',
      validate: validate(requireField('periodKey', 'Period'), requireClientId),
      handler: function (ctx) { return MaintenanceService.generateDemands(ctx); },
      scope: 'GLOBAL'
    },

    'demands.cancel': {
      permission: 'maintenance.write',
      validate: validate(requireId('demandId', 'Demand'), requireField('reason', 'Reason'), requireClientId),
      handler: function (ctx) { return MaintenanceService.cancelDemand(ctx); },
      scope: 'GLOBAL'
    },

    'demands.summary': {
      permission: 'maintenance.read',
      validate: noValidate,
      handler: function (ctx) { return MaintenanceService.demandSummary(ctx); },
      scope: 'GLOBAL'
    },

    'interest.preview': {
      permission: 'maintenance.read',
      validate: validate(requireField('periodKey', 'Period')),
      handler: function (ctx) { return MaintenanceService.interestPreview(ctx); },
      scope: 'MEMBER_SELF'
    },

    'interest.apply': {
      permission: 'maintenance.generate',
      validate: validate(requireField('periodKey', 'Period'), requireClientId),
      handler: function (ctx) { return MaintenanceService.applyInterest(ctx); },
      scope: 'GLOBAL'
    },

    'adjustments.list': {
      permission: 'payments.read',
      validate: validatePagination,
      handler: function (ctx) { return PaymentService.listAdjustments(ctx); },
      scope: 'MEMBER_SELF'
    },

    'adjustments.create': {
      permission: 'interest.waive',
      validate: validate(
        requireField('flatId', 'Flat'),
        requireField('adjustmentType', 'Adjustment type'),
        requireField('amount', 'Amount'),
        requireField('sign', 'Sign'),
        requireField('reason', 'Reason'),
        requireClientId
      ),
      handler: function (ctx) { return PaymentService.createAdjustment(ctx); },
      scope: 'GLOBAL'
    },

    // =========================================================================
    // 7.5 Payments, ledger & receipts
    // =========================================================================

    'payments.list': {
      permission: 'payments.read',
      validate: validatePagination,
      handler: function (ctx) { return PaymentService.listPayments(ctx); },
      scope: 'MEMBER_SELF'
    },

    'payments.get': {
      permission: 'payments.read',
      validate: requireId('paymentId', 'Payment'),
      handler: function (ctx) { return PaymentService.getPayment(ctx); },
      scope: 'MEMBER_SELF'
    },

    'payments.record': {
      permission: 'payments.write',
      validate: validate(
        requireField('flatId', 'Flat'),
        requireField('amount', 'Amount'),
        requireField('paymentDate', 'Payment date'),
        requireField('paymentModeKey', 'Payment mode'),
        requireClientId
      ),
      handler: function (ctx) { return PaymentService.recordPayment(ctx); },
      scope: 'GLOBAL'
    },

    'payments.allocate': {
      permission: 'payments.write',
      validate: validate(requireId('paymentId', 'Payment'), requireClientId),
      handler: function (ctx) { return PaymentService.allocatePayment(ctx); },
      scope: 'GLOBAL'
    },

    'payments.cancel': {
      permission: 'payments.reverse',
      validate: validate(requireId('paymentId', 'Payment'), requireField('reason', 'Reason'), requireClientId),
      handler: function (ctx) { return PaymentService.cancelPayment(ctx); },
      scope: 'GLOBAL'
    },

    'payments.reverse': {
      permission: 'payments.reverse',
      validate: validate(requireId('paymentId', 'Payment'), requireField('reason', 'Reason'), requireClientId),
      handler: function (ctx) { return PaymentService.reversePayment(ctx); },
      scope: 'GLOBAL'
    },

    'receipts.list': {
      permission: 'payments.read',
      validate: validatePagination,
      handler: function (ctx) { return PaymentService.listReceipts(ctx); },
      scope: 'MEMBER_SELF'
    },

    'receipts.get': {
      permission: 'payments.read',
      validate: requireId('receiptId', 'Receipt'),
      handler: function (ctx) { return PaymentService.getReceipt(ctx); },
      scope: 'MEMBER_SELF'
    },

    'receipts.print': {
      permission: 'payments.read',
      validate: requireId('receiptId', 'Receipt'),
      handler: function (ctx) { return PaymentService.printReceipt(ctx); },
      scope: 'MEMBER_SELF'
    },

    'ledger.get': {
      permission: 'maintenance.read',
      validate: validatePagination,
      handler: function (ctx) { return PaymentService.getLedger(ctx); },
      scope: 'MEMBER_SELF'
    },

    'ledger.summary': {
      permission: 'maintenance.read',
      validate: noValidate,
      handler: function (ctx) { return PaymentService.ledgerSummary(ctx); },
      scope: 'MEMBER_SELF'
    },

    // =========================================================================
    // 7.6 Complaints & visitors
    // =========================================================================

    'complaints.list': {
      permission: 'complaints.read',
      validate: validatePagination,
      handler: function (ctx) { return ComplaintService.list(ctx); },
      scope: 'MEMBER_SELF'
    },

    'complaints.get': {
      permission: 'complaints.read',
      validate: requireId('complaintId', 'Complaint'),
      handler: function (ctx) { return ComplaintService.get(ctx); },
      scope: 'MEMBER_SELF'
    },

    'complaints.create': {
      permission: 'complaints.write',
      validate: validate(
        requireField('categoryId', 'Category'),
        requireField('priorityKey', 'Priority'),
        requireField('title', 'Title'),
        requireClientId
      ),
      handler: function (ctx) { return ComplaintService.create(ctx); },
      scope: 'MEMBER_SELF'
    },

    'complaints.update': {
      permission: 'complaints.write',
      validate: validate(requireId('complaintId', 'Complaint'), requireClientId),
      handler: function (ctx) { return ComplaintService.update(ctx); },
      scope: 'GLOBAL'
    },

    'complaints.assign': {
      permission: 'complaints.write',
      validate: validate(
        requireId('complaintId', 'Complaint'),
        requireField('assignedToType', 'Assignee type'),
        requireField('assignedToId', 'Assignee'),
        requireClientId
      ),
      handler: function (ctx) { return ComplaintService.assign(ctx); },
      scope: 'GLOBAL'
    },

    'complaints.transition': {
      permission: 'complaints.write',
      validate: validate(
        requireId('complaintId', 'Complaint'),
        requireField('statusKey', 'Status'),
        requireField('remarks', 'Remarks'),
        requireClientId
      ),
      handler: function (ctx) { return ComplaintService.transition(ctx); },
      scope: 'MEMBER_SELF'
    },

    'complaints.history': {
      permission: 'complaints.read',
      validate: validate(requireId('complaintId', 'Complaint'), validatePagination),
      handler: function (ctx) { return ComplaintService.history(ctx); },
      scope: 'MEMBER_SELF'
    },

    'complaints.summary': {
      permission: 'complaints.read',
      validate: noValidate,
      handler: function (ctx) { return ComplaintService.summary(ctx); },
      scope: 'GLOBAL'
    },

    'visitors.list': {
      permission: 'visitors.read',
      validate: validatePagination,
      handler: function (ctx) { return VisitorService.list(ctx); },
      scope: 'MEMBER_SELF'
    },

    'visitors.get': {
      permission: 'visitors.read',
      validate: requireId('visitorId', 'Visitor'),
      handler: function (ctx) { return VisitorService.get(ctx); },
      scope: 'MEMBER_SELF'
    },

    'visitors.create': {
      permission: 'visitors.log',
      validate: validate(
        requireField('visitorName', 'Visitor name'),
        requireField('mobile', 'Mobile'),
        requireField('visitorTypeId', 'Visitor type'),
        requireField('purpose', 'Purpose'),
        requireField('flatId', 'Flat'),
        requireClientId
      ),
      handler: function (ctx) { return VisitorService.create(ctx); },
      scope: 'GLOBAL'
    },

    'visitors.exit': {
      permission: 'visitors.log',
      validate: validate(requireId('visitorId', 'Visitor'), requireClientId),
      handler: function (ctx) { return VisitorService.exit(ctx); },
      scope: 'GLOBAL'
    },

    'visitors.summary': {
      permission: 'visitors.read',
      validate: noValidate,
      handler: function (ctx) { return VisitorService.summary(ctx); },
      scope: 'GLOBAL'
    },

    // =========================================================================
    // 7.7 Notices, meetings & documents
    // =========================================================================

    'notices.list': {
      permission: 'notices.read',
      validate: validatePagination,
      handler: function (ctx) { return CommunicationService.listNotices(ctx); },
      scope: 'MEMBER_SELF'
    },

    'notices.get': {
      permission: 'notices.read',
      validate: requireId('noticeId', 'Notice'),
      handler: function (ctx) { return CommunicationService.getNotice(ctx); },
      scope: 'MEMBER_SELF'
    },

    'notices.create': {
      permission: 'notices.write',
      validate: validate(
        requireField('title', 'Title'),
        requireField('noticeTypeId', 'Notice type'),
        requireField('noticeDate', 'Notice date'),
        requireField('description', 'Description'),
        requireField('audienceType', 'Audience type'),
        requireClientId
      ),
      handler: function (ctx) { return CommunicationService.createNotice(ctx); },
      scope: 'GLOBAL'
    },

    'notices.update': {
      permission: 'notices.write',
      validate: validate(requireId('noticeId', 'Notice'), requireClientId),
      handler: function (ctx) { return CommunicationService.updateNotice(ctx); },
      scope: 'GLOBAL'
    },

    'notices.publish': {
      permission: 'notices.write',
      validate: validate(requireId('noticeId', 'Notice'), requireClientId),
      handler: function (ctx) { return CommunicationService.publishNotice(ctx); },
      scope: 'GLOBAL'
    },

    'notices.unpublish': {
      permission: 'notices.write',
      validate: validate(requireId('noticeId', 'Notice'), requireField('reason', 'Reason'), requireClientId),
      handler: function (ctx) { return CommunicationService.unpublishNotice(ctx); },
      scope: 'GLOBAL'
    },

    'meetings.list': {
      permission: 'meetings.read',
      validate: validatePagination,
      handler: function (ctx) { return CommunicationService.listMeetings(ctx); },
      scope: 'MEMBER_SELF'
    },

    'meetings.get': {
      permission: 'meetings.read',
      validate: requireId('meetingId', 'Meeting'),
      handler: function (ctx) { return CommunicationService.getMeeting(ctx); },
      scope: 'MEMBER_SELF'
    },

    'meetings.create': {
      permission: 'meetings.write',
      validate: validate(
        requireField('meetingTypeKey', 'Meeting type'),
        requireField('title', 'Title'),
        requireField('meetingDate', 'Meeting date'),
        requireClientId
      ),
      handler: function (ctx) { return CommunicationService.createMeeting(ctx); },
      scope: 'GLOBAL'
    },

    'meetings.update': {
      permission: 'meetings.write',
      validate: validate(requireId('meetingId', 'Meeting'), requireClientId),
      handler: function (ctx) { return CommunicationService.updateMeeting(ctx); },
      scope: 'GLOBAL'
    },

    'meetings.attendance.list': {
      permission: 'meetings.read',
      validate: requireId('meetingId', 'Meeting'),
      handler: function (ctx) { return CommunicationService.listAttendance(ctx); },
      scope: 'MEMBER_SELF'
    },

    'meetings.attendance.mark': {
      permission: 'meetings.write',
      validate: validate(requireId('meetingId', 'Meeting'), requireClientId),
      handler: function (ctx) { return CommunicationService.markAttendance(ctx); },
      scope: 'GLOBAL'
    },

    'documents.list': {
      permission: 'documents.read',
      validate: validatePagination,
      handler: function (ctx) { return DocumentService.list(ctx); },
      scope: 'MEMBER_SELF'
    },

    'documents.get': {
      permission: 'documents.read',
      validate: requireId('documentId', 'Document'),
      handler: function (ctx) { return DocumentService.get(ctx); },
      scope: 'MEMBER_SELF'
    },

    'documents.create': {
      permission: 'documents.write',
      validate: validate(
        requireField('title', 'Title'),
        requireField('categoryId', 'Category'),
        requireClientId
      ),
      handler: function (ctx) { return DocumentService.create(ctx); },
      scope: 'GLOBAL'
    },

    'documents.update': {
      permission: 'documents.write',
      validate: validate(requireId('documentId', 'Document'), requireClientId),
      handler: function (ctx) { return DocumentService.update(ctx); },
      scope: 'GLOBAL'
    },

    'documents.archive': {
      permission: 'documents.write',
      validate: validate(requireId('documentId', 'Document'), requireField('reason', 'Reason'), requireClientId),
      handler: function (ctx) { return DocumentService.archive(ctx); },
      scope: 'GLOBAL'
    },

    'documents.upload': {
      permission: 'documents.write',
      validate: validate(
        requireField('categoryId', 'Category'),
        requireField('fileName', 'File name'),
        requireField('mimeType', 'MIME type'),
        requireField('base64', 'File data'),
        requireClientId
      ),
      handler: function (ctx) { return DocumentService.upload(ctx); },
      scope: 'GLOBAL'
    },

    // =========================================================================
    // 7.8 Parking, employees, attendance, salary & expenses
    // =========================================================================

    'parking.allocations.list': {
      permission: 'parking.read',
      validate: validatePagination,
      handler: function (ctx) { return ParkingService.listAllocations(ctx); },
      scope: 'GLOBAL'
    },

    'parking.allocations.get': {
      permission: 'parking.read',
      validate: requireId('allocationId', 'Allocation'),
      handler: function (ctx) { return ParkingService.getAllocation(ctx); },
      scope: 'GLOBAL'
    },

    'parking.allocations.create': {
      permission: 'parking.write',
      validate: validate(
        requireField('parkingSlotId', 'Parking slot'),
        requireField('flatId', 'Flat'),
        requireField('allocationType', 'Allocation type'),
        requireField('startDate', 'Start date'),
        requireClientId
      ),
      handler: function (ctx) { return ParkingService.createAllocation(ctx); },
      scope: 'GLOBAL'
    },

    'parking.allocations.end': {
      permission: 'parking.write',
      validate: validate(requireId('allocationId', 'Allocation'), requireField('endDate', 'End date'), requireClientId),
      handler: function (ctx) { return ParkingService.endAllocation(ctx); },
      scope: 'GLOBAL'
    },

    'parking.summary': {
      permission: 'parking.read',
      validate: noValidate,
      handler: function (ctx) { return ParkingService.summary(ctx); },
      scope: 'GLOBAL'
    },

    'employees.list': {
      permission: 'employees.read',
      validate: validatePagination,
      handler: function (ctx) { return HRService.listEmployees(ctx); },
      scope: 'GLOBAL'
    },

    'employees.get': {
      permission: 'employees.read',
      validate: requireId('employeeId', 'Employee'),
      handler: function (ctx) { return HRService.getEmployee(ctx); },
      scope: 'GLOBAL'
    },

    'employees.create': {
      permission: 'employees.write',
      validate: validate(
        requireField('fullName', 'Full name'),
        requireField('employeeTypeId', 'Employee type'),
        requireField('joinDate', 'Join date'),
        requireClientId
      ),
      handler: function (ctx) { return HRService.createEmployee(ctx); },
      scope: 'GLOBAL'
    },

    'employees.update': {
      permission: 'employees.write',
      validate: validate(requireId('employeeId', 'Employee'), requireClientId),
      handler: function (ctx) { return HRService.updateEmployee(ctx); },
      scope: 'GLOBAL'
    },

    'employees.archive': {
      permission: 'employees.write',
      validate: validate(requireId('employeeId', 'Employee'), requireField('reason', 'Reason'), requireClientId),
      handler: function (ctx) { return HRService.archiveEmployee(ctx); },
      scope: 'GLOBAL'
    },

    'attendance.list': {
      permission: 'attendance.read',
      validate: validatePagination,
      handler: function (ctx) { return HRService.listAttendance(ctx); },
      scope: 'GLOBAL'
    },

    'attendance.mark': {
      permission: 'attendance.write',
      validate: validate(requireClientId),
      handler: function (ctx) { return HRService.markAttendance(ctx); },
      scope: 'GLOBAL'
    },

    'attendance.summary': {
      permission: 'attendance.read',
      validate: noValidate,
      handler: function (ctx) { return HRService.attendanceSummary(ctx); },
      scope: 'GLOBAL'
    },

    'salary.list': {
      permission: 'salary.read',
      validate: validatePagination,
      handler: function (ctx) { return HRService.listSalary(ctx); },
      scope: 'GLOBAL'
    },

    'salary.get': {
      permission: 'salary.read',
      validate: requireId('salaryId', 'Salary'),
      handler: function (ctx) { return HRService.getSalary(ctx); },
      scope: 'GLOBAL'
    },

    'salary.prepare': {
      permission: 'salary.write',
      validate: validate(requireField('periodKey', 'Period'), requireClientId),
      handler: function (ctx) { return HRService.prepareSalary(ctx); },
      scope: 'GLOBAL'
    },

    'salary.update': {
      permission: 'salary.write',
      validate: validate(requireId('salaryId', 'Salary'), requireClientId),
      handler: function (ctx) { return HRService.updateSalary(ctx); },
      scope: 'GLOBAL'
    },

    'salary.approve': {
      permission: 'salary.approve',
      validate: validate(requireId('salaryId', 'Salary'), requireClientId),
      handler: function (ctx) { return HRService.approveSalary(ctx); },
      scope: 'GLOBAL'
    },

    'salary.pay': {
      permission: 'salary.write',
      validate: validate(
        requireId('salaryId', 'Salary'),
        requireField('paymentDate', 'Payment date'),
        requireField('paymentModeKey', 'Payment mode'),
        requireClientId
      ),
      handler: function (ctx) { return HRService.paySalary(ctx); },
      scope: 'GLOBAL'
    },

    'expenses.list': {
      permission: 'expenses.read',
      validate: validatePagination,
      handler: function (ctx) { return ExpenseService.list(ctx); },
      scope: 'GLOBAL'
    },

    'expenses.get': {
      permission: 'expenses.read',
      validate: requireId('expenseId', 'Expense'),
      handler: function (ctx) { return ExpenseService.get(ctx); },
      scope: 'GLOBAL'
    },

    'expenses.create': {
      permission: 'expenses.write',
      validate: validate(
        requireField('expenseDate', 'Expense date'),
        requireField('categoryId', 'Category'),
        requireField('description', 'Description'),
        requireField('amount', 'Amount'),
        requireField('paymentModeKey', 'Payment mode'),
        requireClientId
      ),
      handler: function (ctx) { return ExpenseService.create(ctx); },
      scope: 'GLOBAL'
    },

    'expenses.update': {
      permission: 'expenses.write',
      validate: validate(requireId('expenseId', 'Expense'), requireClientId),
      handler: function (ctx) { return ExpenseService.update(ctx); },
      scope: 'GLOBAL'
    },

    'expenses.cancel': {
      permission: 'expenses.write',
      validate: validate(requireId('expenseId', 'Expense'), requireField('reason', 'Reason'), requireClientId),
      handler: function (ctx) { return ExpenseService.cancel(ctx); },
      scope: 'GLOBAL'
    },

    'expenses.summary': {
      permission: 'expenses.read',
      validate: noValidate,
      handler: function (ctx) { return ExpenseService.summary(ctx); },
      scope: 'GLOBAL'
    },

    // =========================================================================
    // 7.9 Dashboard, reports, backup, archive, audit, users & search
    // =========================================================================

    'dashboard.summary': {
      permission: 'dashboard.read',
      validate: noValidate,
      handler: function (ctx) { return ReportService.dashboardSummary(ctx); },
      scope: 'GLOBAL'
    },

    'search.global': {
      permission: null,
      validate: function (p) {
        if (!p || !p.q || String(p.q).trim().length < 2) {
          return [err('q', 'Search query must be at least 2 characters.')];
        }
        return [];
      },
      handler: function (ctx) { return ReportService.globalSearch(ctx); },
      scope: 'GLOBAL'
    },

    'reports.catalog': {
      permission: 'reports.read',
      validate: noValidate,
      handler: function (ctx) { return ReportService.catalog(ctx); },
      scope: 'GLOBAL'
    },

    'reports.run': {
      permission: 'reports.read',
      validate: validate(requireField('reportKey', 'Report'), validatePagination),
      handler: function (ctx) { return ReportService.run(ctx); },
      scope: 'GLOBAL'
    },

    'reports.export': {
      permission: 'reports.export',
      validate: validate(requireField('reportKey', 'Report'), requireField('format', 'Format'), requireClientId),
      handler: function (ctx) { return ReportService.export(ctx); },
      scope: 'GLOBAL'
    },

    'backup.create': {
      permission: 'backup.run',
      validate: validate(requireField('scope', 'Scope'), requireClientId),
      handler: function (ctx) { return BackupService.create(ctx); },
      scope: 'GLOBAL'
    },

    'backup.list': {
      permission: 'backup.run',
      validate: validatePagination,
      handler: function (ctx) { return BackupService.list(ctx); },
      scope: 'GLOBAL'
    },

    'archive.run': {
      permission: 'archive.run',
      validate: validate(requireClientId),
      handler: function (ctx) { return BackupService.runArchive(ctx); },
      scope: 'GLOBAL'
    },

    'archive.list': {
      permission: 'archive.read',
      validate: validatePagination,
      handler: function (ctx) { return BackupService.listArchive(ctx); },
      scope: 'GLOBAL'
    },

    'audit.list': {
      permission: 'audit.read',
      validate: validatePagination,
      handler: function (ctx) { return ReportService.listAudit(ctx); },
      scope: 'GLOBAL'
    },

    'audit.get': {
      permission: 'audit.read',
      validate: requireId('auditId', 'Audit'),
      handler: function (ctx) { return ReportService.getAudit(ctx); },
      scope: 'GLOBAL'
    },

    'users.list': {
      permission: 'users.manage',
      validate: validatePagination,
      handler: function (ctx) { return AuthService.listUsers(ctx); },
      scope: 'GLOBAL'
    },

    'users.get': {
      permission: 'users.manage',
      validate: requireId('userId', 'User'),
      handler: function (ctx) { return AuthService.getUser(ctx); },
      scope: 'GLOBAL'
    },

    'users.create': {
      permission: 'users.manage',
      validate: validate(
        requireField('username', 'Username'),
        requireField('email', 'Email'),
        requireField('fullName', 'Full name'),
        requireField('roleKeys', 'Roles'),
        requireField('temporaryPassword', 'Temporary password'),
        requireClientId
      ),
      handler: function (ctx) { return AuthService.createUser(ctx); },
      scope: 'GLOBAL'
    },

    'users.update': {
      permission: 'users.manage',
      validate: validate(requireId('userId', 'User'), requireClientId),
      handler: function (ctx) { return AuthService.updateUser(ctx); },
      scope: 'GLOBAL'
    },

    'users.setStatus': {
      permission: 'users.manage',
      validate: validate(requireId('userId', 'User'), requireField('status', 'Status'), requireClientId),
      handler: function (ctx) { return AuthService.setUserStatus(ctx); },
      scope: 'GLOBAL'
    },

    'users.resetPassword': {
      permission: 'users.manage',
      validate: validate(requireId('userId', 'User'), requireField('temporaryPassword', 'Temporary password'), requireClientId),
      handler: function (ctx) { return AuthService.resetPassword(ctx); },
      scope: 'GLOBAL'
    },

    'roles.list': {
      permission: 'roles.read',
      validate: validatePagination,
      handler: function (ctx) { return AuthService.listRoles(ctx); },
      scope: 'GLOBAL'
    },

    'roles.create': {
      permission: 'roles.manage',
      validate: validate(requireField('roleKey', 'Role key'), requireField('roleName', 'Role name'), requireClientId),
      handler: function (ctx) { return AuthService.createRole(ctx); },
      scope: 'GLOBAL'
    },

    'roles.update': {
      permission: 'roles.manage',
      validate: validate(requireField('roleKey', 'Role key'), requireClientId),
      handler: function (ctx) { return AuthService.updateRole(ctx); },
      scope: 'GLOBAL'
    },

    'roles.setStatus': {
      permission: 'roles.manage',
      validate: validate(requireField('roleKey', 'Role key'), requireField('status', 'Status'), requireClientId),
      handler: function (ctx) { return AuthService.setRoleStatus(ctx); },
      scope: 'GLOBAL'
    },

    'permissions.list': {
      permission: 'roles.read',
      validate: noValidate,
      handler: function (ctx) { return AuthService.listPermissions(ctx); },
      scope: 'GLOBAL'
    },

    'roles.permissions.get': {
      permission: 'roles.read',
      validate: requireField('roleKey', 'Role'),
      handler: function (ctx) { return AuthService.getRolePermissions(ctx); },
      scope: 'GLOBAL'
    },

    'roles.permissions.update': {
      permission: 'roles.manage',
      validate: validate(requireField('roleKey', 'Role'), requireClientId),
      handler: function (ctx) { return AuthService.updateRolePermissions(ctx); },
      scope: 'GLOBAL'
    }
  };

  // ---------------------------------------------------------------------------
  // Expose
  // ---------------------------------------------------------------------------

  return {
    PUBLIC_ACTIONS: PUBLIC_ACTIONS,
    catalog: catalog,

    /** Check if an action is public (no auth required). */
    isPublic: function (action) {
      return PUBLIC_ACTIONS.indexOf(action) !== -1;
    },

    /** Get a route definition by action. Returns null if not found. */
    get: function (action) {
      return catalog[action] || null;
    },

    /** Get all registered action names. */
    actions: function () {
      return Object.keys(catalog);
    }
  };
})();
