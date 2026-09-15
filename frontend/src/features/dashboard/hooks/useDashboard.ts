/* useDashboard.ts — Dashboard state hook (FE-04)
 * frontend-architecture.md §1: hooks own data access; pages never fetch. */

import { useState, useCallback, useEffect } from 'react';
import * as dashboardService from '@/services/dashboardService';
import type { DashboardSummary } from '@/types/domain';

export interface UseDashboardReturn {
  summary: DashboardSummary | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useDashboard(periodKey?: string): UseDashboardReturn {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await dashboardService.getDashboardSummary(periodKey);
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [periodKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { summary, loading, error, reload };
}
