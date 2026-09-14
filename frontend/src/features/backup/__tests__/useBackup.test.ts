/* useBackup.test.ts — Tests for backup hooks */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBackupList, useBackupCreate } from '../hooks/useBackup';
import * as backupService from '@/services/backupService';

vi.mock('@/services/backupService');

describe('useBackupList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useBackupList());

    expect(result.current.backups).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fetches backups successfully', async () => {
    const mockBackups = [
      { backupId: 'BK-001', scope: 'FULL', checksum: 'abc', rowCount: 100, createdAt: '2026-09-15', createdBy: 'admin', fileRefs: [] },
    ];
    const mockPage = { page: 1, pageSize: 25, total: 1, totalPages: 1, hasNext: false, hasPrev: false };

    vi.mocked(backupService.listBackups).mockResolvedValue({ items: mockBackups, page: mockPage });

    const { result } = renderHook(() => useBackupList());

    await act(async () => {
      await result.current.fetchBackups(1);
    });

    expect(result.current.backups).toEqual(mockBackups);
    expect(result.current.page).toEqual(mockPage);
    expect(result.current.loading).toBe(false);
  });

  it('handles errors', async () => {
    vi.mocked(backupService.listBackups).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useBackupList());

    await act(async () => {
      await result.current.fetchBackups(1);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.backups).toEqual([]);
  });
});

describe('useBackupCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates backup successfully', async () => {
    const mockResult = {
      backupId: 'BK-002',
      scope: 'CONFIG',
      checksum: 'def',
      rowCount: 50,
      createdAt: '2026-09-15',
      createdBy: 'admin',
      fileRefs: [],
    };

    vi.mocked(backupService.createBackup).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useBackupCreate());

    let created;
    await act(async () => {
      created = await result.current.create('CONFIG', 'Test notes');
    });

    expect(created).toEqual(mockResult);
    expect(result.current.created).toEqual(mockResult);
    expect(result.current.loading).toBe(false);
  });

  it('handles creation errors', async () => {
    vi.mocked(backupService.createBackup).mockRejectedValue(new Error('Failed to create'));

    const { result } = renderHook(() => useBackupCreate());

    await act(async () => {
      await result.current.create('FULL');
    });

    expect(result.current.error).toBe('Failed to create');
    expect(result.current.created).toBeNull();
  });
});
