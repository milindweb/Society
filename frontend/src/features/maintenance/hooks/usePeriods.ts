/* usePeriods.ts — FE-06 billing periods
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 * Lock/unlock are server-authoritative — after a write we reload rather than
 * mutating local state (SRS §23: no optimistic UI for money). */

import { useState, useCallback, useEffect } from 'react';
import * as maintenanceService from '@/services/maintenanceService';
import { generateClientId } from '@/lib/idempotency';
import type { BillingPeriod } from '@/types/domain';
import type { PageMeta } from '@/types/api';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

/** Page size requested from the API. A module constant (not state) so the load
 * callback never re-forms just because a response arrived. */
const PAGE_SIZE = 25;

export interface UsePeriodsReturn {
  periods: BillingPeriod[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  busyPeriodKey: string | null;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
  ensurePeriod: (periodKey: string) => Promise<void>;
  lock: (periodKey: string) => Promise<void>;
  unlock: (periodKey: string, reason: string) => Promise<void>;
}

export function usePeriods(): UsePeriodsReturn {
  const [periods, setPeriods] = useState<BillingPeriod[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyPeriodKey, setBusyPeriodKey] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await maintenanceService.listPeriods({
        page: pageNumber,
        pageSize: PAGE_SIZE,
      });
      setPeriods(result.items);
      setPageState(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing periods');
    } finally {
      setLoading(false);
    }
  }, [pageNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Shared write wrapper: set the busy key, run the write, then reload from the
   * server so the displayed state is always the persisted state. */
  const runWrite = useCallback(
    async (periodKey: string, write: () => Promise<unknown>) => {
      setBusyPeriodKey(periodKey);
      setError(null);
      try {
        await write();
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The operation failed');
      } finally {
        setBusyPeriodKey(null);
      }
    },
    [load],
  );

  const ensurePeriod = useCallback(
    (periodKey: string) =>
      runWrite(periodKey, () =>
        maintenanceService.ensurePeriod(periodKey, generateClientId()),
      ),
    [runWrite],
  );

  const lock = useCallback(
    (periodKey: string) =>
      runWrite(periodKey, () => maintenanceService.lockPeriod(periodKey, generateClientId())),
    [runWrite],
  );

  const unlock = useCallback(
    (periodKey: string, reason: string) =>
      runWrite(periodKey, () =>
        maintenanceService.unlockPeriod(periodKey, reason, generateClientId()),
      ),
    [runWrite],
  );

  return {
    periods,
    page,
    loading,
    error,
    busyPeriodKey,
    setPage: setPageNumber,
    reload: load,
    ensurePeriod,
    lock,
    unlock,
  };
}
