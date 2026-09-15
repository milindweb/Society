/* useLedger.ts — FE-06 member ledger
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 * The ledger presents Demand → Payment → Interest → Adjustment → Pending → Balance.
 * Every number here is server-computed; the UI never derives a balance (SRS §23). */

import { useState, useCallback, useEffect } from 'react';
import * as ledgerService from '@/services/ledgerService';
import type { LedgerEntry, LedgerSummary } from '@/types/domain';
import type { PageMeta } from '@/types/api';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 50, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

/** Page size requested from the API. A module constant (not state) so the load
 * callback never re-forms just because a response arrived. */
const PAGE_SIZE = 50;

export interface LedgerFilters {
  flatId?: string;
  periodKey?: string;
  from?: string;
  to?: string;
}

export interface UseLedgerReturn {
  entries: LedgerEntry[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  filters: LedgerFilters;
  setFilters: (next: Partial<LedgerFilters>) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
}

export function useLedger(initial?: LedgerFilters): UseLedgerReturn {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<LedgerFilters>(initial ?? {});
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ledgerService.getLedger({
        page: pageNumber,
        pageSize: PAGE_SIZE,
        flatId: filters.flatId,
        periodKey: filters.periodKey,
        from: filters.from,
        to: filters.to,
      });
      setEntries(result.items);
      setPageState(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the ledger');
    } finally {
      setLoading(false);
    }
  }, [pageNumber, filters.flatId, filters.periodKey, filters.from, filters.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: Partial<LedgerFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
    setPageNumber(1);
  }, []);

  return {
    entries,
    page,
    loading,
    error,
    filters,
    setFilters,
    setPage: setPageNumber,
    reload: load,
  };
}

export interface UseLedgerSummaryReturn {
  summaries: LedgerSummary[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useLedgerSummary(flatId?: string): UseLedgerSummaryReturn {
  const [summaries, setSummaries] = useState<LedgerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ledgerService.ledgerSummary(flatId);
      setSummaries(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the ledger summary');
    } finally {
      setLoading(false);
    }
  }, [flatId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { summaries, loading, error, reload: load };
}
