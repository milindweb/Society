import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listAllocations, createAllocation, endAllocation, parkingSummary } from '../parkingService';

const mockApiClient = vi.fn();
vi.mock('@/services/apiClient', () => ({ apiClient: (...args: unknown[]) => mockApiClient(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.mockResolvedValue({});
});

describe('parkingService', () => {
  describe('listAllocations', () => {
    it('calls apiClient with parking.allocations.list and params', async () => {
      const params = { page: 1, pageSize: 10 };
      const response = { items: [{ id: 'a1', slotNumber: 'S1' }], page: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false } };
      mockApiClient.mockResolvedValue(response);
      const res = await listAllocations(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'parking.allocations.list',
        payload: params,
      });
      expect(res).toEqual(response);
    });

    it('passes optional parkingSlotId, flatId, statusKey', async () => {
      const params = { page: 1, parkingSlotId: 'ps1', flatId: 'f1', statusKey: 'ACTIVE' };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listAllocations(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'parking.allocations.list',
        payload: params,
      });
    });
  });

  describe('createAllocation', () => {
    it('calls apiClient with parking.allocations.create and data', async () => {
      const data = { flatId: 'f1', parkingSlotId: 'ps1', vehicleNumber: 'MH12AB1234' };
      mockApiClient.mockResolvedValue({ id: 'a1', ...data });
      const res = await createAllocation(data);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'parking.allocations.create',
        payload: data,
      });
      expect(res).toEqual({ id: 'a1', ...data });
    });
  });

  describe('endAllocation', () => {
    it('calls apiClient with parking.allocations.end, allocationId, endDate, reason', async () => {
      const result = { id: 'a1', statusKey: 'ENDED' };
      mockApiClient.mockResolvedValue(result);
      const res = await endAllocation('a1', '2026-10-01', 'Relocated');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'parking.allocations.end',
        payload: { allocationId: 'a1', endDate: '2026-10-01', reason: 'Relocated' },
      });
      expect(res).toEqual(result);
    });

    it('sends undefined reason when not provided', async () => {
      mockApiClient.mockResolvedValue({});
      await endAllocation('a1', '2026-10-01');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'parking.allocations.end',
        payload: { allocationId: 'a1', endDate: '2026-10-01', reason: undefined },
      });
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('NOT_FOUND'));
      await expect(endAllocation('a1', '2026-10-01')).rejects.toThrow('NOT_FOUND');
    });
  });

  describe('parkingSummary', () => {
    it('calls apiClient with parking.summary', async () => {
      const summary = { totalSlots: 50, allocated: 30 };
      mockApiClient.mockResolvedValue(summary);
      const res = await parkingSummary();
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'parking.summary',
      });
      expect(res).toEqual(summary);
    });
  });
});
