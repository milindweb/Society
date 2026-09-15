/* useEmployees.ts — FE-10 employee data access
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 * SRS §11: employee master with type, contact, bank and ID details, plus the
 * archive action.
 *
 * No optimistic UI (SRS §23): every write reloads from the server. That matters
 * here because `employees.archive` also stamps `exitDate`, and because the server
 * OWNS `employeeCode` (it generates one when the create omits it) — so the code
 * shown must be the persisted one, not a guess.
 *
 * `employees.list` supports employeeTypeId + statusKey ONLY (HRService.gs:90-109).
 * There is no server-side search, so this hook does not offer one. */

import { useState, useCallback, useEffect } from 'react';
import * as employeeService from '@/services/employeeService';
import type { Employee, EmployeeDetail } from '@/types/domain';
import type { PageMeta } from '@/types/api';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

/** Module constant, not state — keeps the load callback stable (see the
 * double-fetch note in the project memory). */
const PAGE_SIZE = 25;

export interface EmployeeFilterState {
  employeeTypeId?: string;
  statusKey?: string;
}

export interface UseEmployeeListReturn {
  employees: Employee[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  setFilters: (next: Partial<EmployeeFilterState>) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
}

export function useEmployeeList(initial?: EmployeeFilterState): UseEmployeeListReturn {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<EmployeeFilterState>(initial ?? {});
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await employeeService.listEmployees({
        page: pageNumber,
        pageSize: PAGE_SIZE,
        employeeTypeId: filters.employeeTypeId || undefined,
        statusKey: filters.statusKey || undefined,
      });
      setEmployees(result.items);
      setPageState(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [pageNumber, filters.employeeTypeId, filters.statusKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: Partial<EmployeeFilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
    setPageNumber(1);
  }, []);

  return {
    employees,
    page,
    loading,
    error,
    setFilters,
    setPage: setPageNumber,
    reload: load,
  };
}

/** Options for a select, sourced from the employee master itself. Used by the
 * attendance and salary screens, which need to pick an employee without pulling
 * the whole list again. */
export function useEmployeeOptions(): {
  options: { value: string; label: string }[];
  loading: boolean;
} {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    employeeService
      .listEmployees({ page: 1, pageSize: 100, statusKey: 'ACTIVE' })
      .then((result) => {
        if (cancelled) return;
        setOptions(
          (result.items ?? []).map((employee) => ({
            value: employee.employeeId,
            label: `${employee.fullName} (${employee.employeeCode})`,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { options, loading };
}

export interface UseEmployeeReturn {
  detail: EmployeeDetail | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  reload: () => Promise<void>;
  update: (input: Omit<employeeService.UpdateEmployeeInput, 'employeeId'>) => Promise<boolean>;
  archive: (reason: string) => Promise<boolean>;
}

/** One employee, with their recent attendance and salary history attached.
 *
 * `update` and `archive` return a boolean rather than throwing: the caller needs
 * to know whether to close its modal. A rejected write (a duplicate code, a
 * validation failure) must leave the dialog open with the server's message. */
export function useEmployee(employeeId?: string): UseEmployeeReturn {
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!employeeId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDetail(await employeeService.getEmployee(employeeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the employee');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    async (input: Omit<employeeService.UpdateEmployeeInput, 'employeeId'>) => {
      if (!employeeId) return false;
      setBusy(true);
      setError(null);
      try {
        await employeeService.updateEmployee({ ...input, employeeId });
        await load();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update the employee');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [employeeId, load],
  );

  const archive = useCallback(
    async (reason: string) => {
      if (!employeeId) return false;
      setBusy(true);
      setError(null);
      try {
        await employeeService.archiveEmployee(employeeId, reason);
        await load();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not archive the employee');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [employeeId, load],
  );

  return { detail, loading, error, busy, reload: load, update, archive };
}

export interface UseCreateEmployeeReturn {
  creating: boolean;
  error: string | null;
  created: Employee | null;
  create: (input: employeeService.CreateEmployeeInput) => Promise<Employee | null>;
  reset: () => void;
}

export function useCreateEmployee(): UseCreateEmployeeReturn {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Employee | null>(null);

  const create = useCallback(async (input: employeeService.CreateEmployeeInput) => {
    setCreating(true);
    setError(null);
    try {
      /* The service adds the clientRequestId itself — do not send a second one. */
      const result = await employeeService.createEmployee(input);
      setCreated(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the employee');
      return null;
    } finally {
      setCreating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setCreated(null);
  }, []);

  return { creating, error, created, create, reset };
}
