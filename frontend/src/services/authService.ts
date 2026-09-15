/* authService.ts — auth API actions (api-contract.md §7.1) */

import { apiClient } from './apiClient';
import { generateClientId } from '@/lib/idempotency';
import type { User } from '@/types/domain';

interface LoginResult {
  token: string;
  expiresAt?: string;
  user: User;
  config?: { isConfigured: boolean };
}

interface AuthUserResponse {
  user: User;
  roleKeys: string[];
  permissions: string[];
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const data = await apiClient<AuthUserResponse & { token: string; expiresAt?: string; config?: { isConfigured: boolean } }>({
    action: 'auth.login',
    payload: { username, password, clientRequestId: generateClientId() },
  });

  return {
    token: data.token,
    expiresAt: data.expiresAt,
    user: { ...data.user, permissions: data.permissions ?? [] },
    config: data.config,
  };
}

export async function me(): Promise<User> {
  const data = await apiClient<AuthUserResponse>({ action: 'auth.me' });
  return { ...data.user, permissions: data.permissions ?? [] };
}

export async function logout(): Promise<{ loggedOut: true }> {
  return apiClient<{ loggedOut: true }>({
    action: 'auth.logout',
    clientRequestId: generateClientId(),
  });
}

/** Change the signed-in user's own password.
 *
 * Returns `void`, not an object: `AuthService.changePassword` ends with
 * `return { ok: true }` (AuthService.gs:575) — there is **no `data` payload**, so
 * `apiClient` resolves to `undefined`. The previous `{changed: true}` return type
 * described a value that never arrived.
 *
 * The action carries `permission: null`, so any authenticated user may call it.
 * A wrong current password comes back as `VALIDATION_ERROR` with a
 * `currentPassword` field detail (see the backend comment) — deliberately *not*
 * `UNAUTHENTICATED`, which `apiClient` would treat as a dead session and log the
 * user out over a single typo. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiClient<unknown>({
    action: 'auth.changePassword',
    payload: { currentPassword, newPassword },
    clientRequestId: generateClientId(),
  });
}

export async function health(): Promise<{
  status: string;
  schemaVersion: number;
  appVersion: string;
  isConfigured: boolean;
}> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}?action=auth.health`, {
    method: 'GET',
  });
  const json = await response.json();
  return json.data ?? json;
}
