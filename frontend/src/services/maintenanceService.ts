/* maintenanceService.ts — FE-06 */

import { apiClient } from './apiClient';
import type { BillingPeriod, Demand } from '@/types/domain';
import type { PaginationParams } from '@/types/api';

interface PaginatedResponse<T> {
  items: T[];
  page: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}

export async function listPeriods(params: PaginationParams): Promise<PaginatedResponse<BillingPeriod>> {
  return apiClient({ action: 'periods.list', payload: params });
}

export async function listDemands(params: PaginationParams & { periodKey?: string; flatId?: string; statusKey?: string }): Promise<PaginatedResponse<Demand>> {
  return apiClient({ action: 'demands.list', payload: params });
}

export async function getDemand(demandId: string): Promise<Demand> {
  return apiClient({ action: 'demands.get', payload: { demandId } });
}

export async function generateDemands(periodKey: string, flatIds?: string[], dryRun?: boolean) {
  return apiClient({ action: 'demands.generate', payload: { periodKey, flatIds, dryRun } });
}

export async function demandsSummary(periodKey?: string) {
  return apiClient({ action: 'demands.summary', payload: { periodKey } });
}
