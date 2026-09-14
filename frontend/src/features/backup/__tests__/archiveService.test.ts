/* archiveService.test.ts — Tests for archive API service */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiClient from '@/services/apiClient';
import { runArchive, listArchives } from '@/services/backupService';

vi.mock('@/services/apiClient');

describe('archiveService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runArchive', () => {
    it('calls apiClient with correct action and payload', async () => {
      const mockResult = {
        movedCount: 5,
        skippedCount: 2,
        jobs: [{ entity: 'Demands', moved: 5, skipped: 2 }],
      };

      vi.mocked(apiClient.apiClient).mockResolvedValue(mockResult);

      const result = await runArchive({ entity: 'Demands', olderThanMonths: 12, dryRun: true });

      expect(apiClient.apiClient).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'archive.run',
          payload: expect.objectContaining({
            entity: 'Demands',
            olderThanMonths: 12,
            dryRun: true,
          }),
        }),
      );
      expect(result).toEqual(mockResult);
    });

    it('defaults dryRun to undefined when not provided', async () => {
      vi.mocked(apiClient.apiClient).mockResolvedValue({ movedCount: 0, skippedCount: 0, jobs: [] });

      await runArchive({ entity: 'Payments', olderThanMonths: 6 });

      expect(apiClient.apiClient).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            entity: 'Payments',
            olderThanMonths: 6,
          }),
        }),
      );
    });
  });

  describe('listArchives', () => {
    it('calls apiClient with entity filter', async () => {
      const mockResult = {
        items: [],
        page: { page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      };

      vi.mocked(apiClient.apiClient).mockResolvedValue(mockResult);

      await listArchives({ page: 1, pageSize: 25, entity: 'Complaints' });

      expect(apiClient.apiClient).toHaveBeenCalledWith({
        action: 'archive.list',
        payload: { page: 1, pageSize: 25, entity: 'Complaints' },
      });
    });
  });
});
