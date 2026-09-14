/* authService.ts — auth API actions (api-contract.md §7.1) */

import { apiClient } from './apiClient';
import { generateClientId } from '@/lib/idempotency';
import type { User } from '@/types/domain';

interface LoginResult {
  token: string;
  expiresAt: string;
  user: User;
  config: { isConfigured: boolean };
}

export async function login(username: string, password: string): Promise<LoginResult> {
  return apiClient<LoginResult>({
    action: 'auth.login',
    payload: { username, password, clientRequestId: generateClientId() },
  });
}

export async function me(): Promise<User> {
  return apiClient<User>({ action: 'auth.me' });
}

export async function logout(): Promise<{ loggedOut: true }> {
  return apiClient<{ loggedOut: true }>({
    action: 'auth.logout',
    clientRequestId: generateClientId(),
  });
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ changed: true }> {
  return apiClient<{ changed: true }>({
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
