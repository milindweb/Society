/* ledgerService.ts — FE-06 */

import { apiClient } from './apiClient';
import type { LedgerEntry, LedgerSummary } from '@/types/domain';
import type { PaginationParams } from '@/types/api';

interface PaginatedResponse<T> {
  items: T[];
  page: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}

export async function getLedger(params: PaginationParams & { flatId?: string; periodKey?: string; from?: string; to?: string }): Promise<PaginatedResponse<LedgerEntry>> {
  return apiClient({ action: 'ledger.get', payload: params });
}

export async function ledgerSummary(flatId?: string): Promise<LedgerSummary[]> {
  return apiClient({ action: 'ledger.summary', payload: { flatId } });
}
