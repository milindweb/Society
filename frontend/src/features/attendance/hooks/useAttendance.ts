/* useAttendance.ts — FE-10 attendance register data access
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 * SRS §12: daily attendance per employee, and the hours that feed salary.
 *
 * Contract notes (verified against HRService.gs:229-333):
 * - `attendance.list` supports employeeId, statusKey and — unusually for this
 *   codebase — real `from` / `to` DATE bounds. They are honoured here.
 * - `attendance.mark` takes an ARRAY of rows and UPSERTS on
 *   (employeeId, attendanceDate). Unlike `meetings.attendance.mark` it is NOT
 *   destructive: marking one employee does not clear the others. So the register
 *   can submit the whole day at once, and a single-row save is also safe.
 * - It answers with counts, not rows: `{ marked, newlyCreated }`. A row missing
 *   employeeId/attendanceDate/statusKey, or carrying an unknown statusKey, is
 *   SKIPPED SILENTLY — hence the client-side validation before submitting, so the
 *   user is never told "5 marked" when 3 were dropped.
 * - `attendance.summary` returns a map keyed by employeeId and accepts
 *   employeeId / from / to / periodKey.
 *
 * No optimistic UI (SRS §23): after a mark, the register reloads from the server
 * so the displayed times and statuses are the persisted ones. */

import { useState, useCallback, useEffect } from 'react';
import * as employeeService from '@/services/employeeService';
import type { EmployeeAttendance, AttendanceSummaryMap } from '@/types/domain';
import type { PageMeta } from '@/types/api';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

const PAGE_SIZE = 50;

export interface AttendanceFilterState {
  employeeId?: string;
  statusKey?: string;
  from?: string;
  to?: string;
}

export interface UseAttendanceListReturn {
  rows: EmployeeAttendance[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  setFilters: (next: Partial<AttendanceFilterState>) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
}

export function useAttendanceList(initial?: AttendanceFilterState): UseAttendanceListReturn {
  const [rows, setRows] = useState<EmployeeAttendance[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<AttendanceFilterState>(initial ?? {});
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await employeeService.listAttendance({
        page: pageNumber,
        pageSize: PAGE_SIZE,
        employeeId: filters.employeeId || undefined,
        statusKey: filters.statusKey || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      });
      setRows(result.items);
      setPageState(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [pageNumber, filters.employeeId, filters.statusKey, filters.from, filters.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: Partial<AttendanceFilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
    setPageNumber(1);
  }, []);

  return {
    rows,
    page,
    loading,
    error,
    setFilters,
    setPage: setPageNumber,
    reload: load,
  };
}

export interface UseAttendanceSummaryReturn {
  summary: AttendanceSummaryMap;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Per-employee day counts for a window (or one month via `periodKey`). */
export function useAttendanceSummary(filters: employeeService.AttendanceSummaryFilters = {}): UseAttendanceSummaryReturn {
  const [summary, setSummary] = useState<AttendanceSummaryMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { employeeId, from, to, periodKey } = filters;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(
        await employeeService.getAttendanceSummary({
          employeeId: employeeId || undefined,
          from: from || undefined,
          to: to || undefined,
          periodKey: periodKey || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the attendance summary');
      setSummary({});
    } finally {
      setLoading(false);
    }
  }, [employeeId, from, to, periodKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return { summary, loading, error, reload: load };
}

export interface UseMarkAttendanceReturn {
  marking: boolean;
  error: string | null;
  /** The counts the server acknowledged, so the UI can report exactly what
   * happened rather than assuming. */
  result: employeeService.AttendanceMarkResult | null;
  mark: (rows: employeeService.AttendanceMarkRow[]) => Promise<employeeService.AttendanceMarkResult | null>;
  reset: () => void;
}

/** Submits attendance. `mark` can take one row or the whole register — the
 * server upserts per employee+date, so both are safe. */
export function useMarkAttendance(): UseMarkAttendanceReturn {
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<employeeService.AttendanceMarkResult | null>(null);

  const mark = useCallback(async (rows: employeeService.AttendanceMarkRow[]) => {
    setMarking(true);
    setError(null);
    setResult(null);
    try {
      const response = await employeeService.markAttendance(rows);
      setResult(response);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark attendance');
      return null;
    } finally {
      setMarking(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return { marking, error, result, mark, reset };
}
