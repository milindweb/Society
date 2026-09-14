/* reportService.ts — FE-12 */

import { apiClient } from './apiClient';
import type { PaginationParams } from '@/types/api';

interface PaginatedResponse<T> {
  items: T[];
  page: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}

export async function getReportCatalog() {
  return apiClient({ action: 'reports.catalog' });
}

export async function runReport(reportKey: string, filters: Record<string, unknown>, pagination: PaginationParams): Promise<PaginatedResponse<Record<string, unknown>>> {
  return apiClient({ action: 'reports.run', payload: { reportKey, filters, ...pagination } });
}

export async function exportReport(reportKey: string, filters: Record<string, unknown>, format: 'CSV' | 'XLS') {
  return apiClient({ action: 'reports.export', payload: { reportKey, filters, format } });
}
