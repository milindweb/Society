/* authStore.tsx — state/authStore: token (sessionStorage), user, permissions */

import type { User } from '@/types/domain';

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

function loadToken(): string | null {
  try {
    return sessionStorage.getItem('auth_token');
  } catch {
    return null;
  }
}

function saveToken(token: string) {
  try {
    sessionStorage.setItem('auth_token', token);
  } catch {
    /* sessionStorage unavailable */
  }
}

function clearToken() {
  try {
    sessionStorage.removeItem('auth_token');
  } catch {
    /* ignore */
  }
}

let storedUser: User | null = null;
try {
  const raw = sessionStorage.getItem('auth_user');
  if (raw) storedUser = JSON.parse(raw);
} catch {
  /* ignore */
}

export const authStore: AuthState = {
  token: loadToken(),
  user: storedUser,

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    saveToken(token);
    try {
      sessionStorage.setItem('auth_user', JSON.stringify(user));
    } catch {
      /* ignore */
    }
    notify();
  },

  clearAuth() {
    this.token = null;
    this.user = null;
    clearToken();
    try {
      sessionStorage.removeItem('auth_user');
    } catch {
      /* ignore */
    }
    notify();
  },

  isAuthenticated() {
    return this.token !== null && this.user !== null;
  },
};

let listeners: (() => void)[] = [];

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((fn) => fn !== listener);
  };
}

export function getAuthSnapshot(): { token: string | null; user: User | null } {
  return { token: authStore.token, user: authStore.user };
}
