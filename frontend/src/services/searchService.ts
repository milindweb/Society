/* searchService.ts — FE-12 Global search
 *
 * This service did not exist before FE-12 — the frontend had no search layer at
 * all, even though `search.global` has been live in `Routes.gs:1000` all along.
 *
 * Contract verified against `ReportService.globalSearch` (`ReportService.gs:69-188`)
 * and route `search.global` (`Routes.gs:1000-1010`):
 *
 *  - `permission: null` — ANY authenticated user may call it. Security is
 *    enforced per-group instead: `globalSearch` checks the caller's own
 *    permission set before searching each entity, and omits any group the caller
 *    cannot read. The client must therefore never assume a group is present.
 *  - The validator rejects `q` shorter than 2 chars, and the handler re-checks
 *    against the configurable `searchMinChars` (default 2). Both are enforced
 *    here too so a too-short query never leaves the browser.
 *  - `limit` is clamped server-side to 1..100, default 25. It is a **per-group**
 *    cap, not a global one.
 *  - Each group returns a different, small projection — see `SearchGroups`.
 */

import { apiClient } from './apiClient';
import type { SearchGroups, SearchGroupKey, SearchResult } from '@/types/domain';

/** Minimum query length the backend enforces (route validator + `searchMinChars`).
 *  Kept in sync with `Routes.gs:1003`. */
export const SEARCH_MIN_CHARS = 2;

/** Server default per-group result cap (`ReportService.gs:72`). */
export const SEARCH_DEFAULT_LIMIT = 25;

/** Server maximum per-group result cap (`ReportService.gs:72`). */
export const SEARCH_MAX_LIMIT = 100;

/** Display order and labels for the groups.
 *
 * Ordered by how often a resident would look for each thing. The label is a
 * plural noun for the group heading plus the singular used on each result row. */
export const SEARCH_GROUP_META: {
  key: SearchGroupKey;
  label: string;
  singular: string;
}[] = [
  { key: 'flats', label: 'Flats', singular: 'Flat' },
  { key: 'members', label: 'Members', singular: 'Member' },
  { key: 'demands', label: 'Demands', singular: 'Demand' },
  { key: 'payments', label: 'Payments', singular: 'Payment' },
  { key: 'complaints', label: 'Complaints', singular: 'Complaint' },
  { key: 'visitors', label: 'Visitors', singular: 'Visitor' },
  { key: 'vendors', label: 'Vendors', singular: 'Vendor' },
];

export function isSearchable(query: string): boolean {
  return query.trim().length >= SEARCH_MIN_CHARS;
}

export interface GlobalSearchParams {
  q: string;
  /** Per-group cap. Clamped to 1..100 to match the server. */
  limit?: number;
}

/** Search across every entity the caller can read.
 *
 * Throws `ApiClientError` with code `VALIDATION_ERROR` if `q` is too short —
 * but callers should gate on `isSearchable()` first and simply not call it,
 * which is why the hooks debounce and short-circuit.
 */
export async function globalSearch(params: GlobalSearchParams): Promise<SearchResult> {
  const q = params.q.trim();
  if (!isSearchable(q)) {
    throw new Error(`Search query must be at least ${SEARCH_MIN_CHARS} characters.`);
  }

  const limit = params.limit ?? SEARCH_DEFAULT_LIMIT;

  return apiClient<SearchResult>({
    action: 'search.global',
    payload: {
      q,
      limit: Math.min(SEARCH_MAX_LIMIT, Math.max(1, limit)),
    },
  });
}

/* ---------------------------------------------------------------------------
 * Presentation helpers
 * ------------------------------------------------------------------------- */

/** Total hits across all returned groups. */
export function countHits(groups: SearchGroups): number {
  return SEARCH_GROUP_META.reduce((sum, meta) => {
    const rows = groups[meta.key];
    return sum + (Array.isArray(rows) ? rows.length : 0);
  }, 0);
}

/** The groups that actually returned rows, in display order.
 *
 * Groups are omitted server-side when empty OR unreadable, so filtering here is
 * both a rendering convenience and the only way to know what to show. */
export function presentGroups(
  groups: SearchGroups,
): { key: SearchGroupKey; label: string; singular: string; rows: Record<string, unknown>[] }[] {
  return SEARCH_GROUP_META.filter((meta) => {
    const rows = groups[meta.key];
    return Array.isArray(rows) && rows.length > 0;
  }).map((meta) => ({
    key: meta.key,
    label: meta.label,
    singular: meta.singular,
    rows: (groups[meta.key] ?? []) as unknown as Record<string, unknown>[],
  }));
}

/** The primary display string for a hit, chosen per group.
 *
 * The projections differ per entity (a flat has `flatNumber`, a member has
 * `fullName`, a payment has `receiptNumber` ...), so the label column is picked
 * here rather than by each caller. */
export function primaryLabelFor(group: SearchGroupKey, row: Record<string, unknown>): string {
  const pick = (key: string) => {
    const value = row[key];
    return value === undefined || value === null ? '' : String(value);
  };

  switch (group) {
    case 'flats':
      return pick('flatNumber');
    case 'members':
      return pick('fullName');
    case 'complaints':
      return pick('title') || pick('complaintNumber');
    case 'payments':
      return pick('receiptNumber');
    case 'visitors':
      return pick('visitorName') || pick('passNumber');
    case 'demands':
      return pick('demandNumber');
    case 'vendors':
      return pick('vendorName');
    default:
      return '';
  }
}

/** The secondary line for a hit — an identifier or context value. */
export function secondaryLabelFor(group: SearchGroupKey, row: Record<string, unknown>): string {
  const pick = (key: string) => {
    const value = row[key];
    return value === undefined || value === null ? '' : String(value);
  };

  switch (group) {
    case 'flats':
      return pick('wingId');
    case 'members':
      return [pick('memberCode'), pick('mobile')].filter(Boolean).join(' · ');
    case 'complaints':
      return pick('complaintNumber');
    case 'payments':
      return pick('amount');
    case 'visitors':
      return pick('passNumber');
    case 'demands':
      return [pick('periodKey'), pick('balanceAmount')].filter(Boolean).join(' · ');
    case 'vendors':
      return pick('vendorName');
    default:
      return '';
  }
}

/** Deep-link target for a hit.
 *
 * Search returns ids but the app routes on those same ids, so every group can
 * be navigated to. `vendors` has no detail route in the router — vendor rows
 * live inside the expense/settings surfaces — so it returns `null` and the UI
 * renders it as non-clickable rather than linking to a route that does not
 * exist. */
export function routeForHit(group: SearchGroupKey, row: Record<string, unknown>): string | null {
  const id = (key: string) => {
    const value = row[key];
    return value === undefined || value === null ? '' : String(value);
  };

  switch (group) {
    case 'flats': {
      const flatId = id('flatId');
      return flatId ? `/flats/${flatId}` : null;
    }
    case 'members': {
      const memberId = id('memberId');
      return memberId ? `/members/${memberId}` : null;
    }
    case 'complaints': {
      const complaintId = id('complaintId');
      return complaintId ? `/complaints/${complaintId}` : null;
    }
    case 'payments': {
      const paymentId = id('paymentId');
      return paymentId ? `/payments/${paymentId}` : null;
    }
    case 'visitors':
      return '/visitors';
    case 'demands': {
      const demandId = id('demandId');
      return demandId ? `/maintenance/demands/${demandId}` : null;
    }
    case 'vendors':
      return null;
    default:
      return null;
  }
}
