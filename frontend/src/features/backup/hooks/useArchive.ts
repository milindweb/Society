/* useArchive.ts — Archive state hook (FE-14) */

import { useState, useCallback } from 'react';
import * as backupService from '@/services/backupService';
import type { ArchiveEntry } from '@/types/domain';
import type { Paginated, PageMeta } from '@/types/api';

interface UseArchiveRunReturn {
  run: (entity?: string, olderThanMonths?: number, dryRun?: boolean) => Promise<backupService.ArchiveRunResult | null>;
  result: backupService.ArchiveRunResult | null;
  loading: boolean;
  error: string | null;
}

export function useArchiveRun(): UseArchiveRunReturn {
  const [result, setResult] = useState<backupService.ArchiveRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (entity?: string, olderThanMonths?: number, dryRun = false) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await backupService.runArchive({ entity, olderThanMonths, dryRun });
      setResult(res);
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run archive');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { run, result, loading, error };
}

interface UseArchiveListReturn {
  archives: ArchiveEntry[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  fetchArchives: (page?: number, pageSize?: number, entity?: string) => Promise<void>;
}

export function useArchiveList(): UseArchiveListReturn {
  const [archives, setArchives] = useState<ArchiveEntry[]>([]);
  const [page, setPage] = useState<PageMeta>({
    page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArchives = useCallback(async (p = 1, pageSize = 25, entity?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result: Paginated<ArchiveEntry> = await backupService.listArchives({
        page: p, pageSize, entity,
      });
      setArchives(result.items);
      setPage(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load archives');
    } finally {
      setLoading(false);
    }
  }, []);

  return { archives, page, loading, error, fetchArchives };
}
