/* domain.ts — Domain entity types (structure.md §6, api-contract.md §7) */

import type { PageMeta } from './api';

/** The **authenticated session** user.
 *
 * Composed by `authService` from `auth.login` / `auth.me`, which return
 * `{user: sanitizeUser(user), roleKeys, permissions}` (AuthService.gs:478, :605).
 * `permissions` is therefore always present here and is read directly by
 * `ProtectedRoute`, `PermissionGate` and the nav — it is the caller's own
 * resolved permission set, not a target user's.
 *
 * The admin-facing list of *other* users is `UserRow`, which has no
 * `permissions` (resolving them is a per-user lookup the list does not do). */
export interface User {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  mobile: string;
  roleKeys: string[];
  permissions: string[];
  memberId?: string;
  flatId?: string;
  employeeId?: string;
  mustChangePassword: boolean;
  statusKey: string;
}

/** One row of `users.list` — `sanitizeUser` + the CSV `roleKeys` split.
 *
 * `sanitizeUser` (AuthService.gs:649) is the server's own allow-list of fields
 * that may leave the backend; it never includes a password hash or salt. */
export interface UserRow {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  mobile: string;
  /** CSV in the sheet; split into an array by `userView` (AuthService.gs:707). */
  roleKeys: string[];
  memberId?: string;
  employeeId?: string;
  flatId?: string;
  mustChangePassword: boolean;
  statusKey: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** `users.get` — the list row plus resolved permissions and linked records.
 *
 * `permissions` is present **only** here: `listUsers` returns `userView` alone
 * (AuthService.gs:742), and resolving permissions is a per-user lookup
 * (`RbacService.resolvePermissions`), so it would be wasteful in a list. */
export interface UserDetail extends UserRow {
  permissions: string[];
  member?: { memberId: string; fullName: string; flatId?: string };
  employee?: { employeeId: string; fullName: string; employeeCode?: string };
}

/** `roles.list` / `roles.create` / `roles.update` view.
 *
 * Note the naming split: the sheet column is `status` but every role view
 * exposes it as `statusKey` (`AuthService.gs:990`). The master-entity view of
 * the same `Roles` sheet uses `status` instead — both write the same column. */
export interface Role {
  roleKey: string;
  roleName: string;
  description: string;
  isSystem: boolean;
  statusKey: string;
}

/** `permissions.list` — the permission catalog.
 *
 * The server returns `description`, not `label`, and also `action` and `status`. */
export interface Permission {
  permissionKey: string;
  module: string;
  action: string;
  description: string;
  status: string;
}

/** `roles.permissions.get` — `{permissionKey: isAllowed}` for one role.
 *
 * A missing key means "no row exists", which is equivalent to denied: only
 * ADMIN is seeded into `Role_Permissions` (`Setup.gs:268`), so for every other
 * role this map starts empty and must be built up deliberately. */
export interface RolePermissionMatrix {
  roleKey: string;
  permissions: Record<string, boolean>;
}

/** One entry in a `roles.permissions.update` call.
 *
 * The route requires a **non-empty** `entries[]` (`AuthService.gs:1176`), so the
 * UI must send only the rows the user actually changed. */
export interface RolePermissionEntry {
  permissionKey: string;
  isAllowed: boolean;
}

export interface SocietyConfig {
  societyName: string;
  address: string;
  registrationNumber: string;
  contactEmail: string;
  contactMobile: string;
  logo?: FileRef;
  timezone: string;
  currencyCode: string;
  currencySymbol: string;
  dateDisplayFormat: string;
  financialYearStartMonth: number;
  financialYearStartDay: number;
  searchMinChars: number;
  pageSizeDefault: number;
  isConfigured: boolean;
}

export interface FileRef {
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  folderKey: string;
}

/* ── Flats & Members ── */
export interface Flat {
  flatId: string;
  wingId: string;
  wingName?: string;
  flatNumber: string;
  floor: number;
  flatTypeId: string;
  flatTypeName?: string;
  carpetArea?: number;
  ownerMemberId?: string;
  ownerName?: string;
  tenantMemberId?: string;
  tenantName?: string;
  parkingSlotId?: string;
  statusKey: string;
  isActive: boolean;
  balanceSummary?: BalanceSummary;
}

export interface BalanceSummary {
  totalDemand: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueAmount: number;
}

export interface Member {
  memberId: string;
  flatId: string;
  flatNumber?: string;
  memberCode: string;
  fullName: string;
  relationType: string;
  mobile: string;
  email?: string;
  address?: string;
  isPrimary: boolean;
  emergencyContact?: string;
  statusKey: string;
  familyMembers?: FamilyMember[];
  vehicles?: Vehicle[];
}

export interface FamilyMember {
  familyMemberId: string;
  memberId: string;
  name: string;
  relation: string;
  mobile?: string;
  email?: string;
}

/* `Vehicles` (Schema.gs:167) — columns are `memberId, flatId, vehicleTypeKey,
 * vehicleNumber, makeModel, colour, statusKey`. The old shape invented
 * `vehicleType`, `registrationNumber` and `parkingSlotId`; none exist. Parking is
 * linked the other way round, through `Parking_Allocations.vehicleId`. */
export interface Vehicle {
  vehicleId: string;
  memberId?: string;
  flatId?: string;
  /** A `Vehicle_Types.typeKey`. */
  vehicleTypeKey?: string;
  vehicleNumber: string;
  makeModel?: string;
  colour?: string;
  statusKey: string;
}

/* ── Maintenance & Finance ── */
export interface BillingPeriod {
  periodId: string;
  periodKey: string;
  financialYear: string;
  month: number;
  statusKey: string;
  isLocked: boolean;
  lockedAt?: string;
  lockedBy?: string;
  demandCount: number;
  totalDemand: number;
  totalCollected: number;
}

/* A Demand row is one line per charge type (Schema.gs `Demands`). There is no
 * separate allocations collection on the backend — the row IS the allocation, and it
 * snapshots the rate/basis so historical demands stay explainable. Every amount is
 * server-computed; the UI only formats it (SRS §23). */
export interface Demand {
  demandId: string;
  demandNumber: string;
  periodId: string;
  periodKey: string;
  flatId: string;
  flatNumber?: string;
  wingName?: string;
  memberId?: string;
  chargeTypeId: string;
  chargeNameSnapshot: string;
  calculationMethodSnapshot?: string;
  rateSnapshot?: number;
  basisSnapshot?: string;
  quantitySnapshot?: number;
  /** The charge amount for this line, before previous dues. */
  amount: number;
  previousDueAmount: number;
  interestAmount: number;
  adjustmentAmount: number;
  /** amount + previousDueAmount, as computed by the server. */
  totalPayable: number;
  paidAmount: number;
  /** totalPayable - paidAmount, as computed by the server. */
  balanceAmount: number;
  statusKey: string;
  dueDate?: string;
  isCarriedForward?: boolean | string;
  generatedAt?: string;
  generatedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
  remarks?: string;
}

/** Response shape of `demands.generate`. `dryRun` is NOT supported by the backend,
 * so a successful call always means rows were written. */
export interface DemandGenerationResult {
  created: number;
  skipped: number;
  total: number;
  rows?: Demand[];
  period?: BillingPeriod;
}

/* Payments, per Schema.gs `Payments`. The server performs oldest-due-first allocation
 * itself (`PaymentService.recordPayment`) and returns the resulting allocation rows —
 * the client never proposes a split. */
export interface Payment {
  paymentId: string;
  receiptNumber: string;
  paymentDate: string;
  flatId: string;
  flatNumber?: string;
  memberId?: string;
  amount: number;
  /** Sum of the allocation rows the server created. */
  allocatedAmount: number;
  /** amount - allocatedAmount: the part that could not be matched to a demand. */
  unallocatedAmount: number;
  paymentModeKey: string;
  referenceNumber?: string;
  bankName?: string;
  remarks?: string;
  statusKey: string;
  receivedBy?: string;
  receivedAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
  reversedFromPaymentId?: string;
  attachmentRef?: string;
}

/** A row from `Payment_Allocations` — immutable on the server (APPEND sheet). */
export interface PaymentAllocation {
  allocationId: string;
  paymentId: string;
  demandId: string;
  periodKey?: string;
  flatId: string;
  amount: number;
}

/** Response of `payments.record`: the payment plus the allocation and receipt the
 * server created alongside it in the same transaction. */
export interface PaymentRecordResult {
  payment: Payment;
  allocations: PaymentAllocation[];
  receipt: Receipt;
}

/* Receipts, per Schema.gs `Receipts` (immutable APPEND sheet, 1:1 with a payment).
 * `societyIdentity` is attached by `receipts.get` so the receipt can be printed with
 * the correct header without a second config round-trip. */
export interface Receipt {
  receiptId: string;
  receiptNumber: string;
  paymentId: string;
  flatId: string;
  flatNumber?: string;
  memberId?: string;
  amount: number;
  paymentDate: string;
  issuedAt?: string;
  issuedBy?: string;
  templateKey?: string;
  driveFileId?: string;
  printCount: number;
  lastPrintedAt?: string;
  statusKey: string;
  societyIdentity?: SocietyConfig;
}

/** One ledger row. `Ledger` is APPEND-only; a row is never updated in place.
 * `entryDate` is the accounting date; `createdAt` breaks ties in the server's
 * sort (PaymentService.getLedger), so the UI must preserve server order. */
export interface LedgerEntry {
  entryId: string;
  flatId: string;
  memberId?: string;
  periodKey?: string;
  entryDate: string;
  /** OPENING | DEMAND | INTEREST | PAYMENT | ADJUSTMENT | WAIVER | PENALTY |
   * REVERSAL | WRITE_OFF — per PaymentService.gs ENTRY_TYPES. */
  entryType: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  referenceId?: string;
  referenceType?: string;
  refNumber?: string;
  createdAt?: string;
}

/** Per-period and per-type breakdown rows returned inside the summary. */
export interface LedgerBucket {
  debit: number;
  credit: number;
  /** Present on `byPeriod` rows only (debit − credit). */
  balance?: number;
}

/** Shape returned by `ledger.summary` (PaymentService.gs ledgerSummary).
 * `runningBalance` is the closing figure the server computed — the UI reads it
 * directly rather than deriving it (SRS §23). */
export interface LedgerSummary {
  flatId: string;
  flatNumber?: string;
  totalDebit: number;
  totalCredit: number;
  runningBalance: number;
  entryCount?: number;
  byPeriod?: Record<string, LedgerBucket>;
  byType?: Record<string, LedgerBucket>;
}

export interface Adjustment {
  adjustmentId: string;
  flatId: string;
  flatNumber?: string;
  periodKey?: string;
  demandId?: string;
  adjustmentType: string;
  amount: number;
  sign: 1 | -1;
  reason: string;
  createdBy: string;
  createdAt: string;
}

/* ── Complaints ── */
/** A complaint row. `Complaints` is AUDIT (mutable) and its `statusKey` must
 * always equal the latest `Complaint_Updates.statusKey` (ComplaintService.gs).
 *
 * Status flow (the TRANSITIONS map in ComplaintService.gs):
 *   OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED  (plus REOPENED, CANCELLED)
 * Legal next statuses are enforced server-side; the UI must offer only those. */
export interface Complaint {
  complaintId: string;
  complaintNumber: string;
  categoryId: string;
  categoryName?: string;
  priorityKey: string;
  priorityName?: string;
  title: string;
  description: string;
  flatId?: string;
  flatNumber?: string;
  memberId?: string;
  raisedByMemberId?: string;
  raisedByName?: string;
  /** Set on create (`raisedAt: ts`). There is no `createdAt` column. */
  raisedAt: string;
  /** Present in the sheet as the audit column; used for list sorting. */
  createdAt?: string;
  /** Free text on create; defaults to 'WEB'. */
  source?: string;
  statusKey: string;
  /** MEMBER | EMPLOYEE | VENDOR | NONE (ASSIGNEE_TYPE). */
  assignedToType?: string;
  assignedToId?: string;
  assignedToName?: string;
  assignedAt?: string;
  assignedBy?: string;
  targetDate?: string;
  resolvedAt?: string;
  closedAt?: string;
  closedBy?: string;
  correctiveAction?: string;
  resolutionRemarks?: string;
  attachmentRef?: string;
  /** Stored as a string on the sheet; `Utils.toNumber` on read. */
  reopenCount: string;
}

/** One row of the append-only `Complaint_Updates` sheet.
 * The real column names differ from the old frontend guess: they are
 * `complaintUpdateId`, `actionTakenByType`, `actionTakenById`, `actionTakenAt`. */
export interface ComplaintUpdate {
  complaintUpdateId: string;
  complaintId: string;
  statusKey: string;
  remarks: string;
  correctiveAction?: string;
  actionTakenByType?: string;
  actionTakenById?: string;
  actionTakenAt: string;
  attachmentRef?: string;
  createdAt?: string;
}

/** `complaints.get` returns the complaint **and** its updates together. */
export interface ComplaintDetail {
  complaint: Complaint;
  updates: ComplaintUpdate[];
}

/** `complaints.summary` — status counts plus priority/category breakdowns.
 * `byCategory` is keyed by `categoryId`, so the UI maps names via config. */
export interface ComplaintSummary {
  total: number;
  counts: {
    open: number;
    assigned: number;
    inProgress: number;
    resolved: number;
    closed: number;
    cancelled: number;
    reopened: number;
  };
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  avgResolutionDays: number;
}

/* ── Visitors ── */
export interface Visitor {
  visitorId: string;
  passNumber: string;
  visitorName: string;
  mobile: string;
  visitorTypeId: string;
  visitorTypeName?: string;
  purpose: string;
  flatId: string;
  flatNumber?: string;
  memberId?: string;
  memberName?: string;
  /** Resolved server-side from the flat's primary member when not supplied. */
  residentName?: string;
  vehicleNumber?: string;
  /** Stored as a string: the server writes `String(Utils.toNumber(personCount, 1))`. */
  personCount: string;
  remarks?: string;
  /** INSIDE → EXITED (OVERSTAY is applied by a backend trigger). */
  statusKey: string;
  entryAt: string;
  exitAt?: string;
  entryGate?: string;
  exitGate?: string;
  attachmentRef?: string;
  loggedByUserId?: string;
  loggedByEmployeeId?: string;
}

/** `visitors.summary` — inside count plus today's movements. */
export interface VisitorSummary {
  total: number;
  inside: number;
  todayEntries: number;
  todayExits: number;
}

/* ── Notices ──
 * Columns verified against `Schema.gs:243` (Notices) and `CommunicationService.gs`.
 * Server quirks the UI must respect:
 *  - `isPublished` is stored as the STRING 'TRUE'/'FALSE', and `isPinned` likewise.
 *  - the expiry column is `expiryDate`, not `expiresAt`.
 *  - `isPublished` is a denormalised mirror of `statusKey` (DRAFT ↔ PUBLISHED); the
 *    service keeps them in step, so render `statusKey` and treat `isPublished` as derived.
 *  - `createdBy` does not exist on the sheet; the sheet records `publishedBy`. */
export interface Notice {
  noticeId: string;
  noticeNumber: string;
  title: string;
  noticeTypeId: string;
  noticeTypeName?: string;
  noticeDate: string;
  /** Set only when the notice was published (`notices.publish`). */
  publishDate?: string;
  expiryDate?: string;
  description: string;
  /** ALL | ROLE | WING | FLAT | MEMBER — from `SchemaMeta.ENUM_OPTIONS.AUDIENCE_TYPE`,
   * surfaced via `config.enums` and read with `useEnumOptions('AUDIENCE_TYPE')`. */
  audienceType: string;
  /** Role keys / wing ids / flat ids / member ids, comma-separated. */
  audienceRef?: string;
  /** Stored as 'TRUE' / 'FALSE'. */
  isPublished: string;
  publishedAt?: string;
  publishedBy?: string;
  unpublishReason?: string;
  /** Stored as 'TRUE' / 'FALSE'. */
  isPinned: string;
  attachmentRef?: string;
  statusKey: string;
}

/** `notices.get` returns the notice row directly. */
export type NoticeDetail = Notice;

/* ── Meetings ──
 * Columns verified against `Schema.gs:248` (Meetings) and `CommunicationService.gs`.
 * Server quirks:
 *  - the type column is `meetingTypeKey` (a typeKey), NOT `meetingTypeId`.
 *  - `quorumRequired` / `quorumPresent` are STRINGS.
 *  - `linkedDocumentIds` is a comma-separated string; `meetings.get` additionally
 *    resolves them into `linkedDocuments` (SRS §8: meeting documents live in the
 *    Documents module, not a second store). */
export interface Meeting {
  meetingId: string;
  meetingNumber: string;
  /** A `Meeting_Types.typeKey` (e.g. AGM), not an id. */
  meetingTypeKey: string;
  meetingTypeName?: string;
  title: string;
  meetingDate: string;
  startTime?: string;
  endTime?: string;
  venue?: string;
  agenda?: string;
  /** Filled in as the meeting concludes. */
  minutes?: string;
  resolutions?: string;
  quorumRequired?: string;
  quorumPresent?: string;
  conductedBy?: string;
  /** SCHEDULED → COMPLETED | CANCELLED | POSTPONED (validated service-side). */
  statusKey: string;
  /** Comma-separated document ids. */
  linkedDocumentIds?: string;
  /** Resolved by `meetings.get` only. */
  linkedDocuments?: FileRef[];
}

/** `meetings.get` — the meeting plus its attendance rows. */
export interface MeetingDetail extends Meeting {
  attendance: MeetingAttendance[];
}

export interface MeetingAttendance {
  meetingAttendanceId: string;
  meetingId: string;
  /** MEMBER | EMPLOYEE | VENDOR | GUEST — from `SchemaMeta.ENUM_OPTIONS.ATTENDEE_TYPE`. */
  attendeeType: string;
  attendeeId?: string;
  attendeeName: string;
  flatId?: string;
  roleInMeeting?: string;
  /** Stored as 'TRUE' / 'FALSE'. */
  isPresent: string;
  remarks?: string;
}

/* ── Documents ──
 * Columns verified against `Schema.gs:257` (Documents) and `DocumentService.gs`.
 * Server quirks the UI must respect:
 *  - `fileRef` is a **JSON STRING** on the sheet (`Utils.safeJsonStringify` at
 *    `DocumentService.gs:275`), NOT an object. Parse it before use; a row with no
 *    upload yet has `fileRef === ''`.
 *  - `isArchived` is stored as the STRING 'TRUE'/'FALSE' and `statusKey` mirrors
 *    it (`ACTIVE` / `ARCHIVED`); render `statusKey`, treat `isArchived` as derived.
 *  - `createdBy` does NOT exist. The sheet records `uploadedBy` / `uploadedAt`,
 *    which are only set once a file has actually been uploaded.
 *  - `versionNo` is a STRING; `documents.upload` increments it on every re-upload.
 *  - There is NO `relatedModule` column — the link is `linkedEntityType` +
 *    `linkedEntityId` (SRS §9 "Related module"). */
export interface Document {
  documentId: string;
  documentNumber: string;
  title: string;
  categoryId: string;
  categoryName?: string;
  description?: string;
  tags?: string;
  /** Free-form entity name, e.g. 'Member' / 'Meeting' / 'Complaint'. */
  linkedEntityType?: string;
  linkedEntityId?: string;
  /** JSON string (see the note above); '' when no file has been uploaded. */
  fileRef?: string;
  /** Incremented by `documents.upload`. */
  versionNo: string;
  /** Stored as 'TRUE' / 'FALSE'. */
  isArchived: string;
  effectiveDate?: string;
  expiryDate?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  statusKey: string;
}

/** `documents.get` returns the document row directly. */
export type DocumentDetail = Document;

/** The fileRef payload, after parsing `Document.fileRef`.
 * `DocumentService.upload` writes exactly these keys
 * (`DocumentService.gs:275-282`). */
export interface DocumentFileRef {
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  /** The resolved Drive folder id, stored under the key `folderKey`. */
  folderKey: string;
}

/* ── Parking ──
 * Columns verified against `Schema.gs:175` (Parking_Slots),
 * `Schema.gs:262` (Parking_Allocations) and `ParkingService.gs`.
 *
 * ⚠️ There is NO parking-slot read or write API. `ParkingService` exposes only
 * `listAllocations`, `getAllocation`, `createAllocation`, `endAllocation` and
 * `summary` — slots are created exclusively through the config master-data
 * screens (`config.entity.upsert('parkingSlots')`). `ParkingSlotsPage` therefore
 * reads the slot master via `config.entity.list` and shows it read-only. */
export interface ParkingSlot {
  parkingSlotId: string;
  slotNumber: string;
  parkingTypeId?: string;
  parkingTypeName?: string;
  wingId?: string;
  wingName?: string;
  /** Free text on the sheet, not a number. */
  floorLevel?: string;
  location?: string;
  /** AVAILABLE | ALLOCATED | BLOCKED | MAINTENANCE (kept in step by the service). */
  statusKey: string;
  remarks?: string;
}

export interface ParkingAllocation {
  allocationId: string;
  parkingSlotId: string;
  slotNumber?: string;
  flatId: string;
  flatNumber?: string;
  memberId?: string;
  memberName?: string;
  vehicleId?: string;
  vehicleNumber?: string;
  /** PERMANENT | TEMPORARY — from `SchemaMeta.ENUM_OPTIONS.ALLOCATION_TYPE`. */
  allocationType: string;
  startDate: string;
  endDate?: string;
  /** Stored as a STRING (`String(Utils.toNumber(...))` at `ParkingService.gs:129`). */
  monthlyCharge: string;
  statusKey: string;
  remarks?: string;
}

/** `parking.summary` — computed server-side (`ParkingService.gs:209`). */
export interface ParkingSummary {
  totalSlots: number;
  available: number;
  allocated: number;
  blocked: number;
  activeTemporary: number;
  monthlyChargeCollection: number;
}

/* ── Employees (FE-10) ──
 * Verified against backend/src/Schema.gs:179-182 (`Employees`) and HRService.gs.
 *
 * ⚠️ Almost every numeric column on the HR sheets is stored as a STRING, and the
 * salary row carries its own name ("netSalary") rather than the arithmetic the UI
 * might expect. Never assume a JS number here. */
export interface Employee {
  employeeId: string;
  /** Server-generated `EMP0001`-style code when not supplied on create. */
  employeeCode: string;
  fullName: string;
  employeeTypeId: string;
  employeeTypeName?: string;
  mobile?: string;
  altMobile?: string;
  email?: string;
  address?: string;
  joinDate: string;
  /** Only set by `employees.archive`, which stamps the archive date. */
  exitDate?: string;
  /** STRING on the sheet (`HRService.gs:153`). Format for display only. */
  monthlySalary: string;
  statusKey: string;
  bankName?: string;
  bankAccount?: string;
  ifsc?: string;
  emergencyName?: string;
  emergencyMobile?: string;
  idProofType?: string;
  idProofNumber?: string;
  notes?: string;
}

/** One day's attendance for one employee.
 * Sheet is `Employee_Attendance`, primary key `attendanceId` (not `attendanceId`
 * on an `Attendance` sheet). Unique on employeeId + attendanceDate. */
export interface EmployeeAttendance {
  attendanceId: string;
  employeeId: string;
  employeeName?: string;
  attendanceDate: string;
  /** PRESENT | ABSENT | LEAVE | HALF_DAY | HOLIDAY (Status_Config domain ATTENDANCE). */
  statusKey: string;
  inTime?: string;
  outTime?: string;
  /** STRING. Only written on CREATE by `attendance.mark`, never on update. */
  workedHours?: string;
  /** STRING (`HRService.gs:292`). */
  overtimeHours?: string;
  remarks?: string;
  markedByUserId?: string;
  markedAt?: string;
}

/** `employees.get` — a composite, not a bare employee row. */
export interface EmployeeDetail {
  employee: Employee;
  /** Most recent 30 rows, newest first. */
  recentAttendance: EmployeeAttendance[];
  /** Most recent 12 rows, newest period first. */
  salaryHistory: EmployeeSalary[];
}

/** `attendance.summary` — keyed by employeeId. Counts only, computed server-side. */
export interface AttendanceSummaryRow {
  present: number;
  absent: number;
  leave: number;
  halfDay: number;
  holiday: number;
}

export type AttendanceSummaryMap = Record<string, AttendanceSummaryRow>;

/** `attendance.mark` acknowledges; it does NOT return the rows.
 * `marked` is the number of rows submitted, `newlyCreated` the number inserted
 * (the rest were upserts onto an existing employeeId + attendanceDate). */
export interface AttendanceMarkResult {
  marked: number;
  newlyCreated: number;
}

/** One employee's monthly salary row.
 * Sheet is `Employee_Salary`, primary key `salaryId`; unique on employeeId +
 * periodKey. EVERY component is a STRING on the sheet; `netSalary` is computed
 * by the server in `HRService.computeNetSalary` and must never be recomputed
 * here (SRS §8/§23). */
export interface EmployeeSalary {
  salaryId: string;
  employeeId: string;
  employeeName?: string;
  /** `YYYY-MM`. */
  periodKey: string;
  baseSalary: string;
  /** The divisor the server used (currently a hardcoded 30 in HRService). */
  workingDays: string;
  /** HALF_DAY adds 0.5, so this can be fractional. */
  presentDays: string;
  absentDays: string;
  leaveDays: string;
  halfDays: string;
  holidayDays: string;
  perDayAmount: string;
  attendanceAdjustment: string;
  overtimeHours: string;
  overtimeAmount: string;
  allowanceAmount: string;
  advanceDeduction: string;
  otherDeduction: string;
  bonusAmount: string;
  otherAdjustment: string;
  netSalary: string;
  paymentDate?: string;
  paymentModeKey?: string;
  referenceNumber?: string;
  /** DRAFT | APPROVED | PAID | CANCELLED (Status_Config domain SALARY). */
  statusKey: string;
  remarks?: string;
  attachmentRef?: string;
}

/** `salary.get` — a composite, not a bare salary row. */
export interface SalaryDetail {
  salary: EmployeeSalary;
  /** May be null: the employee row is a separate lookup in the service. */
  employee: Employee | null;
  /** Every attendance row in that period, for the breakdown panel. */
  attendanceBreakdown: EmployeeAttendance[];
}

/** `salary.prepare` — a run summary, not the rows themselves. */
export interface SalaryPrepareResult {
  periodKey: string;
  /** How many salary rows were created (existing ones are skipped). */
  created: number;
  rows: EmployeeSalary[];
}

/* ── Expenses (FE-11) ──
 * Columns verified against `Schema.gs:222-225` (Expenses) and `ExpenseService.gs`.
 *
 * ⚠️ `amount` is a **STRING** on the sheet — `ExpenseService.create` writes
 * `String(Utils.toNumber(...))` (`ExpenseService.gs:122`). It is parsed for
 * display only and never used for arithmetic on the client (SRS §8/§23).
 *
 * ⚠️ `attachmentRef` is a **JSON string**, not a `FileRef` object — same shape as
 * `Document.fileRef`. Parse it with `parseFileRef()`; do not read it raw.
 *
 * There is no `vendorName` / `categoryName` / `createdBy` on the row: `list` and
 * `get` return the raw sheet columns with **no join** (`ExpenseService.gs:77-107`),
 * so display names are resolved client-side from config lookups. */
export interface Expense {
  expenseId: string;
  /** Server-generated from `Numbering_Config` as `EXP/{FY}/{seq}` (`ExpenseService.gs:51-71`). */
  expenseNumber: string;
  expenseDate: string;
  /** `YYYY-MM`. Defaults to the current period when the create omits it. */
  periodKey?: string;
  categoryId: string;
  description: string;
  vendorId?: string;
  /** Free text — used when no vendor record applies. */
  payeeName?: string;
  /** STRING on the sheet. Parse for display only. */
  amount: string;
  paymentModeKey?: string;
  referenceNumber?: string;
  paidBy?: string;
  /** JSON string, not an object. Parse with `parseFileRef()`. */
  attachmentRef?: string;
  remarks?: string;
  /** POSTED | CANCELLED (Status_Config domain EXPENSE, `Setup.gs:73`). */
  statusKey: string;
  /** Set only by `expenses.cancel`. */
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
}

/** `expenses.summary` — server-computed totals, already rounded via `Utils.round2`.
 *
 * `byCategory` / `byVendor` / `byMonth` are keyed maps of amounts. Note the two
 * synthetic keys the service inserts when a row has no id: `'UNCATEGORIZED'` and
 * `'DIRECT'` (`ExpenseService.gs:236-240`) — the UI must resolve those to real
 * labels rather than showing the raw sentinel. */
export interface ExpenseSummary {
  /** Number of POSTED expenses counted. */
  total: number;
  totalAmount: number;
  /** Keyed by categoryId, plus 'UNCATEGORIZED'. */
  byCategory: Record<string, number>;
  /** Keyed by vendorId, plus 'DIRECT'. */
  byVendor: Record<string, number>;
  /** Keyed by `YYYY-MM`. */
  byMonth: Record<string, number>;
}

/** A vendor — read-only in this phase. There is **no `vendors.*` API**:
 * `ExpenseService` exposes only list/get/create/update/cancel/summary, so vendors
 * are read from the config master (`config.entity.list('vendors')`).
 * Columns verified against `Schema.gs:184-186`. */
export interface Vendor {
  vendorId: string;
  vendorName: string;
  categoryKey?: string;
  contactPerson?: string;
  mobile?: string;
  altMobile?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  panNumber?: string;
  bankName?: string;
  bankAccount?: string;
  ifsc?: string;
  statusKey: string;
  notes?: string;
}

/* ── Config Entities ──
 *
 * Contract source: `SchemaMeta.MASTER_ENTITIES` (SchemaMeta.gs:42-267) as projected
 * by `buildEntityMeta` (ConfigService.gs:323-338). 24 master entities are declared
 * there and every one of them is served by the same `config.entity.*` route family.
 *
 * Corrections against the previous frontend shape:
 *  - the key field is `entity`, NOT `entityKey` (`buildEntityMeta` returns
 *    `entity: key`), and all other read responses call it `entity` too
 *  - `searchable` / `sortable` are **arrays of column names**, not booleans
 *  - `sheet` and `labelField` ARE returned and are needed to render a row title
 *  - there is no `archiveable` — deactivation is `config.entity.setStatus`
 *  - field `type` additionally includes `percent`, `phone`, `email`, `checkbox`
 *    and `reference` (a lookup into another entity)
 *  - `required` and `options` are optional; `optionsFrom` may name either an
 *    `ENUM_OPTIONS` key or another master entity, switched by `options`
 */
export interface ConfigEntity {
  /** camelCase key used in every `config.entity.*` payload, e.g. `wings`. */
  entity: string;
  /** Physical sheet name, e.g. `Wings`. */
  sheet: string;
  /** Human label for the entity, e.g. `Wings`. */
  label: string;
  /** Column holding the human-readable row title, e.g. `wingName`. */
  labelField: string;
  /** The entity's id column, e.g. `wingId`. */
  idColumn: string;
  /** Columns the server will search across. */
  searchable: string[];
  /** Columns the server will sort by; the first is the default sort. */
  sortable: string[];
  fields: ConfigEntityField[];
  permissions: { read: string; write: string };
}

/** A form field descriptor for one master entity.
 *
 * `type` drives which input the generic Settings form renders. */
export interface ConfigEntityField {
  key: string;
  label: string;
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'percent'
    | 'checkbox'
    | 'select'
    | 'date'
    | 'reference'
    | 'phone'
    | 'email';
  required?: boolean;
  /** Max length hint for text-like fields. */
  max?: number;
  /** How to source `optionsFrom`.
   *  - `ENUM`   → look up `SchemaMeta.ENUM_OPTIONS[optionsFrom]`
   *  - otherwise → `optionsFrom` names another master entity to list
   *  (`EXPENSE_CATEGORIES` is a legacy marker for the expenseCategories entity) */
  options?: 'ENUM' | 'EXPENSE_CATEGORIES' | string;
  /** For `select`/`reference`: which enum key or entity to load options from. */
  optionsFrom?: string;
  /** For `reference`: the entity being referenced. */
  ref?: string;
  /** For `reference`: the column in the referenced entity to display. */
  refLabel?: string;
}

export interface SelectOption {
  value: string;
  label: string;
  statusKey?: string;
}

/* ── Config Enums ── */
export interface ConfigEnums {
  statuses: Record<string, SelectOption[]>;
  chargeTypes: SelectOption[];
  paymentModes: SelectOption[];
  categories: Record<string, SelectOption[]>;
  types: Record<string, SelectOption[]>;
  numbering: { docType: string; prefix: string; nextNumber: number }[];
  roles: SelectOption[];
  permissions?: Permission[];
  /** `SchemaMeta.ENUM_OPTIONS` — a map of `key -> string[]`, consumed by `useEnumOptions`. */
  enums?: Record<string, string[]>;
  /** Sheets `archive.run` may walk, derived server-side from `Schema.archivableSheets()`. */
  archivableEntities?: SelectOption[];
}

/* ── Dashboard ── */
export interface DashboardSummary {
  flatsMembers: { totalFlats: number; totalMembers: number; occupied: number; vacant: number };
  finance: { totalDemand: number; totalCollection: number; totalOutstanding: number; overdueAmount: number; monthly?: { month: string; demand: number; collection: number }[] };
  counts: { paidMembers: number; partialMembers: number; pendingMembers: number };
  totalExpenses?: number;
  monthlyExpenses?: { month: string; amount: number }[];
  recentPayments: Payment[];
  recentComplaints: Complaint[];
  recentNotices: Notice[];
  recentVisitors: Visitor[];
  quickActions: QuickAction[];
}

export interface QuickAction {
  label: string;
  route: string;
  permission: string;
  icon?: string;
}

/* ── Backup & Audit ──
 * Contract source: `Schema.gs` (Backups :282, Archive_Index :290, Audit_Log :277),
 * `BackupService.gs` (create :85, list :150, runArchive :206, listArchive :340,
 * listAudit :413) and `Routes.gs:1033-1072`.
 *
 * These three shapes used to be invented. The corrections that matter:
 *  - `Backups` has **no `rowCount`**. Per-sheet counts live in `sheetRowCountsJson`
 *    (a JSON string) and `sizeBytes` is a **string** estimate, not a number.
 *  - `Audit_Log` timestamps are the column **`ts`**, not `timestamp`.
 *  - `beforeJson` / `afterJson` are **JSON strings**, not objects, and are already
 *    redacted server-side (`BackupService.redactAuditJson`). Do not re-redact as a
 *    substitute for parsing — parse, then render.
 *  - `Archive_Index`'s id column is **`archiveIndexId`** and the entity column is
 *    **`entity`** (holding the source *sheet* name), not `archiveId`/`originalEntity`.
 */

/** A row of the `Backups` sheet, as returned by `backup.list`. */
export interface Backup {
  backupId: string;
  scope: string;
  /** The source spreadsheet id the backup was taken from. */
  spreadsheetIds: string;
  driveFolderId: string;
  /** JSON string: `{ [sheetName]: rowCount }`. */
  sheetRowCountsJson: string;
  appVersion: string;
  /** String, e.g. `"3"` — never assume a number. */
  schemaVersion: string;
  /** String byte estimate (`String(totalRows * 100)`), not a number. */
  sizeBytes: string;
  checksum: string;
  statusKey: string;
  notes: string;
  createdAt: string;
  createdBy: string;
}

/** What `backup.create` actually returns — a summary, not the stored row. */
export interface BackupCreateResult {
  backupId: string;
  scope: string;
  totalRows: number;
  /** Number of sheets included, not the sheet names. */
  sheets: number;
  checksum: string;
}

/** A row of the `Audit_Log` sheet, as returned by `audit.list` / `audit.get`. */
export interface AuditEntry {
  auditId: string;
  /** Timestamp column — the sheet calls it `ts`. */
  ts: string;
  actorUserId: string;
  actorName: string;
  actorRoleKeys: string;
  action: string;
  /** Source sheet name (e.g. `Payments`), resolved by `Schema.entityToSheet`. */
  entity: string;
  entityId: string;
  entityLabel: string;
  /** JSON string, secrets redacted. */
  beforeJson: string;
  /** JSON string, secrets redacted. */
  afterJson: string;
  changedFields: string;
  reason: string;
  sourceSheet: string;
  requestId: string;
  /** `SUCCESS` / `FAILURE`-style outcome recorded by `Audit.write`. */
  result: string;
  createdAt: string;
  createdBy: string;
}

/** A row of the `Archive_Index` sheet, as returned by `archive.list`. */
export interface ArchiveEntry {
  archiveIndexId: string;
  /** The source sheet the record came from (e.g. `Audit_Log`). */
  entity: string;
  /** The `Archive_<entity>` sheet the row was copied into. */
  archiveSheet: string;
  originalId: string;
  keyFieldsJson: string;
  archivedAt: string;
  archivedBy: string;
  reason: string;
}

/* ===========================================================================
 * FE-12 — Reports
 * ===========================================================================
 * Contract source: `ReportService.gs` (REPORT_CATALOG at :279, catalog at
 * :316, run at :334, computeTotals at :402, exportReport at :436) and
 * `Routes.gs:1012-1031`.
 *
 * IMPORTANT differences from the naive frontend shape that used to exist here:
 *  - `reports.catalog` returns an **object keyed by reportKey**, NOT an array.
 *  - `reports.run` returns `{ ok, data: {reportKey,title,rows,totals}, page }`
 *    — `page` is a SIBLING of `data`, not nested inside it.
 *  - `totals` is computed over **all filtered rows**, not just the current page.
 *  - Report rows are **dynamically shaped**: `run` projects only the columns
 *    declared in the catalog entry, so a row is a loose string map. There is no
 *    fixed row interface, by design.
 * =========================================================================== */

/** A single column projection entry in a report definition.
 *
 * `REPORT_CATALOG` declares `columns` as a plain array of sheet column names
 * (e.g. `['flatId','flatNumber','amount']`), consumed verbatim by
 * `run`/`exportReport` to project each row. The frontend therefore receives
 * column **keys only** — the human label has to be derived client-side. */
export type ReportColumnKey = string;

/** Filters a report accepts, as declared in the catalog.
 *
 * `REPORT_CATALOG` lists `filters` as bare strings (e.g. `['from','to','paymentModeKey']`),
 * and `run` forwards whatever the caller sends straight into `readAll`'s filter
 * map. Only render an input for keys listed here — sending an undeclared filter
 * would be silently ignored-or-mismatched by the sheet reader. */
export type ReportFilterKey = string;

/** One entry of the report catalog, as returned by `reports.catalog`. */
export interface ReportDefinition {
  key: string;
  title: string;
  filters: ReportFilterKey[];
  columns: ReportColumnKey[];
}

/** The catalog payload: an object keyed by reportKey (NOT an array). */
export type ReportCatalog = Record<string, ReportDefinition>;

/** A projected report row. Keys are the catalog's declared columns.
 *
 * `run` does `obj[c] = r[c] || ''`, so every declared column is always present
 * and always a **string** (or `''`). Money therefore arrives as a string and
 * must be parsed for display only — the client never recomputes totals.
 */
export type ReportRow = Record<string, string>;

/** Server-computed totals for a report.
 *
 * `computeTotals` (:402) emits a **different shape per report family**:
 *   demand-summary / outstanding -> { amount, paid, balance }
 *   payment-register             -> { totalAmount, count }
 *   expense-summary              -> { totalAmount, count }
 *   complaint-summary / visitor-log -> {} (no numeric totals at all)
 * All fields are optional for that reason — check before rendering.
 */
export interface ReportTotals {
  amount?: number;
  paid?: number;
  balance?: number;
  totalAmount?: number;
  count?: number;
}

/** Result of `reports.run`.
 *
 * `page` is attached by `apiClient.normaliseData` — the backend sends the
 * cursor in `meta.page`, and the adapter lifts it onto this object because the
 * rows are nested here rather than being the payload itself. */
export interface ReportResult {
  reportKey: string;
  title: string;
  rows: ReportRow[];
  totals: ReportTotals;
  page?: PageMeta;
}

/** Result of `reports.export` — a CSV written to Google Drive.
 *
 * The backend uploads via `DriveService.uploadCsv` and returns a Drive file
 * reference; it does NOT stream bytes to the browser. The UI must link out to
 * `fileUrl` rather than trying to download through the API. */
export interface ReportExportResult {
  reportKey: string;
  title: string;
  fileName: string;
  fileId: string;
  fileUrl: string;
  rowCount: number;
  totals: ReportTotals;
  currency: string;
}

/* ===========================================================================
 * FE-12 — Global search
 * ===========================================================================
 * Contract source: `ReportService.globalSearch` (:69-188), route `search.global`
 * at `Routes.gs:1000` with `permission: null`.
 *
 * IMPORTANT:
 *  - `permission: null` means ANY authenticated user may call it. The grouping
 *    is instead filtered server-side by the caller's own permissions, so a user
 *    only ever sees groups they can already read. The client must not assume any
 *    particular group is present.
 *  - Each group has a **different row shape** (see the interfaces below). The
 *    server picks a small projection per entity — it is not the full record.
 *  - A group is **omitted entirely** when it has no matches, so every group key
 *    is optional.
 * =========================================================================== */

/** A group key emitted by `globalSearch` — one per searched entity. */
export type SearchGroupKey =
  | 'flats'
  | 'members'
  | 'complaints'
  | 'payments'
  | 'visitors'
  | 'demands'
  | 'vendors';

export interface SearchFlatHit {
  flatId: string;
  flatNumber: string;
  wingId: string;
  statusKey: string;
}

export interface SearchMemberHit {
  memberId: string;
  fullName: string;
  flatId: string;
  mobile: string;
}

export interface SearchComplaintHit {
  complaintId: string;
  complaintNumber: string;
  title: string;
  statusKey: string;
}

export interface SearchPaymentHit {
  paymentId: string;
  receiptNumber: string;
  /** String, straight off the sheet cell — parse for display only. */
  amount: string;
  statusKey: string;
}

export interface SearchVisitorHit {
  visitorId: string;
  passNumber: string;
  visitorName: string;
  statusKey: string;
}

export interface SearchDemandHit {
  demandId: string;
  demandNumber: string;
  periodKey: string;
  /** String, straight off the sheet cell — parse for display only. */
  balanceAmount: string;
}

export interface SearchVendorHit {
  vendorId: string;
  vendorName: string;
  statusKey: string;
}

/** The `groups` bag. Every group is optional: the server only includes groups
 *  that (a) the caller may read and (b) actually matched. */
export interface SearchGroups {
  flats?: SearchFlatHit[];
  members?: SearchMemberHit[];
  complaints?: SearchComplaintHit[];
  payments?: SearchPaymentHit[];
  visitors?: SearchVisitorHit[];
  demands?: SearchDemandHit[];
  vendors?: SearchVendorHit[];
}

/** Result of `search.global`. */
export interface SearchResult {
  query: string;
  groups: SearchGroups;
  totalGroups: number;
}
