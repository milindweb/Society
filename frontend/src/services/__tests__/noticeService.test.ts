import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listNotices, getNotice, createNotice, publishNotice, unpublishNotice } from '../noticeService';

const mockApiClient = vi.fn();
vi.mock('@/services/apiClient', () => ({ apiClient: (...args: unknown[]) => mockApiClient(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.mockResolvedValue({});
});

describe('noticeService', () => {
  describe('listNotices', () => {
    it('calls apiClient with notices.list and params', async () => {
      const params = { page: 1, pageSize: 10 };
      const response = { items: [{ id: 'n1', title: 'Meeting' }], page: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false } };
      mockApiClient.mockResolvedValue(response);
      const res = await listNotices(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'notices.list',
        payload: params,
      });
      expect(res).toEqual(response);
    });

    it('passes optional noticeTypeId and isPublished', async () => {
      const params = { page: 1, noticeTypeId: 'type1', isPublished: true };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listNotices(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'notices.list',
        payload: params,
      });
    });
  });

  describe('getNotice', () => {
    it('calls apiClient with notices.get and noticeId', async () => {
      const notice = { id: 'n1', title: 'AGM Notice' };
      mockApiClient.mockResolvedValue(notice);
      const res = await getNotice('n1');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'notices.get',
        payload: { noticeId: 'n1' },
      });
      expect(res).toEqual(notice);
    });
  });

  describe('createNotice', () => {
    it('calls apiClient with notices.create and data', async () => {
      const data = { title: 'Holiday Notice', body: 'Office closed' };
      mockApiClient.mockResolvedValue({ id: 'n2', ...data });
      const res = await createNotice(data);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'notices.create',
        payload: data,
      });
      expect(res).toEqual({ id: 'n2', ...data });
    });
  });

  describe('publishNotice', () => {
    it('calls apiClient with notices.publish, noticeId, publishDate, expiryDate', async () => {
      const result = { id: 'n1', isPublished: true };
      mockApiClient.mockResolvedValue(result);
      const res = await publishNotice('n1', '2026-09-15', '2026-10-15');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'notices.publish',
        payload: { noticeId: 'n1', publishDate: '2026-09-15', expiryDate: '2026-10-15' },
      });
      expect(res).toEqual(result);
    });

    it('sends undefined dates when not provided', async () => {
      mockApiClient.mockResolvedValue({});
      await publishNotice('n1');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'notices.publish',
        payload: { noticeId: 'n1', publishDate: undefined, expiryDate: undefined },
      });
    });
  });

  describe('unpublishNotice', () => {
    it('calls apiClient with notices.unpublish, noticeId, and reason', async () => {
      const result = { id: 'n1', isPublished: false };
      mockApiClient.mockResolvedValue(result);
      const res = await unpublishNotice('n1', 'Incorrect info');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'notices.unpublish',
        payload: { noticeId: 'n1', reason: 'Incorrect info' },
      });
      expect(res).toEqual(result);
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('NOT_FOUND'));
      await expect(unpublishNotice('n1', 'reason')).rejects.toThrow('NOT_FOUND');
    });
  });
});
