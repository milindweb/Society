/* useExpenses.ts — FE-11 expense data access
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 * SRS §13: society expenses — record, categorise, and cancel with a reason.
 *
 * Contract notes (verified against ExpenseService.gs:77-261):
 * - `expenses.list` filters on categoryId / vendorId / statusKey; `from` / `to`
 *   narrow `expenseDate` in memory. There is **no search** and **no periodKey
 *   filter on list**, so this hook offers neither.
 * - `expenses.get` returns the raw row — no join — so category and vendor names
 *   are resolved from config lookups at the page, not here.
 * - Every mutation returns a boolean, because a refusal (a cancelled row, a
 *   duplicate, a validation error) must keep the caller's dialog open with the
 *   server's own message rather than closing on a lie.
 *
 * No optimistic UI (SRS §23): every write reloads from the server. That matters
 * here because the server owns `expenseNumber` and `statusKey`, and because
 * `amount` is coerced through `Utils.toNumber` on the way in — the figure shown
 * after a save must be the persisted one, not the typed one. */

import { useState, useCallback, useEffect } from 'react';
import * as expenseService from '@/services/expenseService';
import type { Expense, ExpenseSummary } from '@/types/domain';
import type { PageMeta } from '@/types/api';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

/** Module constant, not state — keeps the load callback stable. */
const PAGE_SIZE = 25;

export interface ExpenseFilterState {
  categoryId?: string;
  vendorId?: string;
  statusKey?: string;
  from?: string;
  to?: string;
}

export interface UseExpenseListReturn {
  expenses: Expense[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  setFilters: (next: Partial<ExpenseFilterState>) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
}

export function useExpenseList(initial?: ExpenseFilterState): UseExpenseListReturn {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<ExpenseFilterState>(initial ?? {});
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await expenseService.listExpenses({
        page: pageNumber,
        pageSize: PAGE_SIZE,
        categoryId: filters.categoryId || undefined,
        vendorId: filters.vendorId || undefined,
        statusKey: filters.statusKey || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      });
      setExpenses(result.items);
      setPageState(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [
    pageNumber,
    filters.categoryId,
    filters.vendorId,
    filters.statusKey,
    filters.from,
    filters.to,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: Partial<ExpenseFilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
    setPageNumber(1);
  }, []);

  return {
    expenses,
    page,
    loading,
    error,
    setFilters,
    setPage: setPageNumber,
    reload: load,
  };
}

export interface UseExpenseSummaryReturn {
  summary: ExpenseSummary | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Server-computed, POSTED-only totals. Accepts `periodKey`, which `list` does
 * not — so a month view is driven from here, not from a list filter. */
export function useExpenseSummary(
  filters: expenseService.ExpenseSummaryFilters = {},
): UseExpenseSummaryReturn {
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { periodKey, from, to, categoryId, vendorId } = filters;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(
        await expenseService.expenseSummary({
          periodKey: periodKey || undefined,
          from: from || undefined,
          to: to || undefined,
          categoryId: categoryId || undefined,
          vendorId: vendorId || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the expense summary');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [periodKey, from, to, categoryId, vendorId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { summary, loading, error, reload: load };
}

export interface UseExpenseReturn {
  expense: Expense | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  reload: () => Promise<void>;
  update: (input: Omit<expenseService.UpdateExpenseInput, 'expenseId'>) => Promise<boolean>;
  cancel: (reason: string) => Promise<boolean>;
}

/** One expense, with its two writes. Both return a boolean so the page can keep
 * its dialog open when the server refuses. */
export function useExpense(expenseId?: string): UseExpenseReturn {
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!expenseId) {
      setExpense(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setExpense(await expenseService.getExpense(expenseId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the expense');
      setExpense(null);
    } finally {
      setLoading(false);
    }
  }, [expenseId]);

  useEffect(() => {
    void load();
  }, [load]);

  /* Shared body for both writes: both reload, so the status and the amount shown
   * are the persisted ones. */
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
    (input: Omit<expenseService.UpdateExpenseInput, 'expenseId'>) => {
      if (!expenseId) return Promise.resolve(false);
      return runWrite(
        () => expenseService.updateExpense({ ...input, expenseId }),
        'Could not update the expense',
      );
    },
    [expenseId, runWrite],
  );

  const cancel = useCallback(
    (reason: string) => {
      if (!expenseId) return Promise.resolve(false);
      return runWrite(
        () => expenseService.cancelExpense(expenseId, reason),
        'Could not cancel the expense',
      );
    },
    [expenseId, runWrite],
  );

  return { expense, loading, error, busy, reload: load, update, cancel };
}

export interface UseCreateExpenseReturn {
  creating: boolean;
  error: string | null;
  created: Expense | null;
  create: (input: expenseService.CreateExpenseInput) => Promise<Expense | null>;
  reset: () => void;
}

export function useCreateExpense(): UseCreateExpenseReturn {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Expense | null>(null);

  const create = useCallback(async (input: expenseService.CreateExpenseInput) => {
    setCreating(true);
    setError(null);
    try {
      /* The service adds the clientRequestId itself — do not send a second one. */
      const result = await expenseService.createExpense(input);
      setCreated(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the expense');
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
