import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLedger, ledgerSummary } from '../ledgerService';

const mockApiClient = vi.fn();
vi.mock('@/services/apiClient', () => ({ apiClient: (...args: unknown[]) => mockApiClient(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.mockResolvedValue({});
});

describe('ledgerService', () => {
  describe('getLedger', () => {
    it('calls apiClient with ledger.get and params', async () => {
      const params = { page: 1, pageSize: 20 };
      const response = { items: [{ id: 'l1', type: 'CREDIT' }], page: { page: 1, pageSize: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false } };
      mockApiClient.mockResolvedValue(response);
      const res = await getLedger(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'ledger.get',
        payload: params,
      });
      expect(res).toEqual(response);
    });

    it('passes optional flatId, periodKey, from, to', async () => {
      const params = { page: 1, flatId: 'f1', periodKey: '2026-09', from: '2026-01-01', to: '2026-12-31' };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await getLedger(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'ledger.get',
        payload: params,
      });
    });
  });

  describe('ledgerSummary', () => {
    it('calls apiClient with ledger.summary and flatId', async () => {
      const summary = [{ flatId: 'f1', balance: 5000 }];
      mockApiClient.mockResolvedValue(summary);
      const res = await ledgerSummary('f1');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'ledger.summary',
        payload: { flatId: 'f1' },
      });
      expect(res).toEqual(summary);
    });

    it('sends undefined flatId when not provided', async () => {
      mockApiClient.mockResolvedValue([]);
      await ledgerSummary();
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'ledger.summary',
        payload: { flatId: undefined },
      });
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('NOT_FOUND'));
      await expect(ledgerSummary('f1')).rejects.toThrow('NOT_FOUND');
    });
  });
});
