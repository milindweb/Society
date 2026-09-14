/* noticeService.ts — FE-08 */

import { apiClient } from './apiClient';
import type { Notice } from '@/types/domain';
import type { PaginationParams } from '@/types/api';

interface PaginatedResponse<T> {
  items: T[];
  page: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}

export async function listNotices(params: PaginationParams & { noticeTypeId?: string; isPublished?: boolean }): Promise<PaginatedResponse<Notice>> {
  return apiClient({ action: 'notices.list', payload: params });
}

export async function getNotice(noticeId: string): Promise<Notice> {
  return apiClient({ action: 'notices.get', payload: { noticeId } });
}

export async function createNotice(data: Record<string, unknown>): Promise<Notice> {
  return apiClient({ action: 'notices.create', payload: data });
}

export async function publishNotice(noticeId: string, publishDate?: string, expiryDate?: string): Promise<Notice> {
  return apiClient({ action: 'notices.publish', payload: { noticeId, publishDate, expiryDate } });
}

export async function unpublishNotice(noticeId: string, reason: string): Promise<Notice> {
  return apiClient({ action: 'notices.unpublish', payload: { noticeId, reason } });
}
