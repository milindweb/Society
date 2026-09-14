/* enums.ts — Config keys and constants (structure.md §6, api-contract.md §6) */

export const STATUS_FAMILIES = [
  'COMPLAINT',
  'DEMAND',
  'PAYMENT',
  'VISITOR',
  'ATTENDANCE',
  'SALARY',
  'NOTICE',
  'MEETING',
  'DOCUMENT',
  'PARKING',
  'ALLOCATION',
  'FLAT',
  'ENTITY',
  'EXPENSE',
  'USER',
  'RESULT',
  'BILLING',
] as const;

export type StatusFamily = (typeof STATUS_FAMILIES)[number];

export const ID_PREFIXES = {
  WING: 'WNG',
  FLAT: 'FLT',
  MEMBER: 'MBR',
  FAMILY_MEMBER: 'FAM',
  VEHICLE: 'VEH',
  PARKING_SLOT: 'PRK',
  DEMAND: 'DMD',
  PAYMENT: 'PAY',
  RECEIPT: 'RCP',
  LEDGER: 'LED',
  ADJUSTMENT: 'ADJ',
  EXPENSE: 'EXP',
  VENDOR: 'VND',
  AMC: 'AMC',
  EMPLOYEE: 'EMP',
  DOCUMENT: 'DOC',
  AUDIT: 'AUD',
  BACKUP: 'BKP',
  ARCHIVE: 'ARC',
  COMPLAINT: 'CMP',
  COMPLAINT_UPDATE: 'CUP',
  VISITOR: 'VIS',
  NOTICE: 'NOT',
  MEETING: 'MTG',
  ATTENDANCE: 'ATT',
  SALARY: 'SAL',
  USER: 'USR',
} as const;

export const SCOPE = {
  GLOBAL: 'GLOBAL',
  MEMBER_SELF: 'MEMBER_SELF',
  PUBLIC: 'PUBLIC',
} as const;

export type Scope = (typeof SCOPE)[keyof typeof SCOPE];

export const DATE_FORMATS = {
  ISO: 'YYYY-MM-DD',
  DISPLAY: 'DD/MM/YYYY',
  DISPLAY_WITH_TIME: 'DD/MM/YYYY HH:mm',
} as const;

export const FINANCIAL_YEAR = {
  START_MONTH: 4,
  START_DAY: 1,
} as const;

export const ENTITY_KEYS = [
  'wings',
  'flatTypes',
  'employeeTypes',
  'vehicleTypes',
  'noticeTypes',
  'visitorTypes',
  'parkingTypes',
  'documentCategories',
  'complaintCategories',
  'complaintPriorities',
  'meetingTypes',
  'expenseCategories',
  'paymentModes',
  'chargeTypes',
  'chargeRates',
  'interestRules',
  'numberingConfig',
  'statusConfig',
  'parkingSlots',
  'vendors',
  'amc',
  'familyMembers',
  'vehicles',
] as const;

export type EntityKey = (typeof ENTITY_KEYS)[number];
