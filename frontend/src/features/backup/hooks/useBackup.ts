/* useBackup.ts — Backup state hook (FE-14) */

import { useState, useCallback } from 'react';
import * as backupService from '@/services/backupService';
import type { Backup, BackupCreateResult } from '@/types/domain';
import type { Paginated, PageMeta } from '@/types/api';

interface UseBackupListReturn {
  backups: Backup[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  fetchBackups: (page?: number, pageSize?: number) => Promise<void>;
}

export function useBackupList(): UseBackupListReturn {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [page, setPage] = useState<PageMeta>({
    page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBackups = useCallback(async (p = 1, pageSize = 25) => {
    setLoading(true);
    setError(null);
    try {
      const result: Paginated<Backup> = await backupService.listBackups({ page: p, pageSize });
      setBackups(result.items);
      setPage(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  }, []);

  return { backups, page, loading, error, fetchBackups };
}

interface UseBackupCreateReturn {
  /** `backup.create` returns a summary (`BackupCreateResult`), not a `Backup` row. */
  create: (scope: string, notes?: string) => Promise<BackupCreateResult | null>;
  created: BackupCreateResult | null;
  loading: boolean;
  error: string | null;
}

export function useBackupCreate(): UseBackupCreateReturn {
  const [created, setCreated] = useState<BackupCreateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (scope: string, notes?: string) => {
    setLoading(true);
    setError(null);
    setCreated(null);
    try {
      const result = await backupService.createBackup({ scope, notes: notes || undefined });
      setCreated(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, created, loading, error };
}
