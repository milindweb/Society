import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDashboardSummary } from '../dashboardService';

const mockApiClient = vi.fn();
vi.mock('@/services/apiClient', () => ({ apiClient: (...args: unknown[]) => mockApiClient(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.mockResolvedValue({});
});

describe('dashboardService', () => {
  describe('getDashboardSummary', () => {
    it('calls apiClient with dashboard.summary and empty periodKey', async () => {
      const summary = { totalFlats: 10, totalMembers: 25 };
      mockApiClient.mockResolvedValue(summary);
      const res = await getDashboardSummary();
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'dashboard.summary',
        payload: { periodKey: undefined },
      });
      expect(res).toEqual(summary);
    });

    it('passes periodKey when provided', async () => {
      const summary = { totalFlats: 10 };
      mockApiClient.mockResolvedValue(summary);
      const res = await getDashboardSummary('2026-09');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'dashboard.summary',
        payload: { periodKey: '2026-09' },
      });
      expect(res).toEqual(summary);
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('INTERNAL_ERROR'));
      await expect(getDashboardSummary()).rejects.toThrow('INTERNAL_ERROR');
    });
  });
});
