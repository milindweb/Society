/* backupService.test.ts — Tests for backup API service */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiClient from '@/services/apiClient';
import { createBackup, listBackups } from '@/services/backupService';

vi.mock('@/services/apiClient');

describe('backupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBackup', () => {
    it('calls apiClient with correct action and payload', async () => {
      const mockResult = {
        backupId: 'BK-001',
        scope: 'FULL',
        createdAt: '2026-09-15T10:00:00Z',
        createdBy: 'admin',
        checksum: 'abc123',
        rowCount: 100,
        fileRefs: [],
      };

      vi.mocked(apiClient.apiClient).mockResolvedValue(mockResult);

      const result = await createBackup({ scope: 'FULL', notes: 'Test backup' });

      expect(apiClient.apiClient).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'backup.create',
          payload: expect.objectContaining({
            scope: 'FULL',
            notes: 'Test backup',
          }),
        }),
      );
      expect(result).toEqual(mockResult);
    });

    it('generates clientRequestId for idempotency', async () => {
      vi.mocked(apiClient.apiClient).mockResolvedValue({});

      await createBackup({ scope: 'CONFIG' });

      expect(apiClient.apiClient).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            clientRequestId: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('listBackups', () => {
    it('calls apiClient with pagination params', async () => {
      const mockResult = {
        items: [],
        page: { page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      };

      vi.mocked(apiClient.apiClient).mockResolvedValue(mockResult);

      const result = await listBackups({ page: 1, pageSize: 25 });

      expect(apiClient.apiClient).toHaveBeenCalledWith({
        action: 'backup.list',
        payload: { page: 1, pageSize: 25 },
      });
      expect(result).toEqual(mockResult);
    });
  });
});
