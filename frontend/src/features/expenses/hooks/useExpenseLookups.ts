/* useExpenseLookups.ts — config-driven expense options (FE-11)
 * SRS §15: expense categories, payment modes and statuses are configuration data.
 * Nothing in this module is a literal.
 *
 * Sources, verified against backend/src/{ConfigService,SchemaMeta,Setup}.gs:
 *   expense categories -> `config.enums.categories.expense`
 *                         (ConfigService.gs:207, `{value: categoryId, label: categoryKey|categoryName}`)
 *   payment modes      -> `config.enums.paymentModes`
 *                         (ConfigService.gs:202, `{value: modeKey, label: modeName}`) —
 *                         the same source the payments and salary modules use, so a
 *                         mode means one thing across the app
 *   expense statuses   -> Status_Config domain **EXPENSE** = POSTED / CANCELLED
 *                         (Setup.gs:73) — matches ExpenseService.gs:128 exactly
 *   vendors            -> `config.entity.list('vendors')`
 *                         There is NO `vendors.*` API: `ExpenseService` exposes only
 *                         list/get/create/update/cancel/summary, so the vendor master
 *                         is read (never written) through the config entity route.
 *
 * Periods are generated from the clock rather than hardcoded, so the current month
 * is always offered and the list never goes stale. `periodKey` is `YYYY-MM` and is
 * only meaningful on `expenses.summary` — `expenses.list` does not accept it. */

import { useMemo } from 'react';
import { useStatusOptions, useEnumList, useEntityOptions } from '@/lib/useConfigOptions';
import type { SelectOption } from '@/types/domain';

/** Expense categories, from `config.enums.categories.expense`. */
export function useExpenseCategoryOptions(): { options: SelectOption[]; loading: boolean } {
  return useEnumList('categories', 'expense');
}

/** Payment modes, shared with the payments and salary modules. */
export function useExpensePaymentModeOptions(): { options: SelectOption[]; loading: boolean } {
  return useEnumList('paymentModes');
}

/** Expense statuses, from Status_Config domain **EXPENSE**. */
export function useExpenseStatusOptions(): { options: SelectOption[]; loading: boolean } {
  return useStatusOptions('EXPENSE');
}

/** Vendors, read from the config master (`Vendors` sheet, `Schema.gs:184`).
 *
 * Read-only on purpose: there is no vendor write route exposed to the frontend, so
 * this hook only ever lists. A vendor with no record is fine — `expenses.create`
 * accepts a free-text `payeeName` instead, and `expenses.summary` buckets those
 * under the synthetic `'DIRECT'` key. */
export function useExpenseVendorOptions(): {
  options: SelectOption[];
  loading: boolean;
  error: string | null;
} {
  return useEntityOptions('vendors', ['vendorId'], ['vendorName']);
}

/** `YYYY-MM` for a given month offset from now, in UTC. */
function periodKeyFor(offsetMonths: number, now: Date): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + offsetMonths;
  const date = new Date(Date.UTC(year, month, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Recent `YYYY-MM` period options, newest first. Derived from the clock rather
 * than a hardcoded list (SRS §15 in spirit: no literals). The label spells the
 * month out because "2026-09" is not how anyone reads it. */
export function useExpensePeriodOptions(monthsBack = 12): {
  options: SelectOption[];
  loading: boolean;
} {
  const options = useMemo(() => {
    const now = new Date();
    const list: SelectOption[] = [];
    for (let offset = 0; offset > -monthsBack; offset -= 1) {
      const value = periodKeyFor(offset, now);
      const [yearPart, monthPart] = value.split('-');
      const date = new Date(Date.UTC(Number(yearPart), Number(monthPart) - 1, 1));
      const label = date.toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
      list.push({ value, label });
    }
    return list;
  }, [monthsBack]);

  return { options, loading: false };
}
