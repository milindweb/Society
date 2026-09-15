/* reportService.ts — FE-12 Reports
 *
 * Contract verified against `backend/src/ReportService.gs` and
 * `backend/src/Routes.gs:1012-1031` BEFORE this file was written. Three things
 * in the previous version of this file were wrong and are corrected here:
 *
 *  1. `reports.catalog` returns an **object keyed by reportKey**, not an array.
 *  2. `reports.run` returns `{ ok, data: {reportKey,title,rows,totals}, page }`
 *     — the page meta is a **sibling of `data`**, not nested inside it. The old
 *     `PaginatedResponse<Record<string, unknown>>` return type was therefore
 *     structurally wrong and would have read `undefined` for `rows`.
 *  3. `reports.run` requires `reportKey`. `reports.export` requires `reportKey`,
 *     `format` **and** `clientRequestId` (`Routes.gs:1028`).
 *
 * Permissions: `reports.read` for catalog/run, `reports.export` for export —
 * two DIFFERENT keys. A user may hold read without export.
 */

import { apiClient } from './apiClient';
import { generateClientId } from '@/lib/idempotency';
import type { PaginationParams } from '@/types/api';
import type {
  ReportCatalog,
  ReportExportResult,
  ReportResult,
  ReportTotals,
} from '@/types/domain';

/** Report keys are fetched from the catalog at runtime, not hardcoded. */
export type ReportKey = string;

/** Export formats accepted by `reports.export`.
 * The backend only produces CSV regardless of the value. */
export type ExportFormat = string;

export function isReportKey(_value: string): _value is ReportKey {
  return true;
}

/** The report catalog, keyed by reportKey. */
export async function getReportCatalog(): Promise<ReportCatalog> {
  return apiClient<ReportCatalog>({ action: 'reports.catalog' });
}

/** Filters are `periodKey`, `financialYear`, `from`, `to`, `paymentModeKey`,
 *  `categoryId`, `flatId` — which of them apply depends on the report. Only
 *  send keys the report declares, since `run` forwards them straight into the
 *  sheet read filter. */
export type ReportFilters = Record<string, string>;

export interface RunReportParams extends PaginationParams {
  reportKey: string;
  filters?: ReportFilters;
}

/** Run a report.
 *
 * `totals` is computed server-side over **all filtered rows**, not the current
 * page (`computeTotals` is called with the unpaginated `rows`). Never
 * recompute it from `rows` on the client — it would show page-only sums.
 */
export async function runReport(params: RunReportParams): Promise<ReportResult> {
  const { reportKey, filters, ...rest } = params;
  const payload: Record<string, unknown> = { reportKey };
  if (filters && Object.keys(filters).length > 0) payload.filters = filters;
  if (rest.page !== undefined) payload.page = rest.page;
  if (rest.pageSize !== undefined) payload.pageSize = rest.pageSize;

  return apiClient<ReportResult>({ action: 'reports.run', payload });
}

export interface ExportReportParams {
  reportKey: string;
  filters?: ReportFilters;
  format?: ExportFormat;
}

/** Export a report to CSV on Google Drive.
 *
 * The backend writes the file to Drive and returns a `fileUrl`; it does not
 * stream bytes. Open `fileUrl` to download. `clientRequestId` is required by the
 * route validator and also gives the export idempotency (the handler writes an
 * audit entry, so a double-submit should not produce two files).
 */
export async function exportReport(params: ExportReportParams): Promise<ReportExportResult> {
  const payload: Record<string, unknown> = {
    reportKey: params.reportKey,
    format: params.format ?? 'CSV',
    clientRequestId: generateClientId(),
  };
  if (params.filters && Object.keys(params.filters).length > 0) {
    payload.filters = params.filters;
  }

  return apiClient<ReportExportResult>({ action: 'reports.export', payload });
}

/* ---------------------------------------------------------------------------
 * Presentation helpers
 * ---------------------------------------------------------------------------
 * Labels and column metadata are NOT served by the backend: the catalog returns
 * bare column/filter keys. These helpers derive readable text from those keys so
 * every report renders sensibly without a per-report hardcoded table.
 * ------------------------------------------------------------------------- */

/** Turn a camelCase column/filter key into a readable label.
 *  `balanceAmount` -> `Balance Amount`, `paymentModeKey` -> `Payment Mode`. */
export function labelFromKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
  const words = spaced.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  // Trailing "Key"/"Id" columns are internal identifiers; the human value is the
  // name beside them, so drop the suffix only when something precedes it.
  const last = words[words.length - 1];
  if (words.length > 1 && (last === 'Key' || last === 'Id')) words.pop();
  return words.join(' ');
}

/** Columns that hold money. `run` projects them as STRINGS, so they are
 *  right-aligned and formatted rather than printed raw.
 *  Derived from column name patterns rather than a hardcoded list. */
export function isMoneyColumn(key: string): boolean {
  return /amount|price|cost|fee|charge|total|balance|paid|revenue|expense|salary|wage|bonus|deduction|advance|allowance|interest|fine|penalty/i.test(key);
}

/** Columns that hold a status key and should render through `StatusBadge`. */
export function isStatusColumn(key: string): boolean {
  return key === 'statusKey' || key.endsWith('StatusKey');
}

/** Columns holding a date/datetime. */
export function isDateColumn(key: string): boolean {
  return /(Date|At)$/.test(key) && !isMoneyColumn(key);
}

/** Formats `ReportTotals` into display rows, skipping absent fields.
 *
 * The shape varies by report family (see `ReportTotals`), so this drives a
 * generic totals strip without assuming which fields exist. */
export function describeTotals(
  totals: ReportTotals,
): { label: string; value: number; money: boolean }[] {
  const out: { label: string; value: number; money: boolean }[] = [];
  if (typeof totals.amount === 'number') out.push({ label: 'Amount', value: totals.amount, money: true });
  if (typeof totals.paid === 'number') out.push({ label: 'Paid', value: totals.paid, money: true });
  if (typeof totals.balance === 'number') out.push({ label: 'Balance', value: totals.balance, money: true });
  if (typeof totals.totalAmount === 'number') {
    out.push({ label: 'Total Amount', value: totals.totalAmount, money: true });
  }
  if (typeof totals.count === 'number') out.push({ label: 'Rows', value: totals.count, money: false });
  return out;
}

/** True when the backend supplies no numeric totals for this report
 *  (`complaint-summary` and `visitor-log` return `{}`). */
export function hasNoTotals(totals: ReportTotals): boolean {
  return Object.keys(totals).length === 0;
}
