/* useInterest.ts — FE-06 interest preview, apply and adjustments
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 * A preview is strictly read-only. Applying interest and creating an adjustment are
 * writes that reload from the server (SRS §23, §4 — waiver requires a reason). */

import { useState, useCallback, useEffect } from 'react';
import * as maintenanceService from '@/services/maintenanceService';
import { generateClientId } from '@/lib/idempotency';
import type { Adjustment } from '@/types/domain';
import type { PageMeta } from '@/types/api';

/* ── Interest ── */

export interface InterestPreviewRow {
  flatId: string;
  flatNumber?: string;
  outstandingAmount?: number;
  interestAmount?: number;
  [key: string]: unknown;
}

export interface UseInterestReturn {
  rows: InterestPreviewRow[];
  loading: boolean;
  applying: boolean;
  error: string | null;
  applied: boolean;
  preview: (periodKey: string) => Promise<void>;
  apply: (periodKey: string) => Promise<void>;
  reset: () => void;
}

/** Normalises the preview payload: the backend may return either a bare array or
 * an object wrapping one. The client only re-shapes — it never computes interest. */
function readRows(payload: unknown): InterestPreviewRow[] {
  if (Array.isArray(payload)) return payload as InterestPreviewRow[];
  const source = (payload ?? {}) as Record<string, unknown>;
  for (const key of ['items', 'rows', 'preview', 'flats']) {
    const value = source[key];
    if (Array.isArray(value)) return value as InterestPreviewRow[];
  }
  return [];
}

export function useInterest(): UseInterestReturn {
  const [rows, setRows] = useState<InterestPreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const preview = useCallback(async (periodKey: string) => {
    setLoading(true);
    setError(null);
    setApplied(false);
    try {
      setRows(readRows(await maintenanceService.previewInterest(periodKey)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not preview interest');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const apply = useCallback(async (periodKey: string) => {
    setApplying(true);
    setError(null);
    try {
      await maintenanceService.applyInterest(periodKey, generateClientId());
      setApplied(true);
      // Re-preview from the server so the table reflects the new state.
      setRows(readRows(await maintenanceService.previewInterest(periodKey)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply interest');
    } finally {
      setApplying(false);
    }
  }, []);

  const reset = useCallback(() => {
    setRows([]);
    setError(null);
    setApplied(false);
  }, []);

  return { rows, loading, applying, error, applied, preview, apply, reset };
}

/* ── Adjustments ── */

export interface UseAdjustmentsReturn {
  adjustments: Adjustment[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  saving: boolean;
  reload: () => Promise<void>;
  create: (input: {
    flatId: string;
    adjustmentType: string;
    amount: number;
    sign: 1 | -1;
    reason: string;
    periodKey?: string;
    demandId?: string;
  }) => Promise<void>;
}

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

export function useAdjustments(flatId?: string): UseAdjustmentsReturn {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await maintenanceService.listAdjustments({
        page: 1,
        pageSize: page.pageSize || 25,
        flatId,
      });
      setAdjustments(result.items);
      setPageState(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load adjustments');
    } finally {
      setLoading(false);
    }
  }, [flatId, page.pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    async (input: {
      flatId: string;
      adjustmentType: string;
      amount: number;
      sign: 1 | -1;
      reason: string;
      periodKey?: string;
      demandId?: string;
    }) => {
      setSaving(true);
      setError(null);
      try {
        await maintenanceService.createAdjustment({
          ...input,
          clientRequestId: generateClientId(),
        });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create the adjustment');
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  return { adjustments, page, loading, error, saving, reload: load, create };
}
