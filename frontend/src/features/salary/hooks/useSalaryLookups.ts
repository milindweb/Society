/* useSalaryLookups.ts — config-driven salary options (FE-10)
 * SRS §15: salary statuses and payment modes are configuration data.
 *
 * Sources, verified against backend/src/{ConfigService,Setup}.gs:
 *   salary status -> Status_Config domain SALARY = DRAFT / APPROVED / PAID / CANCELLED
 *                    (`Setup.gs:71`) — matches HRService.gs:16 exactly
 *   payment modes -> `config.enums.paymentModes` (ConfigService.gs:202,
 *                    `{value: modeKey, label: modeName}`)
 *
 * Period options are generated, not hardcoded: a periodKey is just `YYYY-MM`, and
 * the list is derived from the clock so the current month is always offered. */

import { useMemo } from 'react';
import { useStatusOptions, useEnumList } from '@/lib/useConfigOptions';
import type { SelectOption } from '@/types/domain';

/** Salary statuses, from Status_Config domain **SALARY**. */
export function useSalaryStatusOptions(): { options: SelectOption[]; loading: boolean } {
  return useStatusOptions('SALARY');
}

/** Payment modes, from `config.enums.paymentModes` (shared with the payments
 * module — same source, same meaning). */
export function usePaymentModeOptions(): { options: SelectOption[]; loading: boolean } {
  return useEnumList('paymentModes');
}

/** `YYYY-MM` for a given month offset from now, in UTC. */
function periodKeyFor(offsetMonths: number, now: Date): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + offsetMonths;
  const date = new Date(Date.UTC(year, month, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Recent `YYYY-MM` period options, newest first. Derived from the clock rather
 * than a hardcoded list, so it never goes stale (SRS §15 in spirit: no literals).
 * The label spells the month out because "2026-09" is not how anyone reads it. */
export function usePeriodOptions(monthsBack = 12): { options: SelectOption[]; loading: boolean } {
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
