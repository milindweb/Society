import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getReportCatalog, runReport, exportReport } from '../reportService';

const mockApiClient = vi.fn();
vi.mock('@/services/apiClient', () => ({ apiClient: (...args: unknown[]) => mockApiClient(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.mockResolvedValue({});
});

describe('reportService', () => {
  describe('getReportCatalog', () => {
    it('calls apiClient with reports.catalog action', async () => {
      const catalog = [{ key: 'ledger', name: 'Ledger Report' }];
      mockApiClient.mockResolvedValue(catalog);
      const res = await getReportCatalog();
      expect(mockApiClient).toHaveBeenCalledWith({ action: 'reports.catalog' });
      expect(res).toEqual(catalog);
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('INTERNAL_ERROR'));
      await expect(getReportCatalog()).rejects.toThrow('INTERNAL_ERROR');
    });
  });

  describe('runReport', () => {
    it('calls apiClient with reports.run, reportKey, filters, and pagination', async () => {
      const reportKey = 'ledger';
      const filters = { periodKey: '2026-09', flatId: 'f1' };
      const pagination = { page: 1, pageSize: 50 };
      const response = {
        items: [{ flatId: 'f1', balance: 5000 }],
        page: { page: 1, pageSize: 50, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockApiClient.mockResolvedValue(response);
      const res = await runReport(reportKey, filters, pagination);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'reports.run',
        payload: { reportKey, filters, ...pagination },
      });
      expect(res).toEqual(response);
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('VALIDATION_ERROR'));
      await expect(runReport('ledger', {}, { page: 1 })).rejects.toThrow('VALIDATION_ERROR');
    });
  });

  describe('exportReport', () => {
    it('calls apiClient with reports.export, reportKey, filters, and format CSV', async () => {
      const result = { url: '/exports/ledger.csv' };
      mockApiClient.mockResolvedValue(result);
      const res = await exportReport('ledger', { periodKey: '2026-09' }, 'CSV');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'reports.export',
        payload: { reportKey: 'ledger', filters: { periodKey: '2026-09' }, format: 'CSV' },
      });
      expect(res).toEqual(result);
    });

    it('calls apiClient with reports.export and format XLS', async () => {
      const result = { url: '/exports/ledger.xls' };
      mockApiClient.mockResolvedValue(result);
      const res = await exportReport('ledger', {}, 'XLS');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'reports.export',
        payload: { reportKey: 'ledger', filters: {}, format: 'XLS' },
      });
      expect(res).toEqual(result);
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('NOT_FOUND'));
      await expect(exportReport('invalid', {}, 'CSV')).rejects.toThrow('NOT_FOUND');
    });
  });
});