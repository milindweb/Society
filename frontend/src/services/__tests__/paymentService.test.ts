import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listPayments, getPayment, recordPayment, listReceipts, getReceipt } from '../paymentService';

const mockApiClient = vi.fn();
vi.mock('@/services/apiClient', () => ({ apiClient: (...args: unknown[]) => mockApiClient(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.mockResolvedValue({});
});

describe('paymentService', () => {
  describe('listPayments', () => {
    it('calls apiClient with payments.list and params', async () => {
      const params = { page: 1, pageSize: 10 };
      const response = { items: [{ id: 'p1', amount: 500 }], page: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false } };
      mockApiClient.mockResolvedValue(response);
      const res = await listPayments(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'payments.list',
        payload: params,
      });
      expect(res).toEqual(response);
    });

    it('passes optional flatId, from, to, modeKey filters', async () => {
      const params = { page: 1, flatId: 'f1', from: '2026-01-01', to: '2026-12-31', modeKey: 'CASH' };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listPayments(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'payments.list',
        payload: params,
      });
    });
  });

  describe('getPayment', () => {
    it('calls apiClient with payments.get and paymentId', async () => {
      const payment = { id: 'p1', amount: 1000 };
      mockApiClient.mockResolvedValue(payment);
      const res = await getPayment('p1');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'payments.get',
        payload: { paymentId: 'p1' },
      });
      expect(res).toEqual(payment);
    });
  });

  describe('recordPayment', () => {
    it('calls apiClient with payments.record and data', async () => {
      const data = { flatId: 'f1', amount: 500, modeKey: 'CASH' };
      mockApiClient.mockResolvedValue({ id: 'p1', ...data });
      const res = await recordPayment(data);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'payments.record',
        payload: data,
      });
      expect(res).toEqual({ id: 'p1', ...data });
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('VALIDATION_ERROR'));
      await expect(recordPayment({})).rejects.toThrow('VALIDATION_ERROR');
    });
  });

  describe('listReceipts', () => {
    it('calls apiClient with receipts.list and params', async () => {
      const params = { page: 1 };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      const res = await listReceipts(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'receipts.list',
        payload: params,
      });
      expect(res).toEqual({ items: [], page: {} });
    });

    it('passes optional flatId and periodKey', async () => {
      const params = { page: 1, flatId: 'f1', periodKey: '2026-09' };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listReceipts(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'receipts.list',
        payload: params,
      });
    });
  });

  describe('getReceipt', () => {
    it('calls apiClient with receipts.get and receiptId', async () => {
      const receipt = { id: 'r1', paymentId: 'p1' };
      mockApiClient.mockResolvedValue(receipt);
      const res = await getReceipt('r1');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'receipts.get',
        payload: { receiptId: 'r1' },
      });
      expect(res).toEqual(receipt);
    });
  });
});
