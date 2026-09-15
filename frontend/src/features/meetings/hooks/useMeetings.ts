/* useMeetings.ts — FE-08 meeting data access
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 * SRS §8: AGM/SGM/committee meetings with date/time, venue, agenda, attendance,
 * minutes, resolutions, attachments and history. Meeting documents link to the
 * Documents module rather than a second store — `meetings.get` resolves them into
 * `linkedDocuments`, which this hook passes straight through.
 *
 * No optimistic UI (SRS §23): every write reloads from the server. */

import { useState, useCallback, useEffect } from 'react';
import * as meetingService from '@/services/meetingService';
import { generateClientId } from '@/lib/idempotency';
import type { Meeting, MeetingAttendance } from '@/types/domain';
import type { PageMeta } from '@/types/api';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

/** Module constant, not state — keeps the load callback stable. */
const PAGE_SIZE = 25;

export interface MeetingFilterState {
  /** Sent as `meetingTypeId`; the server maps it onto `meetingTypeKey`. */
  meetingTypeId?: string;
  statusKey?: string;
  search?: string;
}

export interface UseMeetingListReturn {
  meetings: Meeting[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  setFilters: (next: Partial<MeetingFilterState>) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
}

export function useMeetingList(initial?: MeetingFilterState): UseMeetingListReturn {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<MeetingFilterState>(initial ?? {});
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await meetingService.listMeetings({
        page: pageNumber,
        pageSize: PAGE_SIZE,
        search: filters.search || undefined,
        meetingTypeId: filters.meetingTypeId || undefined,
        statusKey: filters.statusKey || undefined,
      });
      setMeetings(result.items);
      setPageState(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, [pageNumber, filters.search, filters.meetingTypeId, filters.statusKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: Partial<MeetingFilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
    setPageNumber(1);
  }, []);

  return {
    meetings,
    page,
    loading,
    error,
    setFilters,
    setPage: setPageNumber,
    reload: load,
  };
}

export interface UseMeetingReturn {
  meeting: Meeting | null;
  attendance: MeetingAttendance[];
  loading: boolean;
  error: string | null;
  busy: boolean;
  reload: () => Promise<void>;
  update: (input: Omit<meetingService.UpdateMeetingInput, 'meetingId' | 'clientRequestId'>) => Promise<void>;
  markAttendance: (rows: meetingService.AttendanceRowInput[]) => Promise<void>;
}

/** One meeting plus its attendance.
 *
 * `meetings.get` returns the meeting with `attendance[]` and `linkedDocuments[]`
 * in a single call, so the detail page needs no separate attendance request. */
export function useMeeting(meetingId?: string): UseMeetingReturn {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [attendance, setAttendance] = useState<MeetingAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!meetingId) {
      setMeeting(null);
      setAttendance([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await meetingService.getMeeting(meetingId);
      setMeeting(result ?? null);
      setAttendance(Array.isArray(result?.attendance) ? result.attendance : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the meeting');
      setMeeting(null);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Run a write, then reload so the displayed values are the persisted ones. */
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
    (input: Omit<meetingService.UpdateMeetingInput, 'meetingId' | 'clientRequestId'>) => {
      if (!meetingId) return Promise.resolve();
      return runWrite(() =>
        meetingService.updateMeeting({
          ...input,
          meetingId,
          clientRequestId: generateClientId(),
        }),
      );
    },
    [meetingId, runWrite],
  );

  const markAttendance = useCallback(
    (rows: meetingService.AttendanceRowInput[]) => {
      if (!meetingId) return Promise.resolve();
      /* attendance.mark needs no clientRequestId (the route has no requireClientId). */
      return runWrite(() => meetingService.markAttendance(meetingId, rows));
    },
    [meetingId, runWrite],
  );

  return { meeting, attendance, loading, error, busy, reload: load, update, markAttendance };
}

export interface UseCreateMeetingReturn {
  creating: boolean;
  error: string | null;
  created: Meeting | null;
  create: (input: Omit<meetingService.CreateMeetingInput, 'clientRequestId'>) => Promise<Meeting | null>;
  reset: () => void;
}

export function useCreateMeeting(): UseCreateMeetingReturn {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Meeting | null>(null);

  const create = useCallback(
    async (input: Omit<meetingService.CreateMeetingInput, 'clientRequestId'>) => {
      setCreating(true);
      setError(null);
      try {
        const result = await meetingService.createMeeting({
          ...input,
          clientRequestId: generateClientId(),
        });
        setCreated(result);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create the meeting');
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
