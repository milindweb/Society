/* useVisitorLookups.ts — config-driven visitor options (FE-07)
 * SRS §7 / §15: visitor types (Guest, Delivery, Service Provider, Vendor,
 * Taxi/Cab, Other) are configurable rows, never literals in the source.
 *
 * Sources, verified against backend/src/{Schema,SchemaMeta}.gs:
 *   Visitor_Types          -> visitorTypeId, typeKey, typeName, requiresApproval
 *   Status_Config VISITOR  -> INSIDE, EXITED, OVERSTAY
 *   ENUM VISITOR_SOURCE    -> WEB, WATCHMAN, PHONE, OTHER
 */

import { useEntityOptions, useStatusOptions, useEnumOptions } from '@/lib/useConfigOptions';
import type { SelectOption } from '@/types/domain';

/** Visitor types, from `config.entity.list` (Visitor_Types sheet). */
export function useVisitorTypeOptions(): { options: SelectOption[]; loading: boolean } {
  const { options, loading } = useEntityOptions(
    'visitorTypes',
    ['visitorTypeId'],
    ['typeName', 'typeKey'],
  );
  return { options, loading };
}

/** Visitor statuses, from Status_Config domain VISITOR (INSIDE / EXITED / OVERSTAY). */
export function useVisitorStatusOptions(): { options: SelectOption[]; loading: boolean } {
  return useStatusOptions('VISITOR');
}

/** How the pass was logged: WEB | WATCHMAN | PHONE | OTHER. */
export function useVisitorSourceOptions(): { options: SelectOption[]; loading: boolean } {
  return useEnumOptions('VISITOR_SOURCE');
}
