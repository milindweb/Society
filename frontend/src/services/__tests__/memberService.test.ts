import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listMembers, getMember, createMember, updateMember } from '../memberService';

const mockApiClient = vi.fn();
vi.mock('@/services/apiClient', () => ({ apiClient: (...args: unknown[]) => mockApiClient(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.mockResolvedValue({});
});

describe('memberService', () => {
  describe('listMembers', () => {
    it('calls apiClient with members.list action and params', async () => {
      const params = { page: 1, pageSize: 10 };
      const response = { items: [{ id: 'm1', name: 'Alice' }], page: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false } };
      mockApiClient.mockResolvedValue(response);
      const res = await listMembers(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'members.list',
        payload: params,
      });
      expect(res).toEqual(response);
    });

    it('passes optional flatId and relationType', async () => {
      const params = { page: 1, flatId: 'f1', relationType: 'OWNER' };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listMembers(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'members.list',
        payload: params,
      });
    });
  });

  describe('getMember', () => {
    it('calls apiClient with members.get and memberId', async () => {
      const member = { id: 'm1', name: 'Alice' };
      mockApiClient.mockResolvedValue(member);
      const res = await getMember('m1');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'members.get',
        payload: { memberId: 'm1' },
      });
      expect(res).toEqual(member);
    });
  });

  describe('createMember', () => {
    it('calls apiClient with members.create and data', async () => {
      const data = { name: 'Bob', flatId: 'f1' };
      mockApiClient.mockResolvedValue({ id: 'm2', ...data });
      const res = await createMember(data);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'members.create',
        payload: data,
      });
      expect(res).toEqual({ id: 'm2', ...data });
    });
  });

  describe('updateMember', () => {
    it('calls apiClient with members.update, memberId, and values', async () => {
      const values = { name: 'Updated' };
      mockApiClient.mockResolvedValue({ id: 'm1', ...values });
      const res = await updateMember('m1', values);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'members.update',
        payload: { memberId: 'm1', values },
      });
      expect(res).toEqual({ id: 'm1', ...values });
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('NOT_FOUND'));
      await expect(updateMember('m1', {})).rejects.toThrow('NOT_FOUND');
    });
  });
});
