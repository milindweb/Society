/* useSalary.ts — FE-10 salary run data access
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 * SRS §12: monthly salary prepared from attendance, approved, then paid.
 *
 * Contract notes (verified against HRService.gs:356-582):
 * - `salary.list` filters on periodKey / employeeId / statusKey.
 * - `salary.prepare` requires periodKey, creates one DRAFT row per ACTIVE
 *   employee and SKIPS anyone who already has a row for that period. It answers
 *   `{ periodKey, created, rows }` — a summary, not the full list. A second run in
 *   the same month therefore reports a smaller `created`; that is the idempotency
 *   working, and the UI says so rather than treating it as a failure.
 * - `salary.update` refuses any row that is not DRAFT.
 * - `salary.approve` refuses a non-DRAFT row AND refuses SELF-approval when the
 *   caller's user is linked to that employee (FORBIDDEN, "Self-approval is not
 *   allowed."). Both messages are surfaced verbatim.
 * - `salary.pay` refuses a row that is not APPROVED.
 * - `netSalary` is server-computed. Nothing in this hook recomputes it
 *   (SRS §8/§23) — a failed write reloads and shows the server's figure.
 *
 * Every mutation returns a boolean, because a refusal (a non-DRAFT row, a
 * self-approval, a validation error) must keep the caller's dialog open with the
 * server's message rather than closing on a lie. */

import { useState, useCallback, useEffect } from 'react';
import * as employeeService from '@/services/employeeService';
import type { EmployeeSalary, SalaryDetail } from '@/types/domain';
import type { PageMeta } from '@/types/api';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

const PAGE_SIZE = 50;

export interface SalaryFilterState {
  periodKey?: string;
  employeeId?: string;
  statusKey?: string;
}

export interface UseSalaryListReturn {
  salaries: EmployeeSalary[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  setFilters: (next: Partial<SalaryFilterState>) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
}

export function useSalaryList(initial?: SalaryFilterState): UseSalaryListReturn {
  const [salaries, setSalaries] = useState<EmployeeSalary[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<SalaryFilterState>(initial ?? {});
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await employeeService.listSalary({
        page: pageNumber,
        pageSize: PAGE_SIZE,
        periodKey: filters.periodKey || undefined,
        employeeId: filters.employeeId || undefined,
        statusKey: filters.statusKey || undefined,
      });
      setSalaries(result.items);
      setPageState(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load salary records');
    } finally {
      setLoading(false);
    }
  }, [pageNumber, filters.periodKey, filters.employeeId, filters.statusKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: Partial<SalaryFilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
    setPageNumber(1);
  }, []);

  return {
    salaries,
    page,
    loading,
    error,
    setFilters,
    setPage: setPageNumber,
    reload: load,
  };
}

export interface UseSalaryReturn {
  detail: SalaryDetail | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  reload: () => Promise<void>;
  update: (input: Omit<employeeService.UpdateSalaryInput, 'salaryId'>) => Promise<boolean>;
  approve: () => Promise<boolean>;
  pay: (input: Omit<employeeService.PaySalaryInput, 'salaryId'>) => Promise<boolean>;
}

/** One salary row with its employee and that period's attendance attached. */
export function useSalary(salaryId?: string): UseSalaryReturn {
  const [detail, setDetail] = useState<SalaryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!salaryId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDetail(await employeeService.getSalary(salaryId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the salary record');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [salaryId]);

  useEffect(() => {
    void load();
  }, [load]);

  /* Shared body for the three writes: all reload afterwards, so the status and the
   * server-computed net amount shown are the persisted ones. */
  const runWrite = useCallback(
    async (operation: () => Promise<unknown>, fallbackMessage: string) => {
      setBusy(true);
      setError(null);
      try {
        await operation();
        await load();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : fallbackMessage);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const update = useCallback(
    (input: Omit<employeeService.UpdateSalaryInput, 'salaryId'>) => {
      if (!salaryId) return Promise.resolve(false);
      return runWrite(
        () => employeeService.updateSalary({ ...input, salaryId }),
        'Could not update the salary record',
      );
    },
    [salaryId, runWrite],
  );

  const approve = useCallback(() => {
    if (!salaryId) return Promise.resolve(false);
    return runWrite(
      () => employeeService.approveSalary(salaryId),
      'Could not approve the salary record',
    );
  }, [salaryId, runWrite]);

  const pay = useCallback(
    (input: Omit<employeeService.PaySalaryInput, 'salaryId'>) => {
      if (!salaryId) return Promise.resolve(false);
      return runWrite(
        () => employeeService.paySalary({ ...input, salaryId }),
        'Could not record the salary payment',
      );
    },
    [salaryId, runWrite],
  );

  return { detail, loading, error, busy, reload: load, update, approve, pay };
}

export interface UsePrepareSalaryReturn {
  preparing: boolean;
  error: string | null;
  result: employeeService.SalaryPrepareResult | null;
  prepare: (input: employeeService.PrepareSalaryInput) => Promise<employeeService.SalaryPrepareResult | null>;
  reset: () => void;
}

/** Runs (or re-runs) a month's salary preparation. Idempotent per employee+period. */
export function usePrepareSalary(): UsePrepareSalaryReturn {
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<employeeService.SalaryPrepareResult | null>(null);

  const prepare = useCallback(async (input: employeeService.PrepareSalaryInput) => {
    setPreparing(true);
    setError(null);
    setResult(null);
    try {
      const response = await employeeService.prepareSalary(input);
      setResult(response);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare the salary run');
      return null;
    } finally {
      setPreparing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return { preparing, error, result, prepare, reset };
}
