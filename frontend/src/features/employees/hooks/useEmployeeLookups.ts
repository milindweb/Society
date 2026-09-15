/* useEmployeeLookups.ts — config-driven employee options (FE-10)
 * SRS §15: employee types and statuses are configuration data, never literals.
 *
 * Sources, verified against backend/src/{Schema,SchemaMeta,ConfigService,Setup}.gs:
 *   employeeTypes  -> Employee_Types (employeeTypeId, typeKey, typeName)
 *   statusKey      -> Status_Config domain ENTITY = ACTIVE / INACTIVE / ARCHIVED
 *                     (`Setup.gs:59`; employees reuse the generic entity lifecycle)
 *
 * ⚠️ Employee_Types' id column is `employeeTypeId` and its label is `typeName`
 * (Schema.gs:96) — not `typeKey`/`name`. The label candidates below are ordered so
 * a row carrying either still labels sensibly. */

import { useEntityOptions, useEnumList, useStatusOptions } from '@/lib/useConfigOptions';
import type { SelectOption } from '@/types/domain';

/** Employee types, from the `employeeTypes` config master entity. */
export function useEmployeeTypeOptions(): { options: SelectOption[]; loading: boolean } {
  const { options, loading } = useEntityOptions(
    'employeeTypes',
    ['employeeTypeId', 'typeKey'],
    ['typeName', 'typeKey'],
  );
  return { options, loading };
}

/** Employee statuses. Employees use the generic ENTITY lifecycle
 * (ACTIVE / INACTIVE / ARCHIVED) — there is no EMPLOYEE status domain. */
export function useEmployeeStatusOptions(): { options: SelectOption[]; loading: boolean } {
  return useStatusOptions('ENTITY');
}

/** The same employee types as served pre-shaped by `config.enums.types.employee`.
 * Preferred where available because it avoids a second round trip; the entity
 * hook above is the fallback. Both are config-sourced, so neither hardcodes. */
export function useEmployeeTypeEnumOptions(): { options: SelectOption[]; loading: boolean } {
  return useEnumList('types', 'employee');
}
