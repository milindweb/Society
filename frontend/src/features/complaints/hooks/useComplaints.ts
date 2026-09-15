/* useComplaints.ts — FE-07 complaint data access
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 * SRS §5: the workflow is Raise → Assign → Corrective Action → Status → Remarks
 * → Close, and a complaint "can be updated many times before close".
 *
 * No optimistic UI: every write reloads from the server so the screen always
 * shows the persisted status (which the backend keeps in lockstep with the
 * latest Complaint_Updates row). */

import { useState, useCallback, useEffect } from 'react';
import * as complaintService from '@/services/complaintService';
import { generateClientId } from '@/lib/idempotency';
import type {
  Complaint,
  ComplaintSummary,
  ComplaintUpdate,
} from '@/types/domain';
import type { PageMeta } from '@/types/api';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

/** Page size requested from the API. A module constant (not state) so the load
 * callback never re-forms just because a response arrived. */
const PAGE_SIZE = 25;

const UNKNOWN_SUMMARY: ComplaintSummary = {
  total: 0,
  counts: { open: 0, assigned: 0, inProgress: 0, resolved: 0, closed: 0, cancelled: 0, reopened: 0 },
  byPriority: {},
  byCategory: {},
  avgResolutionDays: 0,
};

export interface ComplaintFilters {
  statusKey?: string;
  categoryId?: string;
  priorityKey?: string;
  flatId?: string;
  search?: string;
}

export interface UseComplaintListReturn {
  complaints: Complaint[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  setFilters: (next: Partial<ComplaintFilters>) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
}

export function useComplaintList(initial?: ComplaintFilters): UseComplaintListReturn {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<ComplaintFilters>(initial ?? {});
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await complaintService.listComplaints({
        page: pageNumber,
        pageSize: PAGE_SIZE,
        search: filters.search || undefined,
        statusKey: filters.statusKey || undefined,
        categoryId: filters.categoryId || undefined,
        priorityKey: filters.priorityKey || undefined,
        flatId: filters.flatId || undefined,
      });
      setComplaints(result.items);
      setPageState(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load complaints');
    } finally {
      setLoading(false);
    }
  }, [
    pageNumber,
    filters.search,
    filters.statusKey,
    filters.categoryId,
    filters.priorityKey,
    filters.flatId,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: Partial<ComplaintFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
    setPageNumber(1);
  }, []);

  return {
    complaints,
    page,
    loading,
    error,
    setFilters,
    setPage: setPageNumber,
    reload: load,
  };
}

export interface UseComplaintReturn {
  complaint: Complaint | null;
  updates: ComplaintUpdate[];
  loading: boolean;
  error: string | null;
  busy: boolean;
  reload: () => Promise<void>;
  assign: (input: Omit<complaintService.AssignComplaintInput, 'complaintId' | 'clientRequestId'>) => Promise<void>;
  transition: (input: Omit<complaintService.TransitionComplaintInput, 'complaintId' | 'clientRequestId'>) => Promise<void>;
  update: (input: Omit<complaintService.UpdateComplaintInput, 'complaintId' | 'clientRequestId'>) => Promise<void>;
}

/** One complaint plus its update timeline.
 *
 * `complaints.get` returns `{ complaint, updates }` in a single call, so the
 * detail page does not need a separate history request. */
export function useComplaint(complaintId?: string): UseComplaintReturn {
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [updates, setUpdates] = useState<ComplaintUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!complaintId) {
      setComplaint(null);
      setUpdates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await complaintService.getComplaint(complaintId);
      setComplaint(result.complaint ?? null);
      setUpdates(Array.isArray(result.updates) ? result.updates : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the complaint');
      setComplaint(null);
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  }, [complaintId]);

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

  const assign = useCallback(
    (input: Omit<complaintService.AssignComplaintInput, 'complaintId' | 'clientRequestId'>) => {
      if (!complaintId) return Promise.resolve();
      return runWrite(() =>
        complaintService.assignComplaint({
          ...input,
          complaintId,
          clientRequestId: generateClientId(),
        }),
      );
    },
    [complaintId, runWrite],
  );

  const transition = useCallback(
    (input: Omit<complaintService.TransitionComplaintInput, 'complaintId' | 'clientRequestId'>) => {
      if (!complaintId) return Promise.resolve();
      return runWrite(() =>
        complaintService.transitionComplaint({
          ...input,
          complaintId,
          clientRequestId: generateClientId(),
        }),
      );
    },
    [complaintId, runWrite],
  );

  const update = useCallback(
    (input: Omit<complaintService.UpdateComplaintInput, 'complaintId' | 'clientRequestId'>) => {
      if (!complaintId) return Promise.resolve();
      return runWrite(() =>
        complaintService.updateComplaint({
          ...input,
          complaintId,
          clientRequestId: generateClientId(),
        }),
      );
    },
    [complaintId, runWrite],
  );

  return { complaint, updates, loading, error, busy, reload: load, assign, transition, update };
}

export interface UseComplaintSummaryReturn {
  summary: ComplaintSummary;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useComplaintSummary(): UseComplaintSummaryReturn {
  const [summary, setSummary] = useState<ComplaintSummary>(UNKNOWN_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await complaintService.complaintSummary();
      setSummary(result ?? UNKNOWN_SUMMARY);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the complaint summary');
      setSummary(UNKNOWN_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { summary, loading, error, reload: load };
}

export interface UseCreateComplaintReturn {
  creating: boolean;
  error: string | null;
  created: Complaint | null;
  create: (input: Omit<complaintService.CreateComplaintInput, 'clientRequestId'>) => Promise<Complaint | null>;
  reset: () => void;
}

/** Raising a complaint. Returns the created row so the caller can navigate to it. */
export function useCreateComplaint(): UseCreateComplaintReturn {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Complaint | null>(null);

  const create = useCallback(
    async (input: Omit<complaintService.CreateComplaintInput, 'clientRequestId'>) => {
      setCreating(true);
      setError(null);
      try {
        const result = await complaintService.createComplaint({
          ...input,
          clientRequestId: generateClientId(),
        });
        setCreated(result);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not raise the complaint');
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
