/* memberService.ts — FE-05 */

import { apiClient } from './apiClient';
import type { Member } from '@/types/domain';
import type { PaginationParams } from '@/types/api';

interface PaginatedResponse<T> {
  items: T[];
  page: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}

export async function listMembers(params: PaginationParams & { flatId?: string; relationType?: string; statusKey?: string }): Promise<PaginatedResponse<Member>> {
  return apiClient({ action: 'members.list', payload: params });
}

export async function getMember(memberId: string): Promise<Member> {
  return apiClient({ action: 'members.get', payload: { memberId } });
}

export async function createMember(data: Record<string, unknown>): Promise<Member> {
  return apiClient({ action: 'members.create', payload: data });
}

export async function updateMember(memberId: string, values: Record<string, unknown>): Promise<Member> {
  return apiClient({ action: 'members.update', payload: { memberId, values } });
}
