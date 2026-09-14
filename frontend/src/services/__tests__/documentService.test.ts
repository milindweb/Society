import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listDocuments, getDocument, createDocument, archiveDocument } from '../documentService';

const mockApiClient = vi.fn();
vi.mock('@/services/apiClient', () => ({ apiClient: (...args: unknown[]) => mockApiClient(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.mockResolvedValue({});
});

describe('documentService', () => {
  describe('listDocuments', () => {
    it('calls apiClient with documents.list and params', async () => {
      const params = { page: 1, pageSize: 10 };
      const response = { items: [{ id: 'doc1', title: 'Bylaws' }], page: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false } };
      mockApiClient.mockResolvedValue(response);
      const res = await listDocuments(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'documents.list',
        payload: params,
      });
      expect(res).toEqual(response);
    });

    it('passes optional categoryId, linkedEntityType, includeArchived', async () => {
      const params = { page: 1, categoryId: 'cat1', linkedEntityType: 'MEETING', includeArchived: true };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listDocuments(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'documents.list',
        payload: params,
      });
    });
  });

  describe('getDocument', () => {
    it('calls apiClient with documents.get and documentId', async () => {
      const doc = { id: 'doc1', title: 'Bylaws' };
      mockApiClient.mockResolvedValue(doc);
      const res = await getDocument('doc1');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'documents.get',
        payload: { documentId: 'doc1' },
      });
      expect(res).toEqual(doc);
    });
  });

  describe('createDocument', () => {
    it('calls apiClient with documents.create and data', async () => {
      const data = { title: 'Minutes', linkedEntityType: 'MEETING' };
      mockApiClient.mockResolvedValue({ id: 'doc2', ...data });
      const res = await createDocument(data);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'documents.create',
        payload: data,
      });
      expect(res).toEqual({ id: 'doc2', ...data });
    });
  });

  describe('archiveDocument', () => {
    it('calls apiClient with documents.archive, documentId, and reason', async () => {
      const result = { id: 'doc1', isArchived: true };
      mockApiClient.mockResolvedValue(result);
      const res = await archiveDocument('doc1', 'Superseded by new version');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'documents.archive',
        payload: { documentId: 'doc1', reason: 'Superseded by new version' },
      });
      expect(res).toEqual(result);
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('NOT_FOUND'));
      await expect(archiveDocument('doc1', 'reason')).rejects.toThrow('NOT_FOUND');
    });
  });
});
