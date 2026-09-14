/* documentService.ts — FE-09 */

import { apiClient } from './apiClient';
import type { Document } from '@/types/domain';
import type { PaginationParams } from '@/types/api';

interface PaginatedResponse<T> {
  items: T[];
  page: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}

export async function listDocuments(params: PaginationParams & { categoryId?: string; linkedEntityType?: string; includeArchived?: boolean }): Promise<PaginatedResponse<Document>> {
  return apiClient({ action: 'documents.list', payload: params });
}

export async function getDocument(documentId: string): Promise<Document> {
  return apiClient({ action: 'documents.get', payload: { documentId } });
}

export async function createDocument(data: Record<string, unknown>): Promise<Document> {
  return apiClient({ action: 'documents.create', payload: data });
}

export async function archiveDocument(documentId: string, reason: string): Promise<Document> {
  return apiClient({ action: 'documents.archive', payload: { documentId, reason } });
}
