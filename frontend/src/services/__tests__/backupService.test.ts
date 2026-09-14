import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createBackup,
  listBackups,
  runArchive,
  listArchives,
  listAuditEntries,
  getAuditEntry,
} from '../backupService';

const mockApiClient = vi.fn();
vi.mock('@/services/apiClient', () => ({ apiClient: (...args: unknown[]) => mockApiClient(...args) }));

vi.mock('@/lib/idempotency', () => ({ generateClientId: () => 'test-client-id' }));

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.mockResolvedValue({});
});

describe('backupService', () => {
  describe('createBackup', () => {
    it('calls apiClient with backup.create, scope, notes, and clientRequestId', async () => {
      const payload = { scope: 'FULL' as const, notes: 'Monthly backup' };
      const result = { id: 'b1', scope: 'FULL', status: 'COMPLETED' };
      mockApiClient.mockResolvedValue(result);
      const res = await createBackup(payload);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'backup.create',
        payload: { scope: 'FULL', notes: 'Monthly backup', clientRequestId: 'test-client-id' },
      });
      expect(res).toEqual(result);
    });

    it('sends undefined notes when not provided', async () => {
      const payload = { scope: 'CONFIG' as const };
      mockApiClient.mockResolvedValue({});
      await createBackup(payload);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'backup.create',
        payload: { scope: 'CONFIG', notes: undefined, clientRequestId: 'test-client-id' },
      });
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('INTERNAL_ERROR'));
      await expect(createBackup({ scope: 'FULL' })).rejects.toThrow('INTERNAL_ERROR');
    });
  });

  describe('listBackups', () => {
    it('calls apiClient with backup.list and pagination params', async () => {
      const params = { page: 1, pageSize: 10 };
      const response = {
        items: [{ id: 'b1', scope: 'FULL' }],
        page: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockApiClient.mockResolvedValue(response);
      const res = await listBackups(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'backup.list',
        payload: params,
      });
      expect(res).toEqual(response);
    });

    it('calls apiClient without params when not provided', async () => {
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listBackups();
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'backup.list',
        payload: undefined,
      });
    });
  });

  describe('runArchive', () => {
    it('calls apiClient with archive.run, entity, olderThanMonths, dryRun, and clientRequestId', async () => {
      const payload = { entity: 'payments', olderThanMonths: 12, dryRun: true };
      const result = { movedCount: 50, skippedCount: 5, jobs: [{ entity: 'payments', moved: 50, skipped: 5 }] };
      mockApiClient.mockResolvedValue(result);
      const res = await runArchive(payload);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'archive.run',
        payload: { entity: 'payments', olderThanMonths: 12, dryRun: true, clientRequestId: 'test-client-id' },
      });
      expect(res).toEqual(result);
    });

    it('sends undefined optional fields when not provided', async () => {
      const payload = {};
      mockApiClient.mockResolvedValue({});
      await runArchive(payload);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'archive.run',
        payload: { entity: undefined, olderThanMonths: undefined, dryRun: undefined, clientRequestId: 'test-client-id' },
      });
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('VALIDATION_ERROR'));
      await expect(runArchive({})).rejects.toThrow('VALIDATION_ERROR');
    });
  });

  describe('listArchives', () => {
    it('calls apiClient with archive.list and pagination params', async () => {
      const params = { page: 1, pageSize: 20 };
      const response = {
        items: [{ id: 'a1', entity: 'payments' }],
        page: { page: 1, pageSize: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockApiClient.mockResolvedValue(response);
      const res = await listArchives(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'archive.list',
        payload: params,
      });
      expect(res).toEqual(response);
    });

    it('passes optional entity and originalId filters', async () => {
      const params = { page: 1, entity: 'payments', originalId: 'p1' };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listArchives(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'archive.list',
        payload: params,
      });
    });

    it('calls apiClient without params when not provided', async () => {
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listArchives();
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'archive.list',
        payload: undefined,
      });
    });
  });

  describe('listAuditEntries', () => {
    it('calls apiClient with audit.list and pagination params', async () => {
      const params = { page: 1, pageSize: 25 };
      const response = {
        items: [{ id: 'aud1', action: 'CREATE' }],
        page: { page: 1, pageSize: 25, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockApiClient.mockResolvedValue(response);
      const res = await listAuditEntries(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'audit.list',
        payload: params,
      });
      expect(res).toEqual(response);
    });

    it('passes optional entity, entityId, action, from, to, actorUserId filters', async () => {
      const params = {
        page: 1,
        entity: 'flats',
        entityId: 'f1',
        action: 'UPDATE',
        from: '2026-01-01',
        to: '2026-12-31',
        actorUserId: 'u1',
      };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listAuditEntries(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'audit.list',
        payload: params,
      });
    });

    it('calls apiClient without params when not provided', async () => {
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listAuditEntries();
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'audit.list',
        payload: undefined,
      });
    });
  });

  describe('getAuditEntry', () => {
    it('calls apiClient with audit.get and auditId', async () => {
      const entry = { id: 'aud1', action: 'CREATE', entity: 'flats' };
      mockApiClient.mockResolvedValue(entry);
      const res = await getAuditEntry('aud1');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'audit.get',
        payload: { auditId: 'aud1' },
      });
      expect(res).toEqual(entry);
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('NOT_FOUND'));
      await expect(getAuditEntry('aud1')).rejects.toThrow('NOT_FOUND');
    });
  });
});