/* useSearch.ts — FE-12 global search
 *
 * Debounced, cancellable, and it never issues a request for a query below the
 * backend's minimum length (`SEARCH_MIN_CHARS`), so a two-keystroke rule is
 * enforced without a pointless round trip that would return VALIDATION_ERROR.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as searchService from '@/services/searchService';
import { useDebounce } from '@/lib/useDebounce';
import type { SearchGroups, SearchResult } from '@/types/domain';

const DEFAULT_DEBOUNCE_MS = 300;

export interface UseGlobalSearchParams {
  /** Query text, usually straight from an input's value. */
  query: string;
  debounceMs?: number;
  /** Results per group (server clamps to 1..100). */
  limit?: number;
}

export interface UseGlobalSearchReturn {
  result: SearchResult | null;
  groups: SearchGroups;
  /** Hits across every returned group. */
  hitCount: number;
  /** True while the debounce timer is pending OR a request is in flight. */
  loading: boolean;
  error: string | null;
  /** The debounced query actually used for the last request. */
  activeQuery: string;
  /** False when the query is below the minimum length — used to show a hint
   *  rather than an empty-result state. */
  isSearchable: boolean;
  /** True once a debounced search has completed for the current query. */
  hasSearched: boolean;
  clear: () => void;
}

/** Global search across every entity the caller can read.
 *
 * Security note: the route is `permission: null` (any authenticated user), and
 * the **server** filters which groups are searchable by the caller's own
 * permissions. The client therefore does no permission filtering of its own —
 * doing so would duplicate the RBAC rules and could hide groups a user can see.
 */
export function useGlobalSearch({
  query,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  limit,
}: UseGlobalSearchParams): UseGlobalSearchReturn {
  const debounced = useDebounce(query, debounceMs);
  const trimmed = debounced.trim();
  const canSearch = searchService.isSearchable(trimmed);

  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeQuery, setActiveQuery] = useState('');

  /* Guards against an older request resolving after a newer one. */
  const requestSeq = useRef(0);

  useEffect(() => {
    if (!canSearch) {
      setResult(null);
      setError(null);
      setLoading(false);
      setHasSearched(false);
      setActiveQuery('');
      requestSeq.current += 1;
      return;
    }

    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setLoading(true);
    setError(null);

    searchService
      .globalSearch({ q: trimmed, limit })
      .then((data) => {
        if (requestSeq.current !== seq) return;
        setResult(data);
        setActiveQuery(data.query ?? trimmed);
        setHasSearched(true);
      })
      .catch((err: unknown) => {
        if (requestSeq.current !== seq) return;
        setResult(null);
        setError(err instanceof Error ? err.message : 'Search failed');
        setHasSearched(true);
      })
      .finally(() => {
        if (requestSeq.current !== seq) return;
        setLoading(false);
      });
  }, [trimmed, canSearch, limit]);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    setHasSearched(false);
    setActiveQuery('');
  }, []);

  return {
    result,
    groups: result?.groups ?? {},
    hitCount: result ? searchService.countHits(result.groups) : 0,
    loading,
    error,
    activeQuery,
    isSearchable: canSearch,
    hasSearched,
    clear,
  };
}
