/* useAudit.ts — Audit state hook (FE-14) */

import { useState, useCallback } from 'react';
import * as backupService from '@/services/backupService';
import type { AuditEntry } from '@/types/domain';
import type { Paginated, PageMeta } from '@/types/api';

interface UseAuditListReturn {
  entries: AuditEntry[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  fetchEntries: (params?: {
    page?: number;
    pageSize?: number;
    entity?: string;
    entityId?: string;
    action?: string;
    from?: string;
    to?: string;
    actorUserId?: string;
  }) => Promise<void>;
}

export function useAuditList(): UseAuditListReturn {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState<PageMeta>({
    page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async (params?: {
    page?: number;
    pageSize?: number;
    entity?: string;
    entityId?: string;
    action?: string;
    from?: string;
    to?: string;
    actorUserId?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result: Paginated<AuditEntry> = await backupService.listAuditEntries({
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 25,
        entity: params?.entity,
        entityId: params?.entityId,
        action: params?.action,
        from: params?.from,
        to: params?.to,
        actorUserId: params?.actorUserId,
      });
      setEntries(result.items);
      setPage(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit entries');
    } finally {
      setLoading(false);
    }
  }, []);

  return { entries, page, loading, error, fetchEntries };
}

interface UseAuditDetailReturn {
  entry: AuditEntry | null;
  loading: boolean;
  error: string | null;
  fetchEntry: (auditId: string) => Promise<void>;
}

export function useAuditDetail(): UseAuditDetailReturn {
  const [entry, setEntry] = useState<AuditEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntry = useCallback(async (auditId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await backupService.getAuditEntry(auditId);
      setEntry(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit entry');
    } finally {
      setLoading(false);
    }
  }, []);

  return { entry, loading, error, fetchEntry };
}
