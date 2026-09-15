/* useParking.ts — FE-09 parking data access
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 * SRS §10: slot master, wing/flat/member mapping, vehicle details, allocation,
 * temporary parking and parking history.
 *
 * No optimistic UI (SRS §23): every write reloads from the server, so the
 * allocation status and the slot status shown are the persisted ones. This
 * matters more than usual here — creating or ending an allocation changes the
 * SLOT's status too, and that change is made by the backend, not by us. */

import { useState, useCallback, useEffect } from 'react';
import * as parkingService from '@/services/parkingService';
import { generateClientId } from '@/lib/idempotency';
import type { ParkingAllocation, ParkingSummary } from '@/types/domain';
import type { PageMeta } from '@/types/api';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

/** Module constant, not state — keeps the load callback stable. */
const PAGE_SIZE = 25;

export interface AllocationFilterState {
  parkingSlotId?: string;
  flatId?: string;
  statusKey?: string;
}

export interface UseAllocationListReturn {
  allocations: ParkingAllocation[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  setFilters: (next: Partial<AllocationFilterState>) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
}

export function useAllocationList(initial?: AllocationFilterState): UseAllocationListReturn {
  const [allocations, setAllocations] = useState<ParkingAllocation[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<AllocationFilterState>(initial ?? {});
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await parkingService.listAllocations({
        page: pageNumber,
        pageSize: PAGE_SIZE,
        parkingSlotId: filters.parkingSlotId || undefined,
        flatId: filters.flatId || undefined,
        statusKey: filters.statusKey || undefined,
      });
      setAllocations(result.items);
      setPageState(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load parking allocations');
    } finally {
      setLoading(false);
    }
  }, [pageNumber, filters.parkingSlotId, filters.flatId, filters.statusKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: Partial<AllocationFilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
    setPageNumber(1);
  }, []);

  return {
    allocations,
    page,
    loading,
    error,
    setFilters,
    setPage: setPageNumber,
    reload: load,
  };
}

export interface UseParkingSummaryReturn {
  summary: ParkingSummary | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Slot counts and the active monthly charge total.
 *
 * This is a separate hook because the counts change whenever an allocation is
 * created or ended — the allocations page reloads the summary after a write
 * rather than trusting its own arithmetic (SRS §23). */
export function useParkingSummary(): UseParkingSummaryReturn {
  const [summary, setSummary] = useState<ParkingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await parkingService.getParkingSummary());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the parking summary');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { summary, loading, error, reload: load };
}

export interface UseAllocationReturn {
  allocation: ParkingAllocation | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  reload: () => Promise<void>;
  end: (input: { endDate: string; reason?: string }) => Promise<boolean>;
}

/** One allocation, plus the `end` operation.
 *
 * `end` returns a boolean rather than throwing, because the caller needs to know
 * whether to close its modal: a rejected end (an already-ended allocation, for
 * instance) must leave the dialog open with the server's message. */
export function useAllocation(allocationId?: string): UseAllocationReturn {
  const [allocation, setAllocation] = useState<ParkingAllocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!allocationId) {
      setAllocation(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setAllocation(await parkingService.getAllocation(allocationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the allocation');
      setAllocation(null);
    } finally {
      setLoading(false);
    }
  }, [allocationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const end = useCallback(
    async (input: { endDate: string; reason?: string }) => {
      if (!allocationId) return false;
      setBusy(true);
      setError(null);
      try {
        await parkingService.endAllocation({
          allocationId,
          endDate: input.endDate,
          reason: input.reason,
          clientRequestId: generateClientId(),
        });
        await load();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not end the allocation');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [allocationId, load],
  );

  return { allocation, loading, error, busy, reload: load, end };
}

export interface UseCreateAllocationReturn {
  creating: boolean;
  /** The server's message, kept verbatim so a `CONFLICT_ERROR` can be shown
   * inline next to the slot/vehicle that clashed. */
  error: string | null;
  errorCode: string | null;
  created: ParkingAllocation | null;
  create: (
    input: Omit<parkingService.CreateAllocationInput, 'clientRequestId'>,
  ) => Promise<ParkingAllocation | null>;
  reset: () => void;
}

/** Creating an allocation. Exposes the error CODE as well as the message because
 * `CONFLICT_ERROR` is the case the UI must present specially (SRS §10: one active
 * allocation per slot and per vehicle). */
export function useCreateAllocation(): UseCreateAllocationReturn {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [created, setCreated] = useState<ParkingAllocation | null>(null);

  const create = useCallback(
    async (input: Omit<parkingService.CreateAllocationInput, 'clientRequestId'>) => {
      setCreating(true);
      setError(null);
      setErrorCode(null);
      try {
        const result = await parkingService.createAllocation({
          ...input,
          clientRequestId: generateClientId(),
        });
        setCreated(result);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create the allocation');
        setErrorCode((err as { code?: string } | null)?.code ?? null);
        return null;
      } finally {
        setCreating(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setError(null);
    setErrorCode(null);
    setCreated(null);
  }, []);

  return { creating, error, errorCode, created, create, reset };
}
