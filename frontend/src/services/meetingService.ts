/* meetingService.ts — FE-08 */

import { apiClient } from './apiClient';
import type { Meeting, MeetingAttendance } from '@/types/domain';
import type { PaginationParams } from '@/types/api';

interface PaginatedResponse<T> {
  items: T[];
  page: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}

export async function listMeetings(params: PaginationParams & { meetingTypeId?: string; statusKey?: string; from?: string; to?: string }): Promise<PaginatedResponse<Meeting>> {
  return apiClient({ action: 'meetings.list', payload: params });
}

export async function getMeeting(meetingId: string): Promise<Meeting & { attendance: MeetingAttendance[] }> {
  return apiClient({ action: 'meetings.get', payload: { meetingId } });
}

export async function createMeeting(data: Record<string, unknown>): Promise<Meeting> {
  return apiClient({ action: 'meetings.create', payload: data });
}

export async function markAttendance(meetingId: string, rows: Record<string, unknown>[]): Promise<MeetingAttendance[]> {
  return apiClient({ action: 'meetings.attendance.mark', payload: { meetingId, rows } });
}
