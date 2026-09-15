/* useVisitors.ts — FE-07 visitor data access
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 * SRS §7: the watchman needs a very simple mobile-friendly entry screen;
 * admin/committee view history and reports.
 *
 * No optimistic UI: a write reloads from the server, so the pass number and
 * status shown are always the persisted values. */

import { useState, useCallback, useEffect } from 'react';
import * as visitorService from '@/services/visitorService';
import { generateClientId } from '@/lib/idempotency';
import type { Visitor, VisitorSummary } from '@/types/domain';
import type { PageMeta } from '@/types/api';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

/** Page size requested from the API. A module constant (not state) so the load
 * callback never re-forms just because a response arrived. */
const PAGE_SIZE = 25;

const UNKNOWN_SUMMARY: VisitorSummary = {
  total: 0, inside: 0, todayEntries: 0, todayExits: 0,
};

export interface VisitorFilters {
  statusKey?: string;
  flatId?: string;
  /** Mapped to `visitorTypeId` by the service. */
  typeKey?: string;
  search?: string;
}

export interface UseVisitorListReturn {
  visitors: Visitor[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  setFilters: (next: Partial<VisitorFilters>) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
  exitingId: string | null;
  exit: (input: Omit<visitorService.ExitVisitorInput, 'clientRequestId'>) => Promise<void>;
}

export function useVisitorList(initial?: VisitorFilters): UseVisitorListReturn {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<VisitorFilters>(initial ?? {});
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await visitorService.listVisitors({
        page: pageNumber,
        pageSize: PAGE_SIZE,
        search: filters.search || undefined,
        statusKey: filters.statusKey || undefined,
        flatId: filters.flatId || undefined,
        typeKey: filters.typeKey || undefined,
      });
      setVisitors(result.items);
      setPageState(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load visitors');
    } finally {
      setLoading(false);
    }
  }, [pageNumber, filters.search, filters.statusKey, filters.flatId, filters.typeKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: Partial<VisitorFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
    setPageNumber(1);
  }, []);

  /** Record an exit, then reload so the list reflects the persisted status. */
  const exit = useCallback(
    async (input: Omit<visitorService.ExitVisitorInput, 'clientRequestId'>) => {
      setExitingId(input.visitorId);
      setError(null);
      try {
        await visitorService.exitVisitor({ ...input, clientRequestId: generateClientId() });
        await load();
      } catch (err) {
        /* The backend rejects an already-exited visitor with a specific message;
         * surfacing it verbatim is more useful than a generic failure. */
        setError(err instanceof Error ? err.message : 'Could not record the exit');
      } finally {
        setExitingId(null);
      }
    },
    [load],
  );

  return {
    visitors,
    page,
    loading,
    error,
    setFilters,
    setPage: setPageNumber,
    reload: load,
    exitingId,
    exit,
  };
}

export interface UseVisitorReturn {
  visitor: Visitor | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useVisitor(visitorId?: string): UseVisitorReturn {
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!visitorId) {
      setVisitor(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setVisitor(await visitorService.getVisitor(visitorId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the visitor');
      setVisitor(null);
    } finally {
      setLoading(false);
    }
  }, [visitorId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { visitor, loading, error, reload: load };
}

export interface UseVisitorSummaryReturn {
  summary: VisitorSummary;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useVisitorSummary(): UseVisitorSummaryReturn {
  const [summary, setSummary] = useState<VisitorSummary>(UNKNOWN_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await visitorService.visitorSummary();
      setSummary(result ?? UNKNOWN_SUMMARY);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the visitor summary');
      setSummary(UNKNOWN_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { summary, loading, error, reload: load };
}

export interface UseCreateVisitorReturn {
  creating: boolean;
  error: string | null;
  created: Visitor | null;
  create: (input: Omit<visitorService.CreateVisitorInput, 'clientRequestId'>) => Promise<Visitor | null>;
  reset: () => void;
}

/** Watchman visitor entry. Returns the created row (with its generated pass number). */
export function useCreateVisitor(): UseCreateVisitorReturn {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Visitor | null>(null);

  const create = useCallback(
    async (input: Omit<visitorService.CreateVisitorInput, 'clientRequestId'>) => {
      setCreating(true);
      setError(null);
      try {
        const result = await visitorService.createVisitor({
          ...input,
          clientRequestId: generateClientId(),
        });
        setCreated(result);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not log the visitor');
        return null;
      } finally {
        setCreating(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setError(null);
    setCreated(null);
  }, []);

  return { creating, error, created, create, reset };
}
