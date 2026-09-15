/* useComplaintLookups.ts — config-driven complaint options (FE-07)
 * SRS §5 / §15: categories ("Complaint category"), priorities
 * (Low / Medium / High / Emergency) and assignment targets
 * (committee member / society employee / external vendor) are all data,
 * never literals in the source.
 *
 * Sources, verified against backend/src/{Schema,SchemaMeta}.gs:
 *   Complaint_Categories   -> categoryId, categoryName, defaultAssigneeType, slaHours
 *   Complaint_Priorities   -> priorityId, priorityKey, priorityName, slaHours, colorToken
 *   Status_Config COMPLAINT-> OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED, REOPENED, CANCELLED
 */

import { useEntityOptions, useStatusOptions, useEnumOptions } from '@/lib/useConfigOptions';
import type { SelectOption } from '@/types/domain';

/** Complaint categories, from `config.entity.list` (Complaint_Categories sheet). */
export function useComplaintCategoryOptions(): { options: SelectOption[]; loading: boolean } {
  const { options, loading } = useEntityOptions(
    'complaintCategories',
    ['categoryId'],
    ['categoryName', 'categoryKey'],
  );
  return { options, loading };
}

/** Complaint priorities, from `config.entity.list` (Complaint_Priorities sheet).
 * The SRS names these Low / Medium / High / Emergency, but the rows are
 * configurable so the labels come from the sheet, not from a literal list. */
export function useComplaintPriorityOptions(): { options: SelectOption[]; loading: boolean } {
  const { options, loading } = useEntityOptions(
    'complaintPriorities',
    ['priorityId'],
    ['priorityName', 'priorityKey'],
  );
  return { options, loading };
}

/** Complaint statuses, from Status_Config domain COMPLAINT. */
export function useComplaintStatusOptions(): { options: SelectOption[]; loading: boolean } {
  return useStatusOptions('COMPLAINT');
}

/** Assignment target kind: MEMBER | EMPLOYEE | VENDOR | NONE (ASSIGNEE_TYPE). */
export function useAssigneeTypeOptions(): { options: SelectOption[]; loading: boolean } {
  return useEnumOptions('ASSIGNEE_TYPE');
}
