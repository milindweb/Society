/* expenseService.ts — FE-11 society expenses (SRS §13)
 * Verified against backend/src/{ExpenseService,Routes,Schema,Setup}.gs.
 *
 * Server-enforced rules the UI must respect:
 *
 * - `expenses.create` requires expenseDate + categoryId + description + amount +
 *   paymentModeKey (`Routes.gs:954-966`). `vendorId`, `payeeName`,
 *   `referenceNumber`, `remarks`, `attachmentRef` and `periodKey` are optional.
 * - The server OWNS `expenseNumber` (from `Numbering_Config`), `statusKey`
 *   (always POSTED on create), `paidBy` (defaults to the caller) and the whole
 *   cancellation trio. None of them is accepted from the client.
 * - `expenses.update` patches ONLY this allow-list (`ExpenseService.gs:155`):
 *   expenseDate, categoryId, description, vendorId, payeeName, amount,
 *   paymentModeKey, referenceNumber, remarks, attachmentRef.
 *   `periodKey`, `expenseNumber` and `statusKey` are NOT patchable. The service
 *   **refuses a CANCELLED row** with `VALIDATION_ERROR` ("Cannot update a
 *   cancelled expense.").
 * - `expenses.cancel` requires a `reason` and **refuses an already-cancelled row**
 *   ("Expense is already cancelled."). There is no un-cancel route.
 * - `expenses.list` filters on `categoryId`, `vendorId` and `statusKey` on the
 *   server; `from` / `to` are applied in memory against `expenseDate`
 *   (`ExpenseService.gs:86-87`). There is **no search**, and **no `periodKey`
 *   filter on `list`** — only on `summary`.
 * - `expenses.get` returns the **raw row**. There is no join, so there is no
 *   `categoryName` / `vendorName` / `createdBy` to read.
 * - `expenses.summary` counts **POSTED rows only** (`ExpenseService.gs:218`) and
 *   returns `{ total, totalAmount, byCategory, byVendor, byMonth }`. It inserts two
 *   synthetic keys, `'UNCATEGORIZED'` and `'DIRECT'`, for rows with no id.
 *
 * ⚠️ `amount` is a STRING on the sheet (`ExpenseService.gs:122`). It is sent as a
 * string and parsed only for display. No amount is ever computed on the client
 * (SRS §8/§23).
 *
 * ⚠️ `attachmentRef` is a **JSON string**, not an object — parse with
 * `parseFileRef()`. This service does not upload: SRS §9 keeps one central
 * document store, so a document is uploaded there and referenced here by its
 * serialised ref.
 *
 * Permission keys `expenses.read` / `expenses.write` are both present in the
 * `Setup.gs:187-188` seed — verified, unlike the FE-10 HR routes which were not. */

import { apiClient } from './apiClient';
import { generateClientId } from '@/lib/idempotency';
import type { Expense, ExpenseSummary } from '@/types/domain';
import type { Paginated, PaginationParams } from '@/types/api';

/* ── Read ───────────────────────────────────────────────────────────────── */

/** `expenses.list` — the filters the service actually implements. */
export interface ExpenseFilters extends PaginationParams {
  categoryId?: string;
  vendorId?: string;
  statusKey?: string;
  /** Inclusive `YYYY-MM-DD` bounds, applied in memory against `expenseDate`. */
  from?: string;
  to?: string;
}

export async function listExpenses(params: ExpenseFilters): Promise<Paginated<Expense>> {
  return apiClient<Paginated<Expense>>({ action: 'expenses.list', payload: params });
}

/** The raw row. There is no join, so category and vendor names come from config. */
export async function getExpense(expenseId: string): Promise<Expense> {
  return apiClient<Expense>({ action: 'expenses.get', payload: { expenseId } });
}

/* ── Write ──────────────────────────────────────────────────────────────── */

/** The fields `expenses.create` accepts. The first five are required by the route
 * validator. `expenseNumber`, `statusKey` and `paidBy` are server-owned. */
export interface CreateExpenseInput {
  expenseDate: string;
  categoryId: string;
  description: string;
  /** Sent as a string; the server coerces through `Utils.toNumber`. */
  amount: string;
  paymentModeKey: string;
  /** Optional; defaults to the current period server-side. */
  periodKey?: string;
  vendorId?: string;
  payeeName?: string;
  referenceNumber?: string;
  /** A JSON string produced by `JSON.stringify` of a `DocumentFileRef`. */
  attachmentRef?: string;
  remarks?: string;
}

export async function createExpense(data: CreateExpenseInput): Promise<Expense> {
  return apiClient<Expense>({
    action: 'expenses.create',
    payload: { ...data, clientRequestId: generateClientId() },
  });
}

/** The exact patchable surface (`ExpenseService.gs:155`). `periodKey`,
 * `expenseNumber` and `statusKey` are deliberately absent — the server ignores
 * them, so offering a control for them would imply otherwise. */
export interface UpdateExpenseInput {
  expenseId: string;
  expenseDate?: string;
  categoryId?: string;
  description?: string;
  amount?: string;
  vendorId?: string;
  payeeName?: string;
  paymentModeKey?: string;
  referenceNumber?: string;
  attachmentRef?: string;
  remarks?: string;
}

/** Refused with `VALIDATION_ERROR` when the row is CANCELLED. */
export async function updateExpense(data: UpdateExpenseInput): Promise<Expense> {
  return apiClient<Expense>({
    action: 'expenses.update',
    payload: { ...data, clientRequestId: generateClientId() },
  });
}

/** Cancellation is not a delete: it sets `statusKey` CANCELLED and stamps
 * `cancelledAt` / `cancelledBy` / `cancelReason`. The reason is required by both
 * the route validator and the service. */
export async function cancelExpense(expenseId: string, reason: string): Promise<Expense> {
  return apiClient<Expense>({
    action: 'expenses.cancel',
    payload: { expenseId, reason, clientRequestId: generateClientId() },
  });
}

/* ── Summary ────────────────────────────────────────────────────────────── */

export interface ExpenseSummaryFilters {
  /** `YYYY-MM`. Only `summary` supports this — `list` does not. */
  periodKey?: string;
  from?: string;
  to?: string;
  categoryId?: string;
  vendorId?: string;
}

/** POSTED expenses only, by construction (`ExpenseService.gs:218`). */
export async function expenseSummary(
  params: ExpenseSummaryFilters = {},
): Promise<ExpenseSummary> {
  return apiClient<ExpenseSummary>({ action: 'expenses.summary', payload: params });
}

/* ── Mirrors of the service's own rules ─────────────────────────────────── */

/** Statuses the EXPENSE domain can hold (`Setup.gs:73`).
 * Also available config-driven via `useStatusOptions('EXPENSE')`; declared here so
 * service-level logic can mirror the server without reaching for a hook. */
export const EXPENSE_STATUSES = ['POSTED', 'CANCELLED'] as const;

/** The sentinel keys `expenses.summary` inserts for rows with no id
 * (`ExpenseService.gs:236-240`). The UI maps these to readable labels rather than
 * displaying them raw. */
export const UNCATEGORIZED_KEY = 'UNCATEGORIZED';
export const DIRECT_VENDOR_KEY = 'DIRECT';

/** `expenses.update` refuses a CANCELLED row. */
export function canEditExpense(statusKey: string): boolean {
  return statusKey !== 'CANCELLED';
}

/** `expenses.cancel` refuses a row that is already cancelled. */
export function canCancelExpense(statusKey: string): boolean {
  return statusKey !== 'CANCELLED';
}

/** A cancellation is terminal — there is no un-cancel route. */
export function isCancelledExpense(statusKey: string): boolean {
  return statusKey === 'CANCELLED';
}

/** True when the server answered `VALIDATION_ERROR` because the expense was
 * already cancelled. Lets the UI explain a race (two users cancelling at once)
 * instead of showing a bare failure. */
export function isAlreadyCancelledMessage(message?: string | null): boolean {
  return Boolean(message && /already cancelled/i.test(message));
}
