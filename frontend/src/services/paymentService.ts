/* paymentService.ts — FE-06
 * api-contract.md §7.5: payments, receipts and ledger.
 * Money is server-computed; the UI formats and displays it only (SRS §23).
 * There is no optimistic UI for money — callers must reload after a write. */

import { apiClient } from './apiClient';
import type { Payment, Receipt, PaymentRecordResult } from '@/types/domain';
import type { Paginated, PaginationParams } from '@/types/api';

/* ── Payments ── */

export async function listPayments(
  params: PaginationParams & { flatId?: string; from?: string; to?: string; modeKey?: string },
): Promise<Paginated<Payment>> {
  return apiClient<Paginated<Payment>>({ action: 'payments.list', payload: params });
}

export async function getPayment(paymentId: string): Promise<Payment> {
  return apiClient<Payment>({ action: 'payments.get', payload: { paymentId } });
}

/** Record a payment.
 *
 * The server performs oldest-due-first allocation itself and returns the resulting
 * `allocations` plus a 1:1 receipt (`PaymentService.recordPayment`). The client
 * therefore sends only what the user actually knows — flat, amount, date, mode — and
 * never proposes a split. */
export async function recordPayment(data: {
  flatId: string;
  amount: number;
  paymentDate: string;
  paymentModeKey: string;
  referenceNumber?: string;
  bankName?: string;
  remarks?: string;
  templateKey?: string;
  clientRequestId: string;
}): Promise<PaymentRecordResult> {
  return apiClient<PaymentRecordResult>({ action: 'payments.record', payload: data });
}

/** Re-run allocation on an existing payment (server decides the split). */
export async function allocatePayment(
  paymentId: string,
  clientRequestId: string,
): Promise<Payment> {
  return apiClient<Payment>({
    action: 'payments.allocate',
    payload: { paymentId, clientRequestId },
  });
}

export async function cancelPayment(
  paymentId: string,
  reason: string,
  clientRequestId: string,
): Promise<Payment> {
  return apiClient<Payment>({
    action: 'payments.cancel',
    payload: { paymentId, reason, clientRequestId },
  });
}

/** A correction, not a deletion (SRS §24). */
export async function reversePayment(
  paymentId: string,
  reason: string,
  clientRequestId: string,
): Promise<Payment> {
  return apiClient<Payment>({
    action: 'payments.reverse',
    payload: { paymentId, reason, clientRequestId },
  });
}

/* ── Receipts ── */

export async function listReceipts(
  params: PaginationParams & { flatId?: string; periodKey?: string },
): Promise<Paginated<Receipt>> {
  return apiClient<Paginated<Receipt>>({ action: 'receipts.list', payload: params });
}

export async function getReceipt(receiptId: string): Promise<Receipt> {
  return apiClient<Receipt>({ action: 'receipts.get', payload: { receiptId } });
}

/** Server increments `printCount` as part of this call. */
export async function printReceipt(receiptId: string): Promise<Receipt> {
  return apiClient<Receipt>({ action: 'receipts.print', payload: { receiptId } });
}
