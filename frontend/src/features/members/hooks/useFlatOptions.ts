/* useFlatOptions.ts — searchable flat lookup for member forms (FE-05)
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 * SRS §15: flat lists are read from the API, never hardcoded. */

import { useState, useCallback, useEffect } from 'react';
import * as flatService from '@/services/flatService';
import { useDebounce } from '@/lib/useDebounce';
import type { SelectOption } from '@/types/domain';

const PAGE_SIZE = 50;

export interface UseFlatOptionsReturn {
  options: SelectOption[];
  loading: boolean;
  searchFlats: (term: string) => void;
}

/** Flat options for a lookup control. Starts with the first page and re-queries
 * whenever the caller pushes a new search term (debounced here). */
export function useFlatOptions(): UseFlatOptionsReturn {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    flatService
      .listFlats({ page: 1, pageSize: PAGE_SIZE, search: debouncedSearch || undefined })
      .then((result) => {
        if (cancelled) return;
        setOptions(
          (result.items ?? []).map((flat) => ({
            value: flat.flatId,
            label: flat.wingName
              ? `${flat.wingName} · ${flat.flatNumber}`
              : flat.flatNumber,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const searchFlats = useCallback((term: string) => {
    setSearch(term);
  }, []);

  return { options, loading, searchFlats };
}
