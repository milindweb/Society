/* meetingService.ts — FE-08 meetings & attendance
 * Verified against backend/src/{CommunicationService,Routes,Schema}.gs.
 *
 * Server-enforced rules the UI must respect:
 * - `meetings.create` requires meetingTypeKey, title, meetingDate + clientRequestId,
 *   and always creates with statusKey SCHEDULED. (`meetingTypeKey` is a TYPE KEY
 *   — e.g. AGM — validated against Meeting_Types, not a row id.)
 * - `meetings.update` patches only: title, meetingDate, startTime, endTime, venue,
 *   agenda, minutes, resolutions, quorumRequired, conductedBy, linkedDocumentIds
 *   (+ meetingTypeKey and statusKey, both validated). statusKey must be one of
 *   SCHEDULED | COMPLETED | CANCELLED | POSTPONED.
 * - `meetings.get` returns the meeting WITH `attendance[]` and resolved
 *   `linkedDocuments[]` (SRS §8: meeting documents live in the Documents module).
 * - `meetings.list` filters on meetingTypeId (mapped to meetingTypeKey server-side)
 *   and statusKey only. There is NO server-side date-range filter.
 * - `meetings.attendance.mark` takes {meetingId, rows[]}; each row needs an
 *   attendeeType (MEMBER | EMPLOYEE | VENDOR | GUEST) and either attendeeId or
 *   attendeeName, and it returns `{attendance, quorumPresent}` — an OBJECT, not an
 *   array. It also overwrites the meeting's quorumPresent with the count of rows
 *   marked present in THAT call.
 * - Attendance routes do NOT require a clientRequestId (no requireClientId). */

import { apiClient } from './apiClient';
import type { Meeting, MeetingDetail, MeetingAttendance } from '@/types/domain';
import type { Paginated, PaginationParams } from '@/types/api';

export interface MeetingFilters extends PaginationParams {
  /** Mapped to `meetingTypeKey` by the server. */
  meetingTypeId?: string;
  statusKey?: string;
}

export async function listMeetings(params: MeetingFilters): Promise<Paginated<Meeting>> {
  return apiClient<Paginated<Meeting>>({ action: 'meetings.list', payload: params });
}

export async function getMeeting(meetingId: string): Promise<MeetingDetail> {
  return apiClient<MeetingDetail>({ action: 'meetings.get', payload: { meetingId } });
}

/** `meetings.create` — the three required fields, plus everything optional. */
export interface CreateMeetingInput {
  /** A Meeting_Types.typeKey. */
  meetingTypeKey: string;
  title: string;
  meetingDate: string;
  startTime?: string;
  endTime?: string;
  venue?: string;
  agenda?: string;
  quorumRequired?: string;
  conductedBy?: string;
  clientRequestId: string;
}

export async function createMeeting(data: CreateMeetingInput): Promise<Meeting> {
  return apiClient<Meeting>({ action: 'meetings.create', payload: data });
}

/** The patchable surface; the service silently ignores anything else. */
export interface UpdateMeetingInput {
  meetingId: string;
  meetingTypeKey?: string;
  title?: string;
  meetingDate?: string;
  startTime?: string;
  endTime?: string;
  venue?: string;
  agenda?: string;
  /** Filled in as the meeting concludes. */
  minutes?: string;
  resolutions?: string;
  quorumRequired?: string;
  conductedBy?: string;
  linkedDocumentIds?: string;
  statusKey?: string;
  clientRequestId: string;
}

export async function updateMeeting(data: UpdateMeetingInput): Promise<Meeting> {
  return apiClient<Meeting>({ action: 'meetings.update', payload: data });
}

export async function listAttendance(meetingId: string): Promise<MeetingAttendance[]> {
  return apiClient<MeetingAttendance[]>({
    action: 'meetings.attendance.list',
    payload: { meetingId },
  });
}

/** One attendance row as the server expects it. */
export interface AttendanceRowInput {
  attendeeType: string;
  /** Either `attendeeId` or `attendeeName` is required by the service. */
  attendeeId?: string;
  attendeeName?: string;
  flatId?: string;
  roleInMeeting?: string;
  isPresent?: boolean;
  remarks?: string;
}

export interface MarkAttendanceResult {
  attendance: MeetingAttendance[];
  /** How many rows in THIS call were marked present; the server writes it to
   * the meeting's `quorumPresent`, replacing whatever was there before. */
  quorumPresent: number;
}

export async function markAttendance(
  meetingId: string,
  rows: AttendanceRowInput[],
): Promise<MarkAttendanceResult> {
  return apiClient<MarkAttendanceResult>({
    action: 'meetings.attendance.mark',
    payload: { meetingId, rows },
  });
}

/* ── Mirrors of the service's own rules (the backend stays the authority) ── */

/** The statuses `meetings.update` accepts. */
export const MEETING_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'POSTPONED'] as const;

/** Minutes/resolutions only make sense once a meeting has actually happened. */
export function canRecordMinutes(statusKey: string): boolean {
  return statusKey === 'COMPLETED' || statusKey === 'SCHEDULED';
}

/** Attendance is meaningless for a cancelled or postponed meeting. */
export function canMarkAttendance(statusKey: string): boolean {
  return statusKey === 'SCHEDULED' || statusKey === 'COMPLETED';
}

/** The sheet stores 'TRUE' / 'FALSE' strings; tolerate a real boolean too. */
export function isPresentFlag(value: unknown): boolean {
  return value === true || value === 'TRUE' || value === 'true';
}
