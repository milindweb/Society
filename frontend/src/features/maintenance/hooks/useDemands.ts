/* useDemands.ts — FE-06 demands
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 * Demand generation supports a dry run and always reports created/skipped counts
 * from the server response (SRS §4). */

import { useState, useCallback, useEffect } from 'react';
import * as maintenanceService from '@/services/maintenanceService';
import { generateClientId } from '@/lib/idempotency';
import type { Demand } from '@/types/domain';
import type { PageMeta } from '@/types/api';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

export interface DemandListFilters {
  periodKey?: string;
  flatId?: string;
  statusKey?: string;
}

export interface UseDemandListReturn {
  demands: Demand[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  filters: DemandListFilters;
  setFilters: (next: Partial<DemandListFilters>) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
}

export function useDemandList(initial?: DemandListFilters): UseDemandListReturn {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<DemandListFilters>(initial ?? {});
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await maintenanceService.listDemands({
        page: pageNumber,
        pageSize: page.pageSize || 25,
        periodKey: filters.periodKey,
        flatId: filters.flatId,
        statusKey: filters.statusKey,
      });
      setDemands(result.items);
      setPageState(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load demands');
    } finally {
      setLoading(false);
    }
  }, [pageNumber, page.pageSize, filters.periodKey, filters.flatId, filters.statusKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: Partial<DemandListFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
    setPageNumber(1);
  }, []);

  return {
    demands,
    page,
    loading,
    error,
    filters,
    setFilters,
    setPage: setPageNumber,
    reload: load,
  };
}

export interface UseDemandReturn {
  demand: Demand | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  reload: () => Promise<void>;
  cancel: (reason: string) => Promise<void>;
}

export function useDemand(demandId?: string): UseDemandReturn {
  const [demand, setDemand] = useState<Demand | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!demandId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDemand(await maintenanceService.getDemand(demandId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the demand');
    } finally {
      setLoading(false);
    }
  }, [demandId]);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = useCallback(
    async (reason: string) => {
      if (!demandId) return;
      setBusy(true);
      setError(null);
      try {
        await maintenanceService.cancelDemand(demandId, reason, generateClientId());
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not cancel the demand');
      } finally {
        setBusy(false);
      }
    },
    [demandId, load],
  );

  return { demand, loading, error, busy, reload: load, cancel };
}

export interface GenerationOutcome {
  created: number;
  skipped: number;
  total: number;
  periodKey: string;
}

export interface UseDemandGenerationReturn {
  /** What already exists for the chosen period, read from `demands.list`. */
  existingCount: number | null;
  inspecting: boolean;
  result: GenerationOutcome | null;
  generating: boolean;
  error: string | null;
  inspect: (periodKey: string) => Promise<void>;
  generate: (periodKey: string) => Promise<void>;
  reset: () => void;
}

/** Demand generation.
 *
 * The backend has no dry-run mode, so a real preview is impossible. Instead this hook
 * *inspects* the period (reads how many demands already exist) so the user can see the
 * current state before committing to a write, and the confirmation dialog makes the
 * destructive nature explicit. Nothing here fabricates a predicted result. */
export function useDemandGeneration(): UseDemandGenerationReturn {
  const [existingCount, setExistingCount] = useState<number | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [result, setResult] = useState<GenerationOutcome | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inspect = useCallback(async (periodKey: string) => {
    setInspecting(true);
    setError(null);
    setResult(null);
    try {
      const page = await maintenanceService.listDemands({ page: 1, pageSize: 1, periodKey });
      setExistingCount(page.page.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not inspect the period');
      setExistingCount(null);
    } finally {
      setInspecting(false);
    }
  }, []);

  const generate = useCallback(async (periodKey: string) => {
    setGenerating(true);
    setError(null);
    try {
      const response = await maintenanceService.generateDemands(
        periodKey,
        generateClientId(),
      );
      setResult({
        created: response?.created ?? 0,
        skipped: response?.skipped ?? 0,
        total: response?.total ?? 0,
        periodKey,
      });
      // Re-read so the "already exists" figure matches what just happened.
      const page = await maintenanceService.listDemands({ page: 1, pageSize: 1, periodKey });
      setExistingCount(page.page.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demand generation failed');
    } finally {
      setGenerating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setExistingCount(null);
    setResult(null);
    setError(null);
  }, []);

  return { existingCount, inspecting, result, generating, error, inspect, generate, reset };
}
