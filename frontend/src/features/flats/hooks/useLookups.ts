/* useLookups.ts — config-driven select options (FE-05)
 * SRS §15 / frontend-architecture.md §8: the frontend holds NO hardcoded master data.
 * Wings, flat types and statuses all arrive from config.enums / config.entity.list.
 *
 * The generic implementations live in `lib/useConfigOptions.ts` so later phases
 * share one copy. This module keeps the flat/member-specific wrappers and
 * re-exports the shared hooks so existing imports keep working. */

import type { SelectOption } from '@/types/domain';
import { useEntityOptions } from '@/lib/useConfigOptions';

export { useEntityOptions, useStatusOptions, useEnumOptions } from '@/lib/useConfigOptions';

/** Wings, from the config master-data entity (never a literal list). */
export function useWingOptions(): { options: SelectOption[]; loading: boolean } {
  const { options, loading } = useEntityOptions('wings', ['wingId', 'id'], ['wingName', 'name']);
  return { options, loading };
}

/** Flat types, from the config master-data entity. */
export function useFlatTypeOptions(): { options: SelectOption[]; loading: boolean } {
  const { options, loading } = useEntityOptions(
    'flatTypes',
    ['flatTypeId', 'id'],
    ['typeName', 'flatTypeName', 'name'],
  );
  return { options, loading };
}
