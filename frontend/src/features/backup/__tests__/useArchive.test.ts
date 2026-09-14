/* useArchive.test.ts — Tests for archive hooks */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useArchiveRun, useArchiveList } from '../hooks/useArchive';
import * as backupService from '@/services/backupService';

vi.mock('@/services/backupService');

describe('useArchiveRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs archive successfully', async () => {
    const mockResult = {
      movedCount: 10,
      skippedCount: 3,
      jobs: [{ entity: 'Demands', moved: 10, skipped: 3 }],
    };

    vi.mocked(backupService.runArchive).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useArchiveRun());

    let archiveResult;
    await act(async () => {
      archiveResult = await result.current.run('Demands', 12, true);
    });

    expect(archiveResult).toEqual(mockResult);
    expect(result.current.result).toEqual(mockResult);
    expect(backupService.runArchive).toHaveBeenCalledWith({
      entity: 'Demands',
      olderThanMonths: 12,
      dryRun: true,
    });
  });

  it('handles errors', async () => {
    vi.mocked(backupService.runArchive).mockRejectedValue(new Error('Archive failed'));

    const { result } = renderHook(() => useArchiveRun());

    await act(async () => {
      await result.current.run('Payments', 6, false);
    });

    expect(result.current.error).toBe('Archive failed');
    expect(result.current.result).toBeNull();
  });
});

describe('useArchiveList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches archives with entity filter', async () => {
    const mockArchives = [
      { archiveId: 'ARC-001', originalEntity: 'Demands', originalId: 'DM-001', archivedAt: '2026-09-15' },
    ];
    const mockPage = { page: 1, pageSize: 25, total: 1, totalPages: 1, hasNext: false, hasPrev: false };

    vi.mocked(backupService.listArchives).mockResolvedValue({ items: mockArchives, page: mockPage });

    const { result } = renderHook(() => useArchiveList());

    await act(async () => {
      await result.current.fetchArchives(1, 25, 'Demands');
    });

    expect(result.current.archives).toEqual(mockArchives);
    expect(backupService.listArchives).toHaveBeenCalledWith({
      page: 1,
      pageSize: 25,
      entity: 'Demands',
    });
  });
});
