import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, setAuthErrorHandler } from '../apiClient';
import { ApiClientError } from '@/types/api';

vi.mock('@/state/authStore', () => ({
  authStore: {
    token: null,
    user: null,
    clearAuth: vi.fn(),
    setAuth: vi.fn(),
    isAuthenticated: vi.fn(),
  },
}));

import { authStore } from '@/state/authStore';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function okResponse(data: unknown) {
  return { ok: true, data, meta: { requestId: 'r1', ts: '2026-01-01T00:00:00Z', schemaVersion: 1, appVersion: '1.0.0' } };
}

function errorResponse(code: string, message: string, details?: { field: string; message: string }[]) {
  return { ok: false, error: { code, message, details }, meta: { requestId: 'r1', ts: '2026-01-01T00:00:00Z', schemaVersion: 1, appVersion: '1.0.0' } };
}

beforeEach(() => {
  vi.clearAllMocks();
  (authStore.token as unknown) = null;
  (authStore.clearAuth as ReturnType<typeof vi.fn>).mockClear();
});

describe('apiClient', () => {
  it('unwraps envelope and returns data on success', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(okResponse({ foo: 'bar' })) });
    const result = await apiClient<{ foo: string }>({ action: 'test.action' });
    expect(result).toEqual({ foo: 'bar' });
  });

  it('sends POST to API_BASE_URL with correct headers', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(okResponse(null)) });
    await apiClient({ action: 'test.action', payload: { a: 1 } });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe(import.meta.env.VITE_API_BASE_URL);
    expect(opts.method).toBe('POST');
    expect(opts.headers).toEqual({ 'Content-Type': 'text/plain;charset=utf-8' });
  });

  it('attaches token from authStore when present', async () => {
    (authStore.token as unknown) = 'my-token';
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(okResponse(null)) });
    await apiClient({ action: 'test.action' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.token).toBe('my-token');
  });

  it('does not attach token when authStore.token is null', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(okResponse(null)) });
    await apiClient({ action: 'test.action' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.token).toBeUndefined();
  });

  it('throws ApiClientError on HTTP error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(apiClient({ action: 'test.action' })).rejects.toThrow(ApiClientError);
    await expect(apiClient({ action: 'test.action' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('throws ApiClientError on envelope error', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(errorResponse('NOT_FOUND', 'not found')) });
    await expect(apiClient({ action: 'test.action' })).rejects.toThrow(ApiClientError);
    await expect(apiClient({ action: 'test.action' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('includes error details when present', async () => {
    const details = [{ field: 'name', message: 'required' }];
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(errorResponse('VALIDATION_ERROR', 'invalid', details)) });
    try {
      await apiClient({ action: 'test.action' });
      expect.fail('should have thrown');
    } catch (e) {
      expect((e as ApiClientError).details).toEqual(details);
    }
  });

  it('clears auth on UNAUTHENTICATED and calls handler', async () => {
    const handler = vi.fn();
    setAuthErrorHandler(handler);
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(errorResponse('UNAUTHENTICATED', 'unauth')) });
    await expect(apiClient({ action: 'test.action' })).rejects.toThrow();
    expect(authStore.clearAuth).toHaveBeenCalled();
    expect(handler).toHaveBeenCalled();
  });

  it('clears auth on TOKEN_EXPIRED', async () => {
    setAuthErrorHandler(null as unknown as () => void);
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(errorResponse('TOKEN_EXPIRED', 'expired')) });
    await expect(apiClient({ action: 'test.action' })).rejects.toThrow();
    expect(authStore.clearAuth).toHaveBeenCalled();
  });

  it('clears auth on TOKEN_REVOKED', async () => {
    const handler = vi.fn();
    setAuthErrorHandler(handler);
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(errorResponse('TOKEN_REVOKED', 'revoked')) });
    await expect(apiClient({ action: 'test.action' })).rejects.toThrow();
    expect(authStore.clearAuth).toHaveBeenCalled();
  });

  it('does not clear auth on non-auth errors', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(errorResponse('NOT_FOUND', 'missing')) });
    await expect(apiClient({ action: 'test.action' })).rejects.toThrow();
    expect(authStore.clearAuth).not.toHaveBeenCalled();
  });

  it('forwards clientRequestId when provided', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(okResponse(null)) });
    await apiClient({ action: 'test.action', clientRequestId: 'id-123' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.clientRequestId).toBe('id-123');
  });

  it('does not crash if onAuthError handler is null', async () => {
    setAuthErrorHandler(null as unknown as () => void);
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(errorResponse('UNAUTHENTICATED', 'unauth')) });
    await expect(apiClient({ action: 'test.action' })).rejects.toThrow();
    expect(authStore.clearAuth).toHaveBeenCalled();
  });
});
