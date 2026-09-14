import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listMeetings, getMeeting, createMeeting, markAttendance } from '../meetingService';

const mockApiClient = vi.fn();
vi.mock('@/services/apiClient', () => ({ apiClient: (...args: unknown[]) => mockApiClient(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.mockResolvedValue({});
});

describe('meetingService', () => {
  describe('listMeetings', () => {
    it('calls apiClient with meetings.list and params', async () => {
      const params = { page: 1, pageSize: 10 };
      const response = { items: [{ id: 'mt1', title: 'AGM' }], page: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false } };
      mockApiClient.mockResolvedValue(response);
      const res = await listMeetings(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'meetings.list',
        payload: params,
      });
      expect(res).toEqual(response);
    });

    it('passes optional meetingTypeId, statusKey, from, to', async () => {
      const params = { page: 1, meetingTypeId: 'type1', statusKey: 'SCHEDULED', from: '2026-09-01', to: '2026-09-30' };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listMeetings(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'meetings.list',
        payload: params,
      });
    });
  });

  describe('getMeeting', () => {
    it('calls apiClient with meetings.get and meetingId', async () => {
      const meeting = { id: 'mt1', title: 'AGM', attendance: [] };
      mockApiClient.mockResolvedValue(meeting);
      const res = await getMeeting('mt1');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'meetings.get',
        payload: { meetingId: 'mt1' },
      });
      expect(res).toEqual(meeting);
    });
  });

  describe('createMeeting', () => {
    it('calls apiClient with meetings.create and data', async () => {
      const data = { title: 'Board Meeting', scheduledAt: '2026-09-20T10:00:00Z' };
      mockApiClient.mockResolvedValue({ id: 'mt2', ...data });
      const res = await createMeeting(data);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'meetings.create',
        payload: data,
      });
      expect(res).toEqual({ id: 'mt2', ...data });
    });
  });

  describe('markAttendance', () => {
    it('calls apiClient with meetings.attendance.mark, meetingId, and rows', async () => {
      const rows = [{ memberId: 'm1', present: true }, { memberId: 'm2', present: false }];
      const result = [{ memberId: 'm1', present: true }, { memberId: 'm2', present: false }];
      mockApiClient.mockResolvedValue(result);
      const res = await markAttendance('mt1', rows);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'meetings.attendance.mark',
        payload: { meetingId: 'mt1', rows },
      });
      expect(res).toEqual(result);
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('CONFLICT_ERROR'));
      await expect(markAttendance('mt1', [])).rejects.toThrow('CONFLICT_ERROR');
    });
  });
});
