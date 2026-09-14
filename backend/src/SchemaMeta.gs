/**
 * SchemaMeta.js — master-data entity descriptors (the source of the config-driven UI), system enum
 * options and setup seeds.
 *
 * IMPORTANT: this file seeds *structure and system capability* only. It never seeds society facts
 * (no flats, members, employees, vendors, vehicles, demands, payments, expenses or charge types).
 */
var SchemaMeta = (function () {
  'use strict';

  /** System-level capability enums (never society data). Surfaced to the UI via config.entityMeta / config.enums. */
  var ENUM_OPTIONS = {
    CALCULATION_METHOD: ['FLAT', 'FIXED', 'AREA', 'PER_MEMBER', 'CUSTOM'],
    COMPOUND_METHOD: ['SIMPLE', 'COMPOUND'],
    INTEREST_FREQUENCY: ['MONTHLY', 'DAILY'],
    RESET_POLICY: ['YEARLY', 'MONTHLY', 'NEVER'],
    AUDIENCE_TYPE: ['ALL', 'ROLE', 'WING', 'FLAT', 'MEMBER'],
    ASSIGNEE_TYPE: ['MEMBER', 'EMPLOYEE', 'VENDOR', 'NONE'],
    ATTENDEE_TYPE: ['MEMBER', 'EMPLOYEE', 'VENDOR', 'GUEST'],
    ADJUSTMENT_TYPE: ['INTEREST_WAIVER', 'DISCOUNT', 'PENALTY', 'ROUND_OFF', 'CORRECTION', 'WRITE_OFF'],
    ALLOCATION_TYPE: ['PERMANENT', 'TEMPORARY'],
    RELATION_TYPE: ['OWNER', 'TENANT', 'FAMILY'],
    GENDER: ['MALE', 'FEMALE', 'OTHER'],
    VISITOR_SOURCE: ['WEB', 'WATCHMAN', 'PHONE', 'OTHER'],
    PAYMENT_FREQUENCY: ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'ONE_TIME'],
    DOC_TYPE: ['DEMAND', 'RECEIPT', 'COMPLAINT', 'VISITOR', 'EXPENSE', 'DOCUMENT', 'MEETING', 'NOTICE', 'SALARY'],
    REPORT_FORMAT: ['CSV', 'XLS'],
    BACKUP_SCOPE: ['FULL', 'CONFIG', 'FINANCE', 'OPERATIONS']
  };

  /** Field builders used by entity descriptors. */
  function f(key, label, type, extra) {
    var o = { key: key, label: label, type: type || 'text' };
    if (extra) { Object.keys(extra).forEach(function (k) { o[k] = extra[k]; }); }
    return o;
  }
  var SORT = f('sortOrder', 'Sort order', 'number');
  var DESC = f('description', 'Description', 'textarea', { max: 2000 });
  function keyField(k, l) { return f(k, l, 'text', { required: true, max: 40 }); }

  /** Master-data entity descriptors: read/write permissions + fields for the generic Settings UI. */
  var MASTER_ENTITIES = {
    wings: { sheet: 'Wings', label: 'Wings', labelField: 'wingName',
      searchable: ['wingName', 'description'], sortable: ['wingName', 'sortOrder'],
      fields: [f('wingName', 'Wing name', 'text', { required: true, max: 60 }), DESC, SORT] },

    flatTypes: { sheet: 'Flat_Types', label: 'Flat Types', labelField: 'typeName',
      searchable: ['typeName'], sortable: ['typeName', 'sortOrder'],
      fields: [f('typeName', 'Type name', 'text', { required: true, max: 60 }), DESC, SORT] },

    employeeTypes: { sheet: 'Employee_Types', label: 'Employee Types', labelField: 'typeName',
      searchable: ['typeName'], sortable: ['typeName', 'sortOrder'],
      fields: [keyField('typeKey', 'Type key'),
        f('typeName', 'Type name', 'text', { required: true, max: 60 }), DESC, SORT] },

    vehicleTypes: { sheet: 'Vehicle_Types', label: 'Vehicle Types', labelField: 'typeName',
      searchable: ['typeName'], sortable: ['typeName', 'sortOrder'],
      fields: [keyField('typeKey', 'Type key'),
        f('typeName', 'Type name', 'text', { required: true, max: 60 }),
        f('isChargeable', 'Chargeable', 'checkbox'), SORT] },

    noticeTypes: { sheet: 'Notice_Types', label: 'Notice Types', labelField: 'typeName',
      searchable: ['typeName'], sortable: ['typeName', 'sortOrder'],
      fields: [keyField('typeKey', 'Type key'),
        f('typeName', 'Type name', 'text', { required: true, max: 60 }),
        f('requiresAttachment', 'Requires attachment', 'checkbox'), SORT] },

    visitorTypes: { sheet: 'Visitor_Types', label: 'Visitor Types', labelField: 'typeName',
      searchable: ['typeName'], sortable: ['typeName', 'sortOrder'],
      fields: [keyField('typeKey', 'Type key'),
        f('typeName', 'Type name', 'text', { required: true, max: 60 }),
        f('requiresApproval', 'Requires approval', 'checkbox'), SORT] },

    parkingTypes: { sheet: 'Parking_Types', label: 'Parking Types', labelField: 'typeName',
      searchable: ['typeName'], sortable: ['typeName', 'sortOrder'],
      fields: [keyField('typeKey', 'Type key'),
        f('typeName', 'Type name', 'text', { required: true, max: 60 }),
        f('isChargeable', 'Chargeable', 'checkbox'), SORT] },

    meetingTypes: { sheet: 'Meeting_Types', label: 'Meeting Types', labelField: 'typeName',
      searchable: ['typeName'], sortable: ['typeName', 'sortOrder'],
      fields: [keyField('typeKey', 'Type key'),
        f('typeName', 'Type name', 'text', { required: true, max: 60 }),
        f('quorumPercent', 'Quorum %', 'percent'), SORT] },

    chargeTypes: { sheet: 'Charge_Types', label: 'Charge Types', labelField: 'chargeName',
      searchable: ['chargeCode', 'chargeName', 'description'], sortable: ['chargeCode', 'sortOrder'],
      fields: [f('chargeCode', 'Charge code', 'text', { required: true, max: 40 }),
        f('chargeName', 'Charge name', 'text', { required: true, max: 120 }),
        DESC,
        f('calculationMethod', 'Calculation method', 'select', { options: 'ENUM', optionsFrom: 'CALCULATION_METHOD', required: true }),
        f('defaultAmount', 'Default amount', 'number'),
        f('ratePerUnit', 'Rate per unit', 'number'),
        f('unitLabel', 'Unit label', 'text', { max: 40 }),
        f('interestApplicable', 'Interest applicable', 'checkbox'),
        SORT,
        f('effectiveFrom', 'Effective from', 'date'),
        f('effectiveTo', 'Effective to', 'date')] },

    chargeRates: { sheet: 'Charge_Rates', label: 'Charge Rates', labelField: 'chargeRateId',
      searchable: ['remarks'], sortable: ['chargeTypeId'],
      fields: [f('chargeTypeId', 'Charge type', 'reference', { ref: 'chargeTypes', refLabel: 'chargeName', required: true }),
        f('amount', 'Amount', 'number', { required: true }),
        f('ratePerUnit', 'Rate per unit', 'number'),
        f('effectiveFrom', 'Effective from', 'date', { required: true }),
        f('effectiveTo', 'Effective to', 'date'),
        DESC] },

    flatCharges: { sheet: 'Flat_Charges', label: 'Flat Charges', labelField: 'flatChargeId',
      searchable: ['remarks'], sortable: ['flatId', 'chargeTypeId'],
      fields: [f('flatId', 'Flat', 'reference', { ref: 'flats', refLabel: 'flatNumber', required: true }),
        f('chargeTypeId', 'Charge type', 'reference', { ref: 'chargeTypes', refLabel: 'chargeName', required: true }),
        f('isActive', 'Active', 'checkbox'),
        f('amountOverride', 'Amount override', 'number'),
        f('effectiveFrom', 'Effective from', 'date'),
        f('effectiveTo', 'Effective to', 'date'),
        DESC] },

    interestRules: { sheet: 'Interest_Rules', label: 'Interest Rules', labelField: 'ruleName',
      searchable: ['ruleName', 'remarks'], sortable: ['ruleName'],
      fields: [f('ruleName', 'Rule name', 'text', { required: true, max: 120 }),
        f('ratePercent', 'Rate %', 'percent', { required: true }),
        f('compoundMethod', 'Compound method', 'select', { options: 'ENUM', optionsFrom: 'COMPOUND_METHOD', required: true }),
        f('frequency', 'Frequency', 'select', { options: 'ENUM', optionsFrom: 'INTEREST_FREQUENCY', required: true }),
        f('graceDays', 'Grace days', 'number'),
        f('minAmount', 'Min amount', 'number'),
        f('roundTo', 'Round to', 'number'),
        f('isDefault', 'Default', 'checkbox'),
        DESC] },

    paymentModes: { sheet: 'Payment_Modes', label: 'Payment Modes', labelField: 'modeName',
      searchable: ['modeKey', 'modeName', 'description'], sortable: ['modeKey', 'sortOrder'],
      fields: [keyField('modeKey', 'Mode key'),
        f('modeName', 'Mode name', 'text', { required: true, max: 60 }),
        DESC,
        f('isCashLike', 'Cash-like', 'checkbox'),
        SORT] },

    expenseCategories: { sheet: 'Expense_Categories', label: 'Expense Categories', labelField: 'categoryName',
      searchable: ['categoryKey', 'categoryName', 'description'], sortable: ['categoryKey', 'sortOrder'],
      fields: [keyField('categoryKey', 'Category key'),
        f('categoryName', 'Category name', 'text', { required: true, max: 120 }),
        DESC,
        f('isSalaryCategory', 'Salary category', 'checkbox'),
        SORT] },

    complaintCategories: { sheet: 'Complaint_Categories', label: 'Complaint Categories', labelField: 'categoryName',
      searchable: ['categoryKey', 'categoryName'], sortable: ['categoryKey', 'sortOrder'],
      fields: [keyField('categoryKey', 'Category key'),
        f('categoryName', 'Category name', 'text', { required: true, max: 120 }),
        f('defaultAssigneeType', 'Default assignee type', 'select', { options: 'ENUM', optionsFrom: 'ASSIGNEE_TYPE' }),
        f('slaHours', 'SLA hours', 'number'),
        SORT] },

    complaintPriorities: { sheet: 'Complaint_Priorities', label: 'Complaint Priorities', labelField: 'priorityName',
      searchable: ['priorityKey', 'priorityName'], sortable: ['priorityKey', 'sortOrder'],
      fields: [keyField('priorityKey', 'Priority key'),
        f('priorityName', 'Priority name', 'text', { required: true, max: 60 }),
        f('slaHours', 'SLA hours', 'number'),
        f('colorToken', 'Color token', 'text', { max: 20 }),
        SORT] },

    documentCategories: { sheet: 'Document_Categories', label: 'Document Categories', labelField: 'categoryName',
      searchable: ['categoryKey', 'categoryName'], sortable: ['categoryKey', 'sortOrder'],
      fields: [keyField('categoryKey', 'Category key'),
        f('categoryName', 'Category name', 'text', { required: true, max: 120 }),
        f('driveFolderKey', 'Drive folder key', 'text', { max: 100 }),
        f('retentionMonths', 'Retention months', 'number'),
        SORT] },

    parkingSlots: { sheet: 'Parking_Slots', label: 'Parking Slots', labelField: 'slotNumber',
      searchable: ['slotNumber', 'location'], sortable: ['slotNumber', 'wingId'],
      fields: [f('slotNumber', 'Slot number', 'text', { required: true, max: 20 }),
        f('parkingTypeId', 'Parking type', 'reference', { ref: 'parkingTypes', refLabel: 'typeName' }),
        f('wingId', 'Wing', 'reference', { ref: 'wings', refLabel: 'wingName' }),
        f('floorLevel', 'Floor level', 'text', { max: 20 }),
        f('location', 'Location', 'text', { max: 120 }),
        DESC] },

    vendors: { sheet: 'Vendors', label: 'Vendors', labelField: 'vendorName',
      searchable: ['vendorName', 'contactPerson', 'mobile', 'gstNumber'], sortable: ['vendorName'],
      fields: [f('vendorName', 'Vendor name', 'text', { required: true, max: 120 }),
        f('categoryKey', 'Category', 'select', { options: 'EXPENSE_CATEGORIES', optionsFrom: 'expenseCategories' }),
        f('contactPerson', 'Contact person', 'text', { max: 120 }),
        f('mobile', 'Mobile', 'phone'),
        f('altMobile', 'Alt mobile', 'phone'),
        f('email', 'Email', 'email'),
        DESC,
        f('gstNumber', 'GST number', 'text', { max: 20 }),
        f('panNumber', 'PAN number', 'text', { max: 20 })] },

    amc: { sheet: 'Vendors_AMC', label: 'Vendor AMC', labelField: 'title',
      searchable: ['title', 'description'], sortable: ['vendorId', 'startDate'],
      fields: [f('vendorId', 'Vendor', 'reference', { ref: 'vendors', refLabel: 'vendorName', required: true }),
        f('title', 'Title', 'text', { required: true, max: 200 }),
        DESC,
        f('categoryKey', 'Category', 'select', { options: 'EXPENSE_CATEGORIES', optionsFrom: 'expenseCategories' }),
        f('startDate', 'Start date', 'date', { required: true }),
        f('endDate', 'End date', 'date'),
        f('amount', 'Amount', 'number'),
        f('paymentFrequencyKey', 'Payment frequency', 'select', { options: 'ENUM', optionsFrom: 'PAYMENT_FREQUENCY' }),
        f('renewalReminderDays', 'Renewal reminder days', 'number')] },

    familyMembers: { sheet: 'Family_Members', label: 'Family Members', labelField: 'fullName',
      searchable: ['fullName', 'mobile'], sortable: ['memberId', 'fullName'],
      fields: [f('memberId', 'Member', 'reference', { ref: 'members', refLabel: 'fullName', required: true }),
        f('flatId', 'Flat', 'reference', { ref: 'flats', refLabel: 'flatNumber' }),
        f('fullName', 'Full name', 'text', { required: true, max: 120 }),
        f('relation', 'Relation', 'text', { max: 60 }),
        f('dateOfBirth', 'Date of birth', 'date'),
        f('gender', 'Gender', 'select', { options: 'ENUM', optionsFrom: 'GENDER' }),
        f('mobile', 'Mobile', 'phone'),
        f('occupation', 'Occupation', 'text', { max: 120 })] },

    vehicles: { sheet: 'Vehicles', label: 'Vehicles', labelField: 'vehicleNumber',
      searchable: ['vehicleNumber', 'makeModel'], sortable: ['memberId', 'vehicleNumber'],
      fields: [f('memberId', 'Member', 'reference', { ref: 'members', refLabel: 'fullName' }),
        f('flatId', 'Flat', 'reference', { ref: 'flats', refLabel: 'flatNumber' }),
        f('vehicleTypeKey', 'Vehicle type', 'select', { options: 'ENUM', optionsFrom: 'vehicleTypes' }),
        f('vehicleNumber', 'Vehicle number', 'text', { required: true, max: 20 }),
        f('makeModel', 'Make/Model', 'text', { max: 120 }),
        f('colour', 'Colour', 'text', { max: 40 })] },

    numberingConfig: { sheet: 'Numbering_Config', label: 'Numbering Config', labelField: 'docType',
      searchable: ['docType', 'pattern'], sortable: ['docType'],
      fields: [f('docType', 'Doc type', 'select', { options: 'ENUM', optionsFrom: 'DOC_TYPE', required: true }),
        f('pattern', 'Pattern', 'text', { required: true, max: 100 }),
        f('prefix', 'Prefix', 'text', { max: 20 }),
        f('sequenceLength', 'Sequence length', 'number'),
        f('resetPolicy', 'Reset policy', 'select', { options: 'ENUM', optionsFrom: 'RESET_POLICY' }),
        f('nextSequence', 'Next sequence', 'number'),
        f('lastResetToken', 'Last reset token', 'text', { max: 20 })] },

    roles: { sheet: 'Roles', label: 'Roles', labelField: 'roleName',
      searchable: ['roleKey', 'roleName', 'description'], sortable: ['roleKey', 'sortOrder'],
      authSheet: true,
      fields: [keyField('roleKey', 'Role key'),
        f('roleName', 'Role name', 'text', { required: true, max: 60 }),
        DESC,
        f('isSystem', 'System role', 'checkbox'),
        SORT] },

    permissions: { sheet: 'Permissions', label: 'Permissions', labelField: 'permissionKey',
      searchable: ['permissionKey', 'module', 'action', 'description'], sortable: ['permissionKey'],
      authSheet: true,
      fields: [keyField('permissionKey', 'Permission key'),
        f('module', 'Module', 'text', { required: true, max: 40 }),
        f('action', 'Action', 'text', { required: true, max: 40 }),
        DESC] },

    rolePermissions: { sheet: 'Role_Permissions', label: 'Role Permissions', labelField: 'rolePermissionId',
      searchable: ['roleKey', 'permissionKey'], sortable: ['roleKey', 'permissionKey'],
      authSheet: true,
      fields: [f('roleKey', 'Role', 'reference', { ref: 'roles', refLabel: 'roleName', required: true }),
        f('permissionKey', 'Permission', 'reference', { ref: 'permissions', refLabel: 'permissionKey', required: true }),
        f('isAllowed', 'Allowed', 'checkbox')] },

    statusConfig: { sheet: 'Status_Config', label: 'Status Config', labelField: 'statusName',
      searchable: ['domain', 'statusKey', 'statusName'], sortable: ['domain', 'sortOrder'],
      fields: [f('domain', 'Domain', 'text', { required: true, max: 40 }),
        f('statusKey', 'Status key', 'text', { required: true, max: 40 }),
        f('statusName', 'Status name', 'text', { required: true, max: 60 }),
        f('isOpen', 'Open', 'checkbox'),
        f('isTerminal', 'Terminal', 'checkbox'),
        f('colorToken', 'Color token', 'text', { max: 20 }),
        SORT] }
  };

  return { ENUM_OPTIONS: ENUM_OPTIONS, MASTER_ENTITIES: MASTER_ENTITIES };
})();