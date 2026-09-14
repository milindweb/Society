import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, me, logout, changePassword, health } from '../authService';

const mockApiClient = vi.fn();
vi.mock('@/services/apiClient', () => ({ apiClient: (...args: unknown[]) => mockApiClient(...args) }));

vi.mock('@/lib/idempotency', () => ({ generateClientId: () => 'test-client-id' }));

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.mockResolvedValue({});
});

describe('authService', () => {
  describe('login', () => {
    it('calls apiClient with auth.login action and credentials', async () => {
      const result = { token: 't', expiresAt: '2026-01-01', user: { id: 'u1' }, permissions: ['dashboard.read'], config: { isConfigured: true } };
      mockApiClient.mockResolvedValue(result);
      const res = await login('admin', 'pass123');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'auth.login',
        payload: { username: 'admin', password: 'pass123', clientRequestId: 'test-client-id' },
      });
      expect(res).toEqual({
        token: 't',
        expiresAt: '2026-01-01',
        user: { id: 'u1', permissions: ['dashboard.read'] },
        config: { isConfigured: true },
      });
    });

    it('defaults permissions to empty array when missing', async () => {
      mockApiClient.mockResolvedValue({ token: 't', user: { id: 'u1' } });
      const res = await login('admin', 'pass123');
      expect(res.user.permissions).toEqual([]);
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('INVALID_CREDENTIALS'));
      await expect(login('a', 'b')).rejects.toThrow('INVALID_CREDENTIALS');
    });
  });

  describe('me', () => {
    it('calls apiClient with auth.me action', async () => {
      mockApiClient.mockResolvedValue({ user: { id: 'u1', name: 'Admin' }, roleKeys: ['admin'], permissions: ['dashboard.read'] });
      const res = await me();
      expect(mockApiClient).toHaveBeenCalledWith({ action: 'auth.me' });
      expect(res).toEqual({ id: 'u1', name: 'Admin', permissions: ['dashboard.read'] });
    });
  });

  describe('logout', () => {
    it('calls apiClient with auth.logout action and clientRequestId', async () => {
      mockApiClient.mockResolvedValue({ loggedOut: true });
      const res = await logout();
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'auth.logout',
        clientRequestId: 'test-client-id',
      });
      expect(res).toEqual({ loggedOut: true });
    });
  });

  describe('changePassword', () => {
    it('calls apiClient with auth.changePassword and both passwords', async () => {
      mockApiClient.mockResolvedValue({ changed: true });
      const res = await changePassword('old', 'new');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'auth.changePassword',
        payload: { currentPassword: 'old', newPassword: 'new' },
        clientRequestId: 'test-client-id',
      });
      expect(res).toEqual({ changed: true });
    });
  });

  describe('health', () => {
    it('calls fetch GET with auth.health query param', async () => {
      const healthData = { status: 'ok', schemaVersion: 1, appVersion: '1.0.0', isConfigured: true };
      const mockFetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ data: healthData }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await health();
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('?action=auth.health');
      expect(opts.method).toBe('GET');
      expect(res).toEqual(healthData);
    });

    it('returns json directly if data key missing', async () => {
      const healthData = { status: 'ok', schemaVersion: 1, appVersion: '1.0.0', isConfigured: false };
      const mockFetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve(healthData),
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await health();
      expect(res).toEqual(healthData);
    });
  });
});
