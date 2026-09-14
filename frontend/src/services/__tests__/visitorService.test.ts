import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listVisitors, getVisitor, createVisitor, exitVisitor } from '../visitorService';

const mockApiClient = vi.fn();
vi.mock('@/services/apiClient', () => ({ apiClient: (...args: unknown[]) => mockApiClient(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.mockResolvedValue({});
});

describe('visitorService', () => {
  describe('listVisitors', () => {
    it('calls apiClient with visitors.list and params', async () => {
      const params = { page: 1, pageSize: 10 };
      const response = { items: [{ id: 'v1', name: 'Guest' }], page: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false } };
      mockApiClient.mockResolvedValue(response);
      const res = await listVisitors(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'visitors.list',
        payload: params,
      });
      expect(res).toEqual(response);
    });

    it('passes optional statusKey, from, to, flatId, typeKey', async () => {
      const params = { page: 1, statusKey: 'INSIDE', from: '2026-09-01', to: '2026-09-15', flatId: 'f1', typeKey: 'VENDOR' };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listVisitors(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'visitors.list',
        payload: params,
      });
    });
  });

  describe('getVisitor', () => {
    it('calls apiClient with visitors.get and visitorId', async () => {
      const visitor = { id: 'v1', name: 'Guest' };
      mockApiClient.mockResolvedValue(visitor);
      const res = await getVisitor('v1');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'visitors.get',
        payload: { visitorId: 'v1' },
      });
      expect(res).toEqual(visitor);
    });
  });

  describe('createVisitor', () => {
    it('calls apiClient with visitors.create and data', async () => {
      const data = { name: 'Delivery', flatId: 'f1', typeKey: 'DELIVERY' };
      mockApiClient.mockResolvedValue({ id: 'v2', ...data });
      const res = await createVisitor(data);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'visitors.create',
        payload: data,
      });
      expect(res).toEqual({ id: 'v2', ...data });
    });
  });

  describe('exitVisitor', () => {
    it('calls apiClient with visitors.exit, visitorId, exitGate, remarks', async () => {
      const result = { id: 'v1', statusKey: 'EXITED' };
      mockApiClient.mockResolvedValue(result);
      const res = await exitVisitor('v1', 'MAIN_GATE', 'Left at 5pm');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'visitors.exit',
        payload: { visitorId: 'v1', exitGate: 'MAIN_GATE', remarks: 'Left at 5pm' },
      });
      expect(res).toEqual(result);
    });

    it('sends undefined exitGate and remarks when not provided', async () => {
      mockApiClient.mockResolvedValue({});
      await exitVisitor('v1');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'visitors.exit',
        payload: { visitorId: 'v1', exitGate: undefined, remarks: undefined },
      });
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('NOT_FOUND'));
      await expect(exitVisitor('v1', 'G1')).rejects.toThrow('NOT_FOUND');
    });
  });
});
