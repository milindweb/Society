/* flatService.ts — FE-05 */

import { apiClient } from './apiClient';
import type { Flat as FlatDomain } from '@/types/domain';
import type { PaginationParams } from '@/types/api';

interface PaginatedResponse<T> {
  items: T[];
  page: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}

export async function listFlats(params: PaginationParams & { wingId?: string; statusKey?: string }): Promise<PaginatedResponse<FlatDomain>> {
  return apiClient({ action: 'flats.list', payload: params as Record<string, unknown> });
}

export async function getFlat(flatId: string): Promise<FlatDomain> {
  return apiClient({ action: 'flats.get', payload: { flatId } });
}

export async function createFlat(data: Record<string, unknown>): Promise<FlatDomain> {
  return apiClient({ action: 'flats.create', payload: data });
}

export async function updateFlat(flatId: string, values: Record<string, unknown>): Promise<FlatDomain> {
  return apiClient({ action: 'flats.update', payload: { flatId, values } });
}
