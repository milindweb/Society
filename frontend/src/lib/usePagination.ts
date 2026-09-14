/* usePagination.ts — Pagination state hook (frontend-architecture.md §6) */

import { useState, useCallback } from 'react';

export interface PaginationState {
  page: number;
  pageSize: number;
}

export interface UsePaginationReturn {
  pagination: PaginationState;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  reset: () => void;
}

export function usePagination(defaultPageSize = 25): UsePaginationReturn {
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: defaultPageSize,
  });

  const setPage = useCallback((page: number) => {
    setPagination((p) => ({ ...p, page: Math.max(1, page) }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setPagination({ page: 1, pageSize });
  }, []);

  const nextPage = useCallback(() => {
    setPagination((p) => ({ ...p, page: p.page + 1 }));
  }, []);

  const prevPage = useCallback(() => {
    setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }));
  }, []);

  const reset = useCallback(() => {
    setPagination({ page: 1, pageSize: defaultPageSize });
  }, [defaultPageSize]);

  return { pagination, setPage, setPageSize, nextPage, prevPage, reset };
}
