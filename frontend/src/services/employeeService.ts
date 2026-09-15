/* employeeService.ts — FE-10 employees, attendance and salary (SRS §11, §12)
 * Verified against backend/src/{HRService,Routes,Schema,Setup}.gs.
 *
 * One service for all three HR concerns, because the backend keeps them in one
 * service (`HRService.gs`) behind one permission family per concern. Splitting
 * them into three files would only mirror the server's file layout, not its
 * behaviour, and the three share the employee lookups anyway.
 *
 * Server-enforced rules the UI must respect:
 *
 * EMPLOYEES
 * - `employees.create` requires fullName + employeeTypeId + joinDate. `employeeCode`
 *   is optional: when omitted the server generates `EMP0001`-style. Supplying one
 *   that already exists answers `CONFLICT_ERROR`.
 * - `employees.update` patches ONLY this allow-list (HRService.gs:182):
 *   fullName, employeeTypeId, mobile, altMobile, email, address, monthlySalary,
 *   bankName, bankAccount, ifsc, emergencyName, emergencyMobile, idProofType,
 *   idProofNumber, notes, statusKey. `joinDate` and `employeeCode` are NOT
 *   patchable — sending them is silently ignored.
 * - `employees.archive` requires a `reason` and sets statusKey ARCHIVED + stamps
 *   `exitDate` (today). There is no un-archive route.
 * - `employees.list` filters on employeeTypeId + statusKey ONLY. No search.
 * - `employees.get` returns a COMPOSITE `{ employee, recentAttendance, salaryHistory }`.
 *
 * ATTENDANCE
 * - `attendance.mark` takes a `rows` ARRAY and upserts one row per
 *   (employeeId, attendanceDate). Unlike `meetings.attendance.mark` it is
 *   per-employee and NON-destructive, so submitting a single row is safe.
 * - Rows missing employeeId / attendanceDate / statusKey are SKIPPED silently, and
 *   so is any statusKey outside PRESENT/ABSENT/LEAVE/HALF_DAY/HOLIDAY. The UI
 *   validates first so the user is never told "marked 3" when 1 was dropped.
 * - It returns `{ marked, newlyCreated }` — NOT the rows.
 * - `attendance.list` DOES support `from` / `to` date filters and employeeId /
 *   statusKey.
 * - `attendance.summary` returns a map keyed by employeeId; it accepts
 *   employeeId / from / to / periodKey.
 *
 * SALARY
 * - `salary.prepare` requires periodKey, creates one row per ACTIVE employee and
 *   SKIPS an employee who already has a row for that period (idempotent). It
 *   returns `{ periodKey, created, rows }`. Optional `employeeIds` narrows the
 *   run; optional `overrides[employeeId]` carries allowanceAmount /
 *   advanceDeduction / otherDeduction.
 * - The server computes `netSalary` (HRService.computeNetSalary). The client must
 *   NEVER recompute or adjust it (SRS §8/§23) — only display it.
 * - `salary.update` patches only overtimeHours, allowanceAmount, advanceDeduction,
 *   otherDeduction, bonusAmount, otherAdjustment, remarks, and REFUSES a row whose
 *   statusKey is not DRAFT ("Only DRAFT salary can be updated.").
 * - `salary.approve` refuses a non-DRAFT row, and refuses SELF-approval when the
 *   caller's user has that employeeId (`FORBIDDEN`, "Self-approval is not
 *   allowed."). Both messages are surfaced verbatim.
 * - `salary.pay` requires paymentDate + paymentModeKey and refuses a row that is
 *   not APPROVED.
 * - `salary.list` filters on periodKey / employeeId / statusKey.
 * - `salary.get` returns a composite `{ salary, employee, attendanceBreakdown }`.
 *
 * ⚠️ Every numeric HR column is a STRING on the sheet (Schema.gs:266-274). They
 * are passed through as strings and parsed only for display. */

import { apiClient } from './apiClient';
import { generateClientId } from '@/lib/idempotency';
import type {
  Employee,
  EmployeeAttendance,
  EmployeeDetail,
  EmployeeSalary,
  SalaryDetail,
  SalaryPrepareResult,
  AttendanceMarkResult,
  AttendanceSummaryMap,
} from '@/types/domain';
import type { Paginated, PaginationParams } from '@/types/api';

/* ── Employees ──────────────────────────────────────────────────────────── */

export interface EmployeeFilters extends PaginationParams {
  employeeTypeId?: string;
  statusKey?: string;
}

export async function listEmployees(params: EmployeeFilters): Promise<Paginated<Employee>> {
  return apiClient<Paginated<Employee>>({ action: 'employees.list', payload: params });
}

/** The composite: employee + recent attendance + salary history. */
export async function getEmployee(employeeId: string): Promise<EmployeeDetail> {
  return apiClient<EmployeeDetail>({ action: 'employees.get', payload: { employeeId } });
}

/** The fields `employees.create` accepts. Only the first three are required. */
export interface CreateEmployeeInput {
  fullName: string;
  employeeTypeId: string;
  joinDate: string;
  /** Optional — the server generates `EMP0001`-style when omitted. */
  employeeCode?: string;
  mobile?: string;
  altMobile?: string;
  email?: string;
  address?: string;
  /** Sent as a string; the server coerces through Utils.toNumber. */
  monthlySalary?: string;
  bankName?: string;
  bankAccount?: string;
  ifsc?: string;
  emergencyName?: string;
  emergencyMobile?: string;
  idProofType?: string;
  idProofNumber?: string;
  notes?: string;
}

export async function createEmployee(data: CreateEmployeeInput): Promise<Employee> {
  return apiClient<Employee>({
    action: 'employees.create',
    payload: { ...data, clientRequestId: generateClientId() },
  });
}

/** The exact patchable surface (HRService.gs:182). `joinDate` and `employeeCode`
 * are deliberately absent — the server ignores them. */
export interface UpdateEmployeeInput {
  employeeId: string;
  fullName?: string;
  employeeTypeId?: string;
  mobile?: string;
  altMobile?: string;
  email?: string;
  address?: string;
  monthlySalary?: string;
  bankName?: string;
  bankAccount?: string;
  ifsc?: string;
  emergencyName?: string;
  emergencyMobile?: string;
  idProofType?: string;
  idProofNumber?: string;
  notes?: string;
  statusKey?: string;
}

export async function updateEmployee(data: UpdateEmployeeInput): Promise<Employee> {
  return apiClient<Employee>({
    action: 'employees.update',
    payload: { ...data, clientRequestId: generateClientId() },
  });
}

/** Archive is not a delete: it sets statusKey ARCHIVED and stamps `exitDate`
 * with today's date. The reason is required by the route validator. */
export async function archiveEmployee(employeeId: string, reason: string): Promise<Employee> {
  return apiClient<Employee>({
    action: 'employees.archive',
    payload: { employeeId, reason, clientRequestId: generateClientId() },
  });
}

/* ── Attendance ─────────────────────────────────────────────────────────── */

export interface AttendanceFilters extends PaginationParams {
  employeeId?: string;
  statusKey?: string;
  /** Inclusive `YYYY-MM-DD` bounds — the service DOES filter on these. */
  from?: string;
  to?: string;
}

export async function listAttendance(
  params: AttendanceFilters,
): Promise<Paginated<EmployeeAttendance>> {
  return apiClient<Paginated<EmployeeAttendance>>({ action: 'attendance.list', payload: params });
}

/** One row of an `attendance.mark` submission. */
export interface AttendanceMarkRow {
  employeeId: string;
  /** `YYYY-MM-DD`. */
  attendanceDate: string;
  statusKey: string;
  inTime?: string;
  outTime?: string;
  /** String, and only honoured on CREATE — the update path drops it. */
  workedHours?: string;
  overtimeHours?: string;
  remarks?: string;
}

/** Marks (upserts) attendance. Safe to call with one row for one employee, and
 * with a whole register at once — the upsert key is employeeId + attendanceDate.
 * The response is a COUNT, not the rows. */
export async function markAttendance(rows: AttendanceMarkRow[]): Promise<AttendanceMarkResult> {
  return apiClient<AttendanceMarkResult>({
    action: 'attendance.mark',
    payload: { rows, clientRequestId: generateClientId() },
  });
}

export interface AttendanceSummaryFilters {
  employeeId?: string;
  from?: string;
  to?: string;
  /** `YYYY-MM` — filters on the attendanceDate prefix. */
  periodKey?: string;
}

/** Per-employee counts, keyed by employeeId. */
export async function getAttendanceSummary(
  params: AttendanceSummaryFilters = {},
): Promise<AttendanceSummaryMap> {
  return apiClient<AttendanceSummaryMap>({ action: 'attendance.summary', payload: params });
}

/* ── Salary ─────────────────────────────────────────────────────────────── */

export interface SalaryFilters extends PaginationParams {
  periodKey?: string;
  employeeId?: string;
  statusKey?: string;
}

export async function listSalary(params: SalaryFilters): Promise<Paginated<EmployeeSalary>> {
  return apiClient<Paginated<EmployeeSalary>>({ action: 'salary.list', payload: params });
}

/** The composite: salary + employee + that period's attendance rows. */
export async function getSalary(salaryId: string): Promise<SalaryDetail> {
  return apiClient<SalaryDetail>({ action: 'salary.get', payload: { salaryId } });
}

/** The three per-employee amounts a prepare run may override. */
export interface SalaryOverride {
  allowanceAmount?: string;
  advanceDeduction?: string;
  otherDeduction?: string;
}

export interface PrepareSalaryInput {
  /** `YYYY-MM`. */
  periodKey: string;
  /** Narrows the run. Omit to prepare every ACTIVE employee. */
  employeeIds?: string[];
  /** Keyed by employeeId. */
  overrides?: Record<string, SalaryOverride>;
}

/** Creates the month's DRAFT rows. Idempotent per employee + period: an employee
 * who already has a row for the period is skipped, so a second run reports a
 * lower `created` rather than duplicating. */
export async function prepareSalary(data: PrepareSalaryInput): Promise<SalaryPrepareResult> {
  return apiClient<SalaryPrepareResult>({
    action: 'salary.prepare',
    payload: { ...data, clientRequestId: generateClientId() },
  });
}

/** The exact patchable surface (HRService.gs:503). The server recomputes
 * `netSalary` from these; we never send a net figure. */
export interface UpdateSalaryInput {
  salaryId: string;
  overtimeHours?: string;
  allowanceAmount?: string;
  advanceDeduction?: string;
  otherDeduction?: string;
  bonusAmount?: string;
  otherAdjustment?: string;
  remarks?: string;
}

/** Refused unless the row is DRAFT. */
export async function updateSalary(data: UpdateSalaryInput): Promise<EmployeeSalary> {
  return apiClient<EmployeeSalary>({
    action: 'salary.update',
    payload: { ...data, clientRequestId: generateClientId() },
  });
}

/** DRAFT → APPROVED. The service refuses a non-DRAFT row and refuses self-approval
 * when the caller's user is linked to that employee (`FORBIDDEN`). */
export async function approveSalary(salaryId: string): Promise<EmployeeSalary> {
  return apiClient<EmployeeSalary>({
    action: 'salary.approve',
    payload: { salaryId, clientRequestId: generateClientId() },
  });
}

export interface PaySalaryInput {
  salaryId: string;
  /** Required by the route validator. */
  paymentDate: string;
  /** Required by the route validator. */
  paymentModeKey: string;
  referenceNumber?: string;
  remarks?: string;
}

/** APPROVED → PAID. Refused unless the row is APPROVED. */
export async function paySalary(data: PaySalaryInput): Promise<EmployeeSalary> {
  return apiClient<EmployeeSalary>({
    action: 'salary.pay',
    payload: { ...data, clientRequestId: generateClientId() },
  });
}

/* ── Mirrors of the service's own rules ─────────────────────────────────── */

/* The three composite/ack types are declared in `types/domain.ts` alongside the
 * entities they wrap. They are re-exported here so callers can reach every HR
 * type through one namespace (`employeeService.*`), which is the pattern the
 * other FE-10 hooks use. */
export type {
  AttendanceMarkResult,
  AttendanceSummaryMap,
  SalaryPrepareResult,
} from '@/types/domain';

/** Attendance statuses the server will accept (`HRService.gs:15`).
 * Also available config-driven via `useStatusOptions('ATTENDANCE')`; declared
 * here only so service-level validation can mirror the server without a hook. */
export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY', 'HOLIDAY'] as const;

/** Salary statuses (`HRService.gs:16`). */
export const SALARY_STATUSES = ['DRAFT', 'APPROVED', 'PAID', 'CANCELLED'] as const;

/** `salary.update` refuses anything that is not DRAFT. */
export function canEditSalary(statusKey: string): boolean {
  return statusKey === 'DRAFT';
}

/** `salary.approve` refuses anything that is not DRAFT. */
export function canApproveSalary(statusKey: string): boolean {
  return statusKey === 'DRAFT';
}

/** `salary.pay` refuses anything that is not APPROVED. */
export function canPaySalary(statusKey: string): boolean {
  return statusKey === 'APPROVED';
}

/** Attendance that counts as a worked day. HALF_DAY counts as half, which is why
 * this is not a boolean. Used only for display of the breakdown — the server
 * owns the salary arithmetic. */
export function attendanceDayValue(statusKey: string): number {
  if (statusKey === 'PRESENT') return 1;
  if (statusKey === 'HALF_DAY') return 0.5;
  return 0;
}
