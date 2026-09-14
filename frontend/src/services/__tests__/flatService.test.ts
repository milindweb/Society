import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listFlats, getFlat, createFlat, updateFlat } from '../flatService';

const mockApiClient = vi.fn();
vi.mock('@/services/apiClient', () => ({ apiClient: (...args: unknown[]) => mockApiClient(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.mockResolvedValue({});
});

describe('flatService', () => {
  describe('listFlats', () => {
    it('calls apiClient with flats.list action and params', async () => {
      const params = { page: 1, pageSize: 20 };
      const response = { items: [], page: { page: 1, pageSize: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
      mockApiClient.mockResolvedValue(response);
      const res = await listFlats(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'flats.list',
        payload: params,
      });
      expect(res).toEqual(response);
    });

    it('passes optional wingId and statusKey', async () => {
      const params = { page: 1, wingId: 'w1', statusKey: 'ACTIVE' };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listFlats(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'flats.list',
        payload: params,
      });
    });
  });

  describe('getFlat', () => {
    it('calls apiClient with flats.get and flatId', async () => {
      const flat = { id: 'f1', number: '101' };
      mockApiClient.mockResolvedValue(flat);
      const res = await getFlat('f1');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'flats.get',
        payload: { flatId: 'f1' },
      });
      expect(res).toEqual(flat);
    });
  });

  describe('createFlat', () => {
    it('calls apiClient with flats.create and data', async () => {
      const data = { number: '101', wingId: 'w1' };
      mockApiClient.mockResolvedValue({ id: 'f1', ...data });
      const res = await createFlat(data);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'flats.create',
        payload: data,
      });
      expect(res).toEqual({ id: 'f1', ...data });
    });
  });

  describe('updateFlat', () => {
    it('calls apiClient with flats.update, flatId, and values', async () => {
      const values = { statusKey: 'INACTIVE' };
      mockApiClient.mockResolvedValue({ id: 'f1', ...values });
      const res = await updateFlat('f1', values);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'flats.update',
        payload: { flatId: 'f1', values },
      });
      expect(res).toEqual({ id: 'f1', ...values });
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('NOT_FOUND'));
      await expect(updateFlat('f1', {})).rejects.toThrow('NOT_FOUND');
    });
  });
});
