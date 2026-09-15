/* useNoticeLookups.ts — config-driven notice options (FE-08)
 * SRS §6 / §15: notice types are configurable rows, never literals in the source.
 *
 * Sources, verified against backend/src/{Schema,SchemaMeta,ConfigService}.gs:
 *   Notice_Types              -> noticeTypeId, typeKey, typeName, requiresAttachment
 *   Status_Config NOTICE      -> DRAFT, PUBLISHED, EXPIRED
 *   ENUM AUDIENCE_TYPE        -> ALL, ROLE, WING, FLAT, MEMBER
 *
 * `useEntityOptions` keys on the row id, which is exactly what `Notices.noticeTypeId`
 * stores — so no remapping is needed here (unlike meetings, see useMeetingLookups). */

import { useEntityOptions, useStatusOptions, useEnumOptions } from '@/lib/useConfigOptions';
import type { SelectOption } from '@/types/domain';

/** Notice types, from `config.entity.list` (Notice_Types sheet). */
export function useNoticeTypeOptions(): { options: SelectOption[]; loading: boolean } {
  const { options, loading } = useEntityOptions(
    'noticeTypes',
    ['noticeTypeId'],
    ['typeName', 'typeKey'],
  );
  return { options, loading };
}

/** Notice statuses, from Status_Config domain NOTICE (DRAFT / PUBLISHED / EXPIRED). */
export function useNoticeStatusOptions(): { options: SelectOption[]; loading: boolean } {
  return useStatusOptions('NOTICE');
}

/** Who a notice targets: ALL | ROLE | WING | FLAT | MEMBER.
 * The service validates against this same list, so it is the authoritative set. */
export function useAudienceTypeOptions(): { options: SelectOption[]; loading: boolean } {
  return useEnumOptions('AUDIENCE_TYPE');
}
