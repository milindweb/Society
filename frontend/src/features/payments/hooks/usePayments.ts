/* usePayments.ts — FE-06 payments
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 * SRS §23: NO optimistic UI for money. Every write reloads from the server and the
 * screen shows only what the server returned. */

import { useState, useCallback, useEffect } from 'react';
import * as paymentService from '@/services/paymentService';
import { generateClientId } from '@/lib/idempotency';
import type { Payment } from '@/types/domain';
import type { PageMeta } from '@/types/api';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

export interface PaymentListFilters {
  flatId?: string;
  from?: string;
  to?: string;
  modeKey?: string;
}

export interface UsePaymentListReturn {
  payments: Payment[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  filters: PaymentListFilters;
  setFilters: (next: Partial<PaymentListFilters>) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
}

export function usePaymentList(initial?: PaymentListFilters): UsePaymentListReturn {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<PaymentListFilters>(initial ?? {});
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await paymentService.listPayments({
        page: pageNumber,
        pageSize: page.pageSize || 25,
        flatId: filters.flatId,
        from: filters.from,
        to: filters.to,
        modeKey: filters.modeKey,
      });
      setPayments(result.items);
      setPageState(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [pageNumber, page.pageSize, filters.flatId, filters.from, filters.to, filters.modeKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: Partial<PaymentListFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
    setPageNumber(1);
  }, []);

  return {
    payments,
    page,
    loading,
    error,
    filters,
    setFilters,
    setPage: setPageNumber,
    reload: load,
  };
}

export interface UsePaymentReturn {
  payment: Payment | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  reload: () => Promise<void>;
  reverse: (reason: string) => Promise<void>;
}

export function usePayment(paymentId?: string): UsePaymentReturn {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!paymentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setPayment(await paymentService.getPayment(paymentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the payment');
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reverse = useCallback(
    async (reason: string) => {
      if (!paymentId) return;
      setBusy(true);
      setError(null);
      try {
        await paymentService.reversePayment(paymentId, reason, generateClientId());
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not reverse the payment');
      } finally {
        setBusy(false);
      }
    },
    [paymentId, load],
  );

  return { payment, loading, error, busy, reload: load, reverse };
}
