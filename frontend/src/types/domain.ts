/* domain.ts — Domain entity types (structure.md §6, api-contract.md §7) */

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

export interface Role {
  roleKey: string;
  roleName: string;
  description: string;
  isSystem: boolean;
  statusKey: string;
}

export interface Permission {
  permissionKey: string;
  module: string;
  label: string;
}

export interface RolePermission {
  roleKey: string;
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

export interface Vehicle {
  vehicleId: string;
  memberId: string;
  vehicleType: string;
  registrationNumber: string;
  parkingSlotId?: string;
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

export interface Demand {
  demandId: string;
  periodKey: string;
  flatId: string;
  flatNumber?: string;
  wingName?: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  interestAmount: number;
  statusKey: string;
  allocations: DemandAllocation[];
}

export interface DemandAllocation {
  allocationId: string;
  chargeTypeId: string;
  chargeTypeName?: string;
  amount: number;
  paidAmount: number;
}

export interface Payment {
  paymentId: string;
  receiptNumber: string;
  flatId: string;
  flatNumber?: string;
  amount: number;
  paymentDate: string;
  paymentModeKey: string;
  referenceNumber?: string;
  remarks?: string;
  statusKey: string;
  allocations: PaymentAllocation[];
}

export interface PaymentAllocation {
  allocationId: string;
  demandId: string;
  periodKey?: string;
  amount: number;
}

export interface Receipt {
  receiptId: string;
  receiptNumber: string;
  paymentId: string;
  flatId: string;
  flatNumber?: string;
  amount: number;
  paymentDate: string;
  paymentModeKey: string;
  printCount: number;
  societyIdentity: SocietyConfig;
}

export interface LedgerEntry {
  entryId: string;
  flatId: string;
  periodKey?: string;
  entryDate: string;
  entryType: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  referenceId?: string;
  referenceType?: string;
}

export interface LedgerSummary {
  flatId: string;
  flatNumber?: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
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
export interface Complaint {
  complaintId: string;
  complaintNumber: string;
  categoryId: string;
  categoryName?: string;
  priorityKey: string;
  title: string;
  description: string;
  flatId?: string;
  flatNumber?: string;
  raisedByMemberId?: string;
  raisedByName?: string;
  assignedToType?: string;
  assignedToId?: string;
  assignedToName?: string;
  correctiveAction?: string;
  resolutionRemarks?: string;
  statusKey: string;
  createdAt: string;
  closedAt?: string;
  reopenCount: number;
}

export interface ComplaintUpdate {
  updateId: string;
  complaintId: string;
  statusKey: string;
  remarks: string;
  correctiveAction?: string;
  updatedBy: string;
  updatedAt: string;
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
  vehicleNumber?: string;
  personCount: number;
  remarks?: string;
  statusKey: string;
  entryAt: string;
  exitAt?: string;
  exitGate?: string;
}

/* ── Notices ── */
export interface Notice {
  noticeId: string;
  noticeNumber: string;
  title: string;
  noticeTypeId: string;
  noticeTypeName?: string;
  noticeDate: string;
  description: string;
  audienceType: string;
  audienceRef?: string;
  attachmentRef?: FileRef;
  isPublished: boolean;
  publishedAt?: string;
  expiresAt?: string;
  statusKey: string;
  createdBy: string;
}

/* ── Meetings ── */
export interface Meeting {
  meetingId: string;
  meetingNumber: string;
  meetingTypeId: string;
  meetingTypeName?: string;
  title: string;
  meetingDate: string;
  startTime?: string;
  endTime?: string;
  venue?: string;
  agenda?: string;
  statusKey: string;
  quorumPresent?: number;
  linkedDocuments?: FileRef[];
}

export interface MeetingAttendance {
  attendanceId: string;
  meetingId: string;
  attendeeType: string;
  attendeeId: string;
  attendeeName: string;
  isPresent: boolean;
  remarks?: string;
}

/* ── Documents ── */
export interface Document {
  documentId: string;
  documentNumber: string;
  title: string;
  categoryId: string;
  categoryName?: string;
  description?: string;
  tags?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  effectiveDate?: string;
  expiryDate?: string;
  fileRef?: FileRef;
  statusKey: string;
  createdBy: string;
}

/* ── Parking ── */
export interface ParkingSlot {
  parkingSlotId: string;
  slotNumber: string;
  floor: number;
  wingId?: string;
  wingName?: string;
  parkingType: string;
  monthlyCharge: number;
  statusKey: string;
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
  allocationType: string;
  startDate: string;
  endDate?: string;
  monthlyCharge: number;
  statusKey: string;
}

/* ── Employees ── */
export interface Employee {
  employeeId: string;
  employeeCode: string;
  name: string;
  employeeTypeId: string;
  employeeTypeName?: string;
  mobile: string;
  address?: string;
  joinDate: string;
  salary: number;
  salaryType: string;
  statusKey: string;
}

export interface Attendance {
  attendanceId: string;
  employeeId: string;
  employeeName?: string;
  attendanceDate: string;
  statusKey: string;
  inTime?: string;
  outTime?: string;
  overtimeHours?: number;
  remarks?: string;
}

export interface Salary {
  salaryId: string;
  employeeId: string;
  employeeName?: string;
  periodKey: string;
  baseSalary: number;
  presentDays: number;
  totalDays: number;
  overtimeAmount: number;
  advance: number;
  deduction: number;
  otherAdjustment: number;
  netSalary: number;
  paymentDate?: string;
  paymentModeKey?: string;
  remarks?: string;
  statusKey: string;
}

/* ── Expenses ── */
export interface Expense {
  expenseId: string;
  expenseNumber: string;
  expenseDate: string;
  categoryId: string;
  categoryName?: string;
  description: string;
  amount: number;
  vendorId?: string;
  vendorName?: string;
  payeeName?: string;
  paymentModeKey: string;
  paidBy?: string;
  referenceNumber?: string;
  remarks?: string;
  attachmentRef?: FileRef;
  statusKey: string;
  createdBy: string;
}

/* ── Config Entities ── */
export interface ConfigEntity {
  entityKey: string;
  label: string;
  idColumn: string;
  fields: ConfigEntityField[];
  permissions: { read: string; write: string };
  searchable: boolean;
  archiveable: boolean;
}

export interface ConfigEntityField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'textarea';
  required: boolean;
  options?: SelectOption[];
  optionsFrom?: string;
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
}

/* ── Dashboard ── */
export interface DashboardSummary {
  flatsMembers: { totalFlats: number; totalMembers: number; occupied: number; vacant: number };
  finance: { totalDemand: number; totalCollection: number; totalOutstanding: number; overdueAmount: number };
  counts: { paidMembers: number; partialMembers: number; pendingMembers: number };
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

/* ── Backup & Audit ── */
export type BackupScope = 'FULL' | 'CONFIG' | 'FINANCE' | 'OPERATIONS';

export interface Backup {
  backupId: string;
  scope: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
  checksum: string;
  rowCount: number;
  fileRefs: FileRef[];
}

export interface AuditEntry {
  auditId: string;
  entity: string;
  entityId: string;
  action: string;
  actorUserId: string;
  actorName?: string;
  timestamp: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface ArchiveEntry {
  archiveId: string;
  originalEntity: string;
  originalId: string;
  archivedAt: string;
  reason?: string;
}
