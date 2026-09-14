/* paymentService.ts — FE-06 */

import { apiClient } from './apiClient';
import type { Payment, Receipt } from '@/types/domain';
import type { PaginationParams } from '@/types/api';

interface PaginatedResponse<T> {
  items: T[];
  page: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}

export async function listPayments(params: PaginationParams & { flatId?: string; from?: string; to?: string; modeKey?: string }): Promise<PaginatedResponse<Payment>> {
  return apiClient({ action: 'payments.list', payload: params });
}

export async function getPayment(paymentId: string): Promise<Payment> {
  return apiClient({ action: 'payments.get', payload: { paymentId } });
}

export async function recordPayment(data: Record<string, unknown>): Promise<Payment> {
  return apiClient({ action: 'payments.record', payload: data });
}

export async function listReceipts(params: PaginationParams & { flatId?: string; periodKey?: string }): Promise<PaginatedResponse<Receipt>> {
  return apiClient({ action: 'receipts.list', payload: params });
}

export async function getReceipt(receiptId: string): Promise<Receipt> {
  return apiClient({ action: 'receipts.get', payload: { receiptId } });
}
