/* apiClient.ts — transport: envelope handling, token, retries, error mapping (frontend-architecture.md §5) */

import { ApiClientError, type ApiResponse, type ApiRequest } from '@/types/api';
import { authStore } from '@/state/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

let onAuthError: (() => void) | null = null;

export function setAuthErrorHandler(handler: () => void) {
  onAuthError = handler;
}

export async function apiClient<T>(request: ApiRequest): Promise<T> {
  const token = authStore.token ?? undefined;
  const body: ApiRequest = { ...request, token };

  const response = await fetch(API_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiClientError('BAD_REQUEST', `HTTP ${response.status}`);
  }

  const json = (await response.json()) as ApiResponse<T>;

  if (!json.ok) {
    const { code, message, details } = json.error;

    if (code === 'UNAUTHENTICATED' || code === 'TOKEN_EXPIRED' || code === 'TOKEN_REVOKED') {
      authStore.clearAuth();
      onAuthError?.();
    }

    throw new ApiClientError(code, message, details);
  }

  return json.data;
}
