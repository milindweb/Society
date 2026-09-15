/* useVisitorFlatLookup.ts — FE-07
 * The watchman must pick the flat the visitor is calling on. Flats are master
 * data and can run to hundreds of rows, so this hook searches the server rather
 * than pulling every flat into memory (SRS §3.4: list search + pagination).
 *
 * Deliberately NOT built on `useEntityOptions`: flats live behind the dedicated
 * `flats.list` action, which supports `search`, whereas `config.entity.list`
 * does not filter. */

import { useState, useEffect } from 'react';
import * as flatService from '@/services/flatService';
import { useDebounce } from '@/lib/useDebounce';
import type { SelectOption } from '@/types/domain';

export interface UseVisitorFlatLookupReturn {
  options: SelectOption[];
  loading: boolean;
  /** Re-query with a fresh term. Bound to `LookupSelect.onSearch`. */
  search: (term: string) => void;
}

/**
 * Flat options for the visitor-entry form.
 *
 * @param initialTerm optional seed (e.g. a member's own flat)
 */
export function useVisitorFlatLookup(initialTerm = ''): UseVisitorFlatLookupReturn {
  const [term, setTerm] = useState(initialTerm);
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const debouncedTerm = useDebounce(term, 300);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        /* A single page of 50 keeps the payload small; the search box is the
         * intended way to narrow down a large society. */
        const result = await flatService.listFlats({
          page: 1,
          pageSize: 50,
          search: debouncedTerm || undefined,
        });
        if (cancelled) return;
        setOptions(
          result.items.map((flat) => ({
            value: flat.flatId,
            label: `${flat.flatNumber}${flat.ownerName ? ` · ${flat.ownerName}` : ''}`,
          })),
        );
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedTerm]);

  return { options, loading, search: setTerm };
}
