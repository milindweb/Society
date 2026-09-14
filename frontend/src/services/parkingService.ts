/* parkingService.ts — FE-09 */

import { apiClient } from './apiClient';
import type { ParkingAllocation } from '@/types/domain';
import type { PaginationParams } from '@/types/api';

interface PaginatedResponse<T> {
  items: T[];
  page: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}

export async function listAllocations(params: PaginationParams & { parkingSlotId?: string; flatId?: string; statusKey?: string }): Promise<PaginatedResponse<ParkingAllocation>> {
  return apiClient({ action: 'parking.allocations.list', payload: params });
}

export async function createAllocation(data: Record<string, unknown>): Promise<ParkingAllocation> {
  return apiClient({ action: 'parking.allocations.create', payload: data });
}

export async function endAllocation(allocationId: string, endDate: string, reason?: string): Promise<ParkingAllocation> {
  return apiClient({ action: 'parking.allocations.end', payload: { allocationId, endDate, reason } });
}

export async function parkingSummary() {
  return apiClient({ action: 'parking.summary' });
}
