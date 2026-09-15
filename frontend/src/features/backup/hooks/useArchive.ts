/* useArchive.ts — Archive state hook (FE-14) */

import { useState, useEffect, useCallback } from 'react';
import * as backupService from '@/services/backupService';
import * as configService from '@/services/configService';
import { configStore } from '@/state/configStore';
import type { ArchiveEntry, SelectOption } from '@/types/domain';
import type { Paginated, PageMeta } from '@/types/api';

interface UseArchiveRunReturn {
  run: (
    entity?: string,
    olderThanMonths?: number,
    dryRun?: boolean,
    reason?: string,
  ) => Promise<backupService.ArchiveRunResult | null>;
  result: backupService.ArchiveRunResult | null;
  loading: boolean;
  error: string | null;
}

export function useArchiveRun(): UseArchiveRunReturn {
  const [result, setResult] = useState<backupService.ArchiveRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* `dryRun` defaults to **true**. This hook is the only caller of a
   * mutating action in FE-14, so an omitted argument must mean "preview", never
   * "go ahead and move rows" (`BackupService.gs:206`). */
  const run = useCallback(
    async (entity?: string, olderThanMonths?: number, dryRun = true, reason?: string) => {
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const res = await backupService.runArchive({
          entity: entity || undefined,
          olderThanMonths,
          dryRun,
          reason: reason || undefined,
        });
        setResult(res);
        return res;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to run archive');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { run, result, loading, error };
}

/** Sheets `archive.run` is allowed to walk, straight from the server
 *  (`config.enums.archivableEntities`, derived from `Schema.archivableSheets()`).
 *
 * The archive screen used to offer a hardcoded list of Demands/Payments/
 * Complaints/Visitors/Expenses/Attendance — none of which are archivable, so
 * every filtered run would have matched zero sheets. SRS §15 forbids the
 * hardcoded list; this is the config-driven replacement. */
export function useArchivableEntities(): { options: SelectOption[]; loading: boolean } {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        let enums = configStore.enums;
        if (!enums) {
          enums = await configService.getEnums();
          configStore.setEnums(enums);
        }
        if (cancelled) return;
        setOptions(enums.archivableEntities ?? []);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { options, loading };
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
        page: p, pageSize, entity: entity || undefined,
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
