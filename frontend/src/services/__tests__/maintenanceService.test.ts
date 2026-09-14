import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listPeriods, listDemands, getDemand, generateDemands, demandsSummary } from '../maintenanceService';

const mockApiClient = vi.fn();
vi.mock('@/services/apiClient', () => ({ apiClient: (...args: unknown[]) => mockApiClient(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.mockResolvedValue({});
});

describe('maintenanceService', () => {
  describe('listPeriods', () => {
    it('calls apiClient with periods.list and pagination params', async () => {
      const params = { page: 1, pageSize: 25 };
      const response = { items: [{ key: '2026-09' }], page: { page: 1, pageSize: 25, total: 1, totalPages: 1, hasNext: false, hasPrev: false } };
      mockApiClient.mockResolvedValue(response);
      const res = await listPeriods(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'periods.list',
        payload: params,
      });
      expect(res).toEqual(response);
    });
  });

  describe('listDemands', () => {
    it('calls apiClient with demands.list and params', async () => {
      const params = { page: 1, periodKey: '2026-09' };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      const res = await listDemands(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'demands.list',
        payload: params,
      });
      expect(res).toEqual({ items: [], page: {} });
    });

    it('passes optional flatId and statusKey filters', async () => {
      const params = { page: 1, flatId: 'f1', statusKey: 'PENDING' };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listDemands(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'demands.list',
        payload: params,
      });
    });
  });

  describe('getDemand', () => {
    it('calls apiClient with demands.get and demandId', async () => {
      const demand = { id: 'd1', amount: 500 };
      mockApiClient.mockResolvedValue(demand);
      const res = await getDemand('d1');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'demands.get',
        payload: { demandId: 'd1' },
      });
      expect(res).toEqual(demand);
    });
  });

  describe('generateDemands', () => {
    it('calls apiClient with demands.generate, periodKey, flatIds, dryRun', async () => {
      mockApiClient.mockResolvedValue({ generated: 5 });
      const res = await generateDemands('2026-09', ['f1', 'f2'], true);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'demands.generate',
        payload: { periodKey: '2026-09', flatIds: ['f1', 'f2'], dryRun: true },
      });
      expect(res).toEqual({ generated: 5 });
    });

    it('sends undefined flatIds and dryRun when not provided', async () => {
      mockApiClient.mockResolvedValue({ generated: 10 });
      await generateDemands('2026-09');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'demands.generate',
        payload: { periodKey: '2026-09', flatIds: undefined, dryRun: undefined },
      });
    });
  });

  describe('demandsSummary', () => {
    it('calls apiClient with demands.summary and optional periodKey', async () => {
      const summary = { totalDemand: 50000 };
      mockApiClient.mockResolvedValue(summary);
      const res = await demandsSummary('2026-09');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'demands.summary',
        payload: { periodKey: '2026-09' },
      });
      expect(res).toEqual(summary);
    });

    it('sends undefined periodKey when not provided', async () => {
      mockApiClient.mockResolvedValue({});
      await demandsSummary();
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'demands.summary',
        payload: { periodKey: undefined },
      });
    });
  });
});
