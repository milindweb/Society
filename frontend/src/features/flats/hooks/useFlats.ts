/* useFlats.ts — Flats state hook (FE-05)
 * frontend-architecture.md §1: hooks own data access; pages never fetch. */

import { useState, useCallback, useEffect } from 'react';
import * as flatService from '@/services/flatService';
import type { Flat } from '@/types/domain';
import type { PageMeta } from '@/types/api';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

export interface FlatListFilters {
  search?: string;
  wingId?: string;
  statusKey?: string;
}

export interface UseFlatListReturn {
  flats: Flat[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  filters: FlatListFilters;
  setFilters: (next: Partial<FlatListFilters>) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
}

export function useFlatList(initial?: FlatListFilters): UseFlatListReturn {
  const [flats, setFlats] = useState<Flat[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<FlatListFilters>(initial ?? {});
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await flatService.listFlats({
        page: pageNumber,
        pageSize: page.pageSize || 25,
        search: filters.search,
        wingId: filters.wingId,
        statusKey: filters.statusKey,
      });
      setFlats(result.items);
      setPageState(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flats');
    } finally {
      setLoading(false);
    }
  }, [pageNumber, page.pageSize, filters.search, filters.wingId, filters.statusKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: Partial<FlatListFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
    setPageNumber(1);
  }, []);

  return {
    flats,
    page,
    loading,
    error,
    filters,
    setFilters,
    setPage: setPageNumber,
    reload: load,
  };
}

export interface UseFlatReturn {
  flat: Flat | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useFlat(flatId?: string): UseFlatReturn {
  const [flat, setFlat] = useState<Flat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!flatId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setFlat(await flatService.getFlat(flatId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flat');
    } finally {
      setLoading(false);
    }
  }, [flatId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { flat, loading, error, reload: load };
}
