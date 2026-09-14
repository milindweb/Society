import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listExpenses,
  getExpense,
  createExpense,
  cancelExpense,
  expenseSummary,
} from '../expenseService';

const mockApiClient = vi.fn();
vi.mock('@/services/apiClient', () => ({ apiClient: (...args: unknown[]) => mockApiClient(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.mockResolvedValue({});
});

describe('expenseService', () => {
  describe('listExpenses', () => {
    it('calls apiClient with expenses.list action and params', async () => {
      const params = { page: 1, pageSize: 10 };
      const response = {
        items: [{ id: 'ex1', amount: 5000 }],
        page: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockApiClient.mockResolvedValue(response);
      const res = await listExpenses(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'expenses.list',
        payload: params,
      });
      expect(res).toEqual(response);
    });

    it('passes optional categoryId, vendorId, from, to, statusKey filters', async () => {
      const params = {
        page: 1,
        categoryId: 'cat1',
        vendorId: 'v1',
        from: '2026-01-01',
        to: '2026-12-31',
        statusKey: 'APPROVED',
      };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listExpenses(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'expenses.list',
        payload: params,
      });
    });
  });

  describe('getExpense', () => {
    it('calls apiClient with expenses.get and expenseId', async () => {
      const expense = { id: 'ex1', amount: 5000 };
      mockApiClient.mockResolvedValue(expense);
      const res = await getExpense('ex1');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'expenses.get',
        payload: { expenseId: 'ex1' },
      });
      expect(res).toEqual(expense);
    });
  });

  describe('createExpense', () => {
    it('calls apiClient with expenses.create and data', async () => {
      const data = { categoryId: 'cat1', amount: 3000, vendorId: 'v1' };
      mockApiClient.mockResolvedValue({ id: 'ex2', ...data });
      const res = await createExpense(data);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'expenses.create',
        payload: data,
      });
      expect(res).toEqual({ id: 'ex2', ...data });
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('VALIDATION_ERROR'));
      await expect(createExpense({})).rejects.toThrow('VALIDATION_ERROR');
    });
  });

  describe('cancelExpense', () => {
    it('calls apiClient with expenses.cancel, expenseId, and reason', async () => {
      const result = { id: 'ex1', statusKey: 'CANCELLED' };
      mockApiClient.mockResolvedValue(result);
      const res = await cancelExpense('ex1', 'Duplicate entry');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'expenses.cancel',
        payload: { expenseId: 'ex1', reason: 'Duplicate entry' },
      });
      expect(res).toEqual(result);
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('NOT_FOUND'));
      await expect(cancelExpense('ex1', 'reason')).rejects.toThrow('NOT_FOUND');
    });
  });

  describe('expenseSummary', () => {
    it('calls apiClient with expenses.summary and params', async () => {
      const params = { periodKey: '2026-09', categoryId: 'cat1' };
      const summary = { totalAmount: 15000, byCategory: { cat1: 10000 } };
      mockApiClient.mockResolvedValue(summary);
      const res = await expenseSummary(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'expenses.summary',
        payload: params,
      });
      expect(res).toEqual(summary);
    });

    it('sends all optional params when provided', async () => {
      const params = {
        periodKey: '2026-09',
        from: '2026-09-01',
        to: '2026-09-30',
        categoryId: 'cat1',
        vendorId: 'v1',
      };
      mockApiClient.mockResolvedValue({});
      await expenseSummary(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'expenses.summary',
        payload: params,
      });
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('INTERNAL_ERROR'));
      await expect(expenseSummary({})).rejects.toThrow('INTERNAL_ERROR');
    });
  });
});