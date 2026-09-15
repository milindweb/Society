/* useNotices.ts — FE-08 notice data access
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 * SRS §6: one simple Notice module covering all society communication, with
 * publish/unpublish and an archive (the list IS the archive — an EXPIRED or
 * unpublished notice stays listed under a status filter, never deleted).
 *
 * No optimistic UI (SRS §23): every write reloads from the server, so the status
 * shown is always the persisted one. */

import { useState, useCallback, useEffect } from 'react';
import * as noticeService from '@/services/noticeService';
import { generateClientId } from '@/lib/idempotency';
import type { Notice } from '@/types/domain';
import type { PageMeta } from '@/types/api';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

/** Page size requested from the API. A module constant (not state) so the load
 * callback never re-forms just because a response arrived. */
const PAGE_SIZE = 25;

export interface NoticeFilterState {
  noticeTypeId?: string;
  /** undefined = all, true = published only, false = drafts only. */
  isPublished?: boolean;
  search?: string;
}

export interface UseNoticeListReturn {
  notices: Notice[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  setFilters: (next: Partial<NoticeFilterState>) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
}

export function useNoticeList(initial?: NoticeFilterState): UseNoticeListReturn {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<NoticeFilterState>(initial ?? {});
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await noticeService.listNotices({
        page: pageNumber,
        pageSize: PAGE_SIZE,
        search: filters.search || undefined,
        noticeTypeId: filters.noticeTypeId || undefined,
        isPublished: filters.isPublished,
      });
      setNotices(result.items);
      setPageState(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notices');
    } finally {
      setLoading(false);
    }
  }, [pageNumber, filters.search, filters.noticeTypeId, filters.isPublished]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: Partial<NoticeFilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
    setPageNumber(1);
  }, []);

  return {
    notices,
    page,
    loading,
    error,
    setFilters,
    setPage: setPageNumber,
    reload: load,
  };
}

export interface UseNoticeReturn {
  notice: Notice | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  reload: () => Promise<void>;
  update: (input: Omit<noticeService.UpdateNoticeInput, 'noticeId' | 'clientRequestId'>) => Promise<void>;
  publish: (input?: Omit<noticeService.PublishNoticeInput, 'noticeId' | 'clientRequestId'>) => Promise<void>;
  unpublish: (reason: string) => Promise<void>;
}

/** One notice, plus the three transitions the backend allows.
 *
 * `notices.get` returns the notice row directly (no wrapper) — unlike
 * `complaints.get`. */
export function useNotice(noticeId?: string): UseNoticeReturn {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!noticeId) {
      setNotice(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setNotice(await noticeService.getNotice(noticeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the notice');
      setNotice(null);
    } finally {
      setLoading(false);
    }
  }, [noticeId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Run a write, then reload so the displayed status is the persisted one. */
  const runWrite = useCallback(
    async (write: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await write();
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The operation failed');
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const update = useCallback(
    (input: Omit<noticeService.UpdateNoticeInput, 'noticeId' | 'clientRequestId'>) => {
      if (!noticeId) return Promise.resolve();
      return runWrite(() =>
        noticeService.updateNotice({
          ...input,
          noticeId,
          clientRequestId: generateClientId(),
        }),
      );
    },
    [noticeId, runWrite],
  );

  const publish = useCallback(
    (input?: Omit<noticeService.PublishNoticeInput, 'noticeId' | 'clientRequestId'>) => {
      if (!noticeId) return Promise.resolve();
      return runWrite(() =>
        noticeService.publishNotice({
          ...input,
          noticeId,
          clientRequestId: generateClientId(),
        }),
      );
    },
    [noticeId, runWrite],
  );

  const unpublish = useCallback(
    (reason: string) => {
      if (!noticeId) return Promise.resolve();
      return runWrite(() =>
        noticeService.unpublishNotice({
          noticeId,
          reason,
          clientRequestId: generateClientId(),
        }),
      );
    },
    [noticeId, runWrite],
  );

  return { notice, loading, error, busy, reload: load, update, publish, unpublish };
}

export interface UseCreateNoticeReturn {
  creating: boolean;
  error: string | null;
  created: Notice | null;
  create: (input: Omit<noticeService.CreateNoticeInput, 'clientRequestId'>) => Promise<Notice | null>;
  reset: () => void;
}

/** Creating a notice. Returns the created row so the caller can navigate to it. */
export function useCreateNotice(): UseCreateNoticeReturn {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Notice | null>(null);

  const create = useCallback(
    async (input: Omit<noticeService.CreateNoticeInput, 'clientRequestId'>) => {
      setCreating(true);
      setError(null);
      try {
        const result = await noticeService.createNotice({
          ...input,
          clientRequestId: generateClientId(),
        });
        setCreated(result);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create the notice');
        return null;
      } finally {
        setCreating(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setError(null);
    setCreated(null);
  }, []);

  return { creating, error, created, create, reset };
}
