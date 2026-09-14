/* expenseService.ts — FE-11 */

import { apiClient } from './apiClient';
import type { Expense } from '@/types/domain';
import type { PaginationParams } from '@/types/api';

interface PaginatedResponse<T> {
  items: T[];
  page: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}

export async function listExpenses(params: PaginationParams & { categoryId?: string; vendorId?: string; from?: string; to?: string; statusKey?: string }): Promise<PaginatedResponse<Expense>> {
  return apiClient({ action: 'expenses.list', payload: params });
}

export async function getExpense(expenseId: string): Promise<Expense> {
  return apiClient({ action: 'expenses.get', payload: { expenseId } });
}

export async function createExpense(data: Record<string, unknown>): Promise<Expense> {
  return apiClient({ action: 'expenses.create', payload: data });
}

export async function cancelExpense(expenseId: string, reason: string): Promise<Expense> {
  return apiClient({ action: 'expenses.cancel', payload: { expenseId, reason } });
}

export async function expenseSummary(params: { periodKey?: string; from?: string; to?: string; categoryId?: string; vendorId?: string }) {
  return apiClient({ action: 'expenses.summary', payload: params });
}
