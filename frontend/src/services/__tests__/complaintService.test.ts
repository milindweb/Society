import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listComplaints, getComplaint, createComplaint, assignComplaint, transitionComplaint } from '../complaintService';

const mockApiClient = vi.fn();
vi.mock('@/services/apiClient', () => ({ apiClient: (...args: unknown[]) => mockApiClient(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.mockResolvedValue({});
});

describe('complaintService', () => {
  describe('listComplaints', () => {
    it('calls apiClient with complaints.list and params', async () => {
      const params = { page: 1, pageSize: 20 };
      const response = { items: [{ id: 'c1', title: 'Leak' }], page: { page: 1, pageSize: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false } };
      mockApiClient.mockResolvedValue(response);
      const res = await listComplaints(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'complaints.list',
        payload: params,
      });
      expect(res).toEqual(response);
    });

    it('passes optional statusKey, categoryId, priorityKey, flatId', async () => {
      const params = { page: 1, statusKey: 'OPEN', categoryId: 'cat1', priorityKey: 'HIGH', flatId: 'f1' };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listComplaints(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'complaints.list',
        payload: params,
      });
    });
  });

  describe('getComplaint', () => {
    it('calls apiClient with complaints.get and complaintId', async () => {
      const complaint = { id: 'c1', title: 'Leak', updates: [] };
      mockApiClient.mockResolvedValue(complaint);
      const res = await getComplaint('c1');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'complaints.get',
        payload: { complaintId: 'c1' },
      });
      expect(res).toEqual(complaint);
    });
  });

  describe('createComplaint', () => {
    it('calls apiClient with complaints.create and data', async () => {
      const data = { title: 'Noise', flatId: 'f1' };
      mockApiClient.mockResolvedValue({ id: 'c2', ...data });
      const res = await createComplaint(data);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'complaints.create',
        payload: data,
      });
      expect(res).toEqual({ id: 'c2', ...data });
    });
  });

  describe('assignComplaint', () => {
    it('calls apiClient with complaints.assign, complaintId, and data merged', async () => {
      const data = { assigneeId: 'a1', remarks: 'Assigned to vendor' };
      mockApiClient.mockResolvedValue({ id: 'c1', ...data });
      const res = await assignComplaint('c1', data);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'complaints.assign',
        payload: { complaintId: 'c1', ...data },
      });
      expect(res).toEqual({ id: 'c1', ...data });
    });
  });

  describe('transitionComplaint', () => {
    it('calls apiClient with complaints.transition, complaintId, statusKey, remarks, correctiveAction', async () => {
      const result = { id: 'c1', statusKey: 'RESOLVED' };
      mockApiClient.mockResolvedValue(result);
      const res = await transitionComplaint('c1', 'RESOLVED', 'Fixed the leak', 'Applied sealant');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'complaints.transition',
        payload: {
          complaintId: 'c1',
          statusKey: 'RESOLVED',
          remarks: 'Fixed the leak',
          correctiveAction: 'Applied sealant',
        },
      });
      expect(res).toEqual(result);
    });

    it('sends undefined correctiveAction when not provided', async () => {
      mockApiClient.mockResolvedValue({});
      await transitionComplaint('c1', 'IN_PROGRESS', 'Acknowledged');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'complaints.transition',
        payload: {
          complaintId: 'c1',
          statusKey: 'IN_PROGRESS',
          remarks: 'Acknowledged',
          correctiveAction: undefined,
        },
      });
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('CONFLICT_ERROR'));
      await expect(transitionComplaint('c1', 'CLOSED', 'done')).rejects.toThrow('CONFLICT_ERROR');
    });
  });
});
