import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getConfig, getEnums, getEntityMeta, updateConfig } from '../configService';

const mockApiClient = vi.fn();
vi.mock('@/services/apiClient', () => ({ apiClient: (...args: unknown[]) => mockApiClient(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.mockResolvedValue({});
});

describe('configService', () => {
  describe('getConfig', () => {
    it('calls apiClient with config.get action', async () => {
      const config = { societyName: 'Test' };
      mockApiClient.mockResolvedValue(config);
      const res = await getConfig();
      expect(mockApiClient).toHaveBeenCalledWith({ action: 'config.get' });
      expect(res).toEqual(config);
    });
  });

  describe('getEnums', () => {
    it('calls apiClient with config.enums action', async () => {
      const enums = { flatStatus: ['ACTIVE'] };
      mockApiClient.mockResolvedValue(enums);
      const res = await getEnums();
      expect(mockApiClient).toHaveBeenCalledWith({ action: 'config.enums' });
      expect(res).toEqual(enums);
    });
  });

  describe('getEntityMeta', () => {
    it('calls apiClient with config.entityMeta action and entity payload', async () => {
      const meta = { entity: 'flat', fields: [] };
      mockApiClient.mockResolvedValue(meta);
      const res = await getEntityMeta('flat');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'config.entityMeta',
        payload: { entity: 'flat' },
      });
      expect(res).toEqual(meta);
    });

    it('calls apiClient without entity payload when entity is undefined', async () => {
      const meta = [{ entity: 'flat' }];
      mockApiClient.mockResolvedValue(meta);
      const res = await getEntityMeta();
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'config.entityMeta',
        payload: undefined,
      });
      expect(res).toEqual(meta);
    });
  });

  describe('updateConfig', () => {
    it('calls apiClient with config.update action and values', async () => {
      const values = { societyName: 'New Name' };
      const result = { updated: 1, config: { societyName: 'New Name' } };
      mockApiClient.mockResolvedValue(result);
      const res = await updateConfig(values);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'config.update',
        payload: { values },
      });
      expect(res).toEqual(result);
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('VALIDATION_ERROR'));
      await expect(updateConfig({ bad: true })).rejects.toThrow('VALIDATION_ERROR');
    });
  });
});
