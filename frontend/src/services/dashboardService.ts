/* dashboardService.ts — FE-04 */

import { apiClient } from './apiClient';
import type { DashboardSummary } from '@/types/domain';

export async function getDashboardSummary(periodKey?: string): Promise<DashboardSummary> {
  return apiClient({ action: 'dashboard.summary', payload: { periodKey } });
}
