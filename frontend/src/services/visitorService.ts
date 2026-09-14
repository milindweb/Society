/* visitorService.ts — FE-07 */

import { apiClient } from './apiClient';
import type { Visitor } from '@/types/domain';
import type { PaginationParams } from '@/types/api';

interface PaginatedResponse<T> {
  items: T[];
  page: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}

export async function listVisitors(params: PaginationParams & { statusKey?: string; from?: string; to?: string; flatId?: string; typeKey?: string }): Promise<PaginatedResponse<Visitor>> {
  return apiClient({ action: 'visitors.list', payload: params });
}

export async function getVisitor(visitorId: string): Promise<Visitor> {
  return apiClient({ action: 'visitors.get', payload: { visitorId } });
}

export async function createVisitor(data: Record<string, unknown>): Promise<Visitor> {
  return apiClient({ action: 'visitors.create', payload: data });
}

export async function exitVisitor(visitorId: string, exitGate?: string, remarks?: string): Promise<Visitor> {
  return apiClient({ action: 'visitors.exit', payload: { visitorId, exitGate, remarks } });
}
