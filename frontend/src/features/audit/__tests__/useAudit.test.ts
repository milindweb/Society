/* useAudit.test.ts — Tests for audit hooks */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuditList, useAuditDetail } from '../hooks/useAudit';
import * as backupService from '@/services/backupService';

vi.mock('@/services/backupService');

describe('useAuditList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches audit entries with filters', async () => {
    const mockEntries = [
      { auditId: 'AUD-001', entity: 'Payment', entityId: 'PAY-001', action: 'PAYMENT_RECORDED', actorUserId: 'USR-001', timestamp: '2026-09-15' },
    ];
    const mockPage = { page: 1, pageSize: 25, total: 1, totalPages: 1, hasNext: false, hasPrev: false };

    vi.mocked(backupService.listAuditEntries).mockResolvedValue({ items: mockEntries, page: mockPage });

    const { result } = renderHook(() => useAuditList());

    await act(async () => {
      await result.current.fetchEntries({
        page: 1,
        entity: 'Payment',
        action: 'PAYMENT_RECORDED',
      });
    });

    expect(result.current.entries).toEqual(mockEntries);
    expect(backupService.listAuditEntries).toHaveBeenCalledWith({
      page: 1,
      pageSize: 25,
      entity: 'Payment',
      action: 'PAYMENT_RECORDED',
      entityId: undefined,
      from: undefined,
      to: undefined,
      actorUserId: undefined,
    });
  });

  it('handles errors', async () => {
    vi.mocked(backupService.listAuditEntries).mockRejectedValue(new Error('Audit load failed'));

    const { result } = renderHook(() => useAuditList());

    await act(async () => {
      await result.current.fetchEntries();
    });

    expect(result.current.error).toBe('Audit load failed');
    expect(result.current.entries).toEqual([]);
  });
});

describe('useAuditDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches single audit entry', async () => {
    const mockEntry = {
      auditId: 'AUD-001',
      entity: 'Payment',
      entityId: 'PAY-001',
      action: 'PAYMENT_RECORDED',
      actorUserId: 'USR-001',
      actorName: 'Admin',
      timestamp: '2026-09-15T10:00:00Z',
      before: undefined,
      after: { amount: 1000, status: 'POSTED' },
    };

    vi.mocked(backupService.getAuditEntry).mockResolvedValue(mockEntry);

    const { result } = renderHook(() => useAuditDetail());

    await act(async () => {
      await result.current.fetchEntry('AUD-001');
    });

    expect(result.current.entry).toEqual(mockEntry);
    expect(backupService.getAuditEntry).toHaveBeenCalledWith('AUD-001');
  });

  it('handles errors', async () => {
    vi.mocked(backupService.getAuditEntry).mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useAuditDetail());

    await act(async () => {
      await result.current.fetchEntry('AUD-999');
    });

    expect(result.current.error).toBe('Not found');
    expect(result.current.entry).toBeNull();
  });
});
