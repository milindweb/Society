/* apiClient.ts — transport: envelope handling, token, retries, error mapping (frontend-architecture.md §5) */

import { ApiClientError, type ApiResponse, type ApiRequest, type ApiMeta, type PageMeta } from '@/types/api';
import { authStore } from '@/state/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

let onAuthError: (() => void) | null = null;

export function setAuthErrorHandler(handler: () => void) {
  onAuthError = handler;
}

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

export async function apiClient<T>(request: ApiRequest): Promise<T> {
  const token = authStore.token ?? undefined;
  const body: ApiRequest = { ...request, token };

  // GAS web-app deployments return a 302 redirect; when the browser follows it,
  // POST is converted to GET and the body is lost. Sending as GET with the
  // payload URL-encoded avoids the redirect entirely and lets doGet() parse it.
  const url = new URL(API_BASE_URL);
  url.searchParams.set('action', request.action);
  url.searchParams.set('payload', JSON.stringify(body));

  const response = await fetch(url.toString(), {
    method: 'GET',
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

  return normaliseData<T>(json.data, json.meta);
}

/** Re-shape a paginated response into the `Paginated<T>` contract.
 *
 * The backend (ApiRouter.gs:419-424, Responses.gs:76) returns paginated data as
 *   { ok, data: T[], meta: { page: PageMeta, ... } }
 * — the rows are the bare `data` array and the page cursor rides in `meta.page`.
 * The frontend contract (api-contract.md §2) declares
 *   { items: T[], page: PageMeta }
 * This adapter bridges the two, so every service can keep declaring
 * `Paginated<T>` and every hook can keep reading `.items` / `.page`.
 *
 * An empty but *present* `meta.page` is still normalised (so an empty list is
 * distinguishable from a non-paginated payload), and a caller that already
 * receives the nested shape is passed through untouched.
 *
 * `reports.run` (FE-12) returns `data` as an **object** whose rows live in
 * `data.rows`, with the cursor in `meta.page` — the opposite nesting from every
 * list endpoint. Without the object branch below that page meta was silently
 * dropped and a report could never paginate. Any object payload that does not
 * already carry its own `page` now inherits `meta.page`. */
function normaliseData<T>(data: T, meta: ApiMeta | undefined): T {
  const page = meta?.page;

  if (Array.isArray(data) && page) {
    return { items: data, page } as unknown as T;
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;
    if ('items' in record && Array.isArray(record.items)) {
      if (!record.page) { record.page = page ?? EMPTY_PAGE; }
      return data;
    }
    /* Object payload with its rows nested inside (e.g. `reports.run`).
     * Attach the cursor rather than discard it. */
    if (page && !record.page) {
      record.page = page;
    }
    return data;
  }

  return data;
}
