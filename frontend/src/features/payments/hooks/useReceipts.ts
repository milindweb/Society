/* useReceipts.ts — FE-06 receipts
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 * Print count is server-incremented by receipts.print; we reload after printing so
 * the displayed count is the persisted one (SRS §4). */

import { useState, useCallback, useEffect } from 'react';
import * as paymentService from '@/services/paymentService';
import type { Receipt } from '@/types/domain';
import type { PageMeta } from '@/types/api';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

export interface ReceiptListFilters {
  flatId?: string;
  periodKey?: string;
}

export interface UseReceiptListReturn {
  receipts: Receipt[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  filters: ReceiptListFilters;
  setFilters: (next: Partial<ReceiptListFilters>) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
}

export function useReceiptList(initial?: ReceiptListFilters): UseReceiptListReturn {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<ReceiptListFilters>(initial ?? {});
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await paymentService.listReceipts({
        page: pageNumber,
        pageSize: page.pageSize || 25,
        flatId: filters.flatId,
        periodKey: filters.periodKey,
      });
      setReceipts(result.items);
      setPageState(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load receipts');
    } finally {
      setLoading(false);
    }
  }, [pageNumber, page.pageSize, filters.flatId, filters.periodKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: Partial<ReceiptListFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
    setPageNumber(1);
  }, []);

  return {
    receipts,
    page,
    loading,
    error,
    filters,
    setFilters,
    setPage: setPageNumber,
    reload: load,
  };
}

export interface UseReceiptReturn {
  receipt: Receipt | null;
  loading: boolean;
  error: string | null;
  printing: boolean;
  reload: () => Promise<void>;
  /** Asks the server to register the print, then reloads so `printCount` is accurate. */
  markPrinted: () => Promise<void>;
}

export function useReceipt(receiptId?: string): UseReceiptReturn {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    if (!receiptId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReceipt(await paymentService.getReceipt(receiptId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the receipt');
    } finally {
      setLoading(false);
    }
  }, [receiptId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markPrinted = useCallback(async () => {
    if (!receiptId) return;
    setPrinting(true);
    try {
      const updated = await paymentService.printReceipt(receiptId);
      // The backend stores printCount as a string; trust whatever it returns and
      // fall back to a reload rather than guessing.
      if (updated && updated.printCount !== undefined && updated.printCount !== null) {
        setReceipt(updated);
      } else {
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register the print');
    } finally {
      setPrinting(false);
    }
  }, [receiptId, load]);

  return { receipt, loading, error, printing, reload: load, markPrinted };
}
