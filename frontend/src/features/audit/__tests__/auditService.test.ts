/* auditService.test.ts — Tests for audit API service */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiClient from '@/services/apiClient';
import { listAuditEntries, getAuditEntry } from '@/services/backupService';

vi.mock('@/services/apiClient');

describe('auditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listAuditEntries', () => {
    it('calls apiClient with correct action and filters', async () => {
      const mockResult = {
        items: [],
        page: { page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      };

      vi.mocked(apiClient.apiClient).mockResolvedValue(mockResult);

      await listAuditEntries({
        page: 1,
        pageSize: 25,
        entity: 'Payment',
        action: 'PAYMENT_RECORDED',
        from: '2026-01-01',
        to: '2026-12-31',
      });

      expect(apiClient.apiClient).toHaveBeenCalledWith({
        action: 'audit.list',
        payload: {
          page: 1,
          pageSize: 25,
          entity: 'Payment',
          action: 'PAYMENT_RECORDED',
          from: '2026-01-01',
          to: '2026-12-31',
        },
      });
    });

    it('omits undefined filter values', async () => {
      vi.mocked(apiClient.apiClient).mockResolvedValue({
        items: [],
        page: { page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      });

      await listAuditEntries({ page: 1 });

      expect(apiClient.apiClient).toHaveBeenCalledWith({
        action: 'audit.list',
        payload: { page: 1 },
      });
    });
  });

  describe('getAuditEntry', () => {
    it('calls apiClient with auditId', async () => {
      const mockEntry = {
        auditId: 'AUD-001',
        entity: 'Payment',
        entityId: 'PAY-001',
        action: 'PAYMENT_RECORDED',
        actorUserId: 'USR-001',
        timestamp: '2026-09-15T10:00:00Z',
        before: null,
        after: { amount: 1000 },
      };

      vi.mocked(apiClient.apiClient).mockResolvedValue(mockEntry);

      const result = await getAuditEntry('AUD-001');

      expect(apiClient.apiClient).toHaveBeenCalledWith({
        action: 'audit.get',
        payload: { auditId: 'AUD-001' },
      });
      expect(result).toEqual(mockEntry);
    });
  });
});
