/* authStore.test.ts — Tests for auth state store */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authStore, subscribeAuth, getAuthSnapshot } from '@/state/authStore';
import type { User } from '@/types/domain';

const mockUser: User = {
  userId: 'u1',
  username: 'admin',
  email: 'admin@test.com',
  fullName: 'Admin User',
  mobile: '9876543210',
  roleKeys: ['ADMIN'],
  permissions: ['*'],
  mustChangePassword: false,
  statusKey: 'ACTIVE_USER',
};

function mockSessionStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn(),
  };
}

describe('authStore', () => {
  let storage: ReturnType<typeof mockSessionStorage>;

  beforeEach(() => {
    storage = mockSessionStorage();
    vi.stubGlobal('sessionStorage', storage);
    authStore.clearAuth();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('setAuth', () => {
    it('sets token and user', () => {
      authStore.setAuth('token-123', mockUser);
      expect(authStore.token).toBe('token-123');
      expect(authStore.user).toEqual(mockUser);
    });

    it('saves to sessionStorage', () => {
      authStore.setAuth('token-123', mockUser);
      expect(storage.setItem).toHaveBeenCalledWith('auth_token', 'token-123');
      expect(storage.setItem).toHaveBeenCalledWith('auth_user', JSON.stringify(mockUser));
    });
  });

  describe('clearAuth', () => {
    it('clears token and user', () => {
      authStore.setAuth('token-123', mockUser);
      authStore.clearAuth();
      expect(authStore.token).toBeNull();
      expect(authStore.user).toBeNull();
    });

    it('removes from sessionStorage', () => {
      authStore.setAuth('token-123', mockUser);
      authStore.clearAuth();
      expect(storage.removeItem).toHaveBeenCalledWith('auth_token');
      expect(storage.removeItem).toHaveBeenCalledWith('auth_user');
    });
  });

  describe('isAuthenticated', () => {
    it('returns true when token and user are set', () => {
      authStore.setAuth('token-123', mockUser);
      expect(authStore.isAuthenticated()).toBe(true);
    });

    it('returns false when token is null', () => {
      expect(authStore.isAuthenticated()).toBe(false);
    });

    it('returns false when user is null', () => {
      authStore.token = 'token-123';
      authStore.user = null;
      expect(authStore.isAuthenticated()).toBe(false);
    });
  });

  describe('subscribeAuth', () => {
    it('notifies listeners on setAuth', () => {
      const listener = vi.fn();
      subscribeAuth(listener);
      authStore.setAuth('token-123', mockUser);
      expect(listener).toHaveBeenCalled();
    });

    it('notifies listeners on clearAuth', () => {
      const listener = vi.fn();
      subscribeAuth(listener);
      authStore.clearAuth();
      expect(listener).toHaveBeenCalled();
    });

    it('returns unsubscribe function', () => {
      const listener = vi.fn();
      const unsub = subscribeAuth(listener);
      unsub();
      authStore.setAuth('token-123', mockUser);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getAuthSnapshot', () => {
    it('returns current token and user', () => {
      authStore.setAuth('token-123', mockUser);
      const snapshot = getAuthSnapshot();
      expect(snapshot).toEqual({ token: 'token-123', user: mockUser });
    });

    it('returns null values when not authenticated', () => {
      const snapshot = getAuthSnapshot();
      expect(snapshot).toEqual({ token: null, user: null });
    });
  });
});
