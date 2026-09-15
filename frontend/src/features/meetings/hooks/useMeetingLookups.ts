/* useMeetingLookups.ts — config-driven meeting options (FE-08)
 * SRS §8 / §15: meeting types are configurable rows, never literals in the source.
 *
 * Sources, verified against backend/src/{Schema,SchemaMeta,ConfigService}.gs:
 *   Meeting_Types          -> meetingTypeId, typeKey, typeName, quorumPercent
 *   Status_Config MEETING  -> SCHEDULED, COMPLETED, CANCELLED, POSTPONED
 *   ENUM ATTENDEE_TYPE     -> MEMBER, EMPLOYEE, VENDOR, GUEST
 *
 * ⚠️ REMAPPING REQUIRED, unlike notices.
 * `config.entity.list` returns Meeting_Types rows keyed by their row id
 * (`meetingTypeId`), but `Meetings.meetingTypeKey` stores the row's **`typeKey`**
 * — `CommunicationService.createMeeting` validates with
 * `findByUnique('Meeting_Types', { typeKey: ... })` and `buildMeetingTypeMap`
 * builds `map[rec.typeKey]`. So the option value here is intentionally the
 * `typeKey`, not the id. Getting this wrong makes every create fail with
 * "Meeting type not found." */

import { useEntityOptions, useStatusOptions, useEnumOptions } from '@/lib/useConfigOptions';
import type { SelectOption } from '@/types/domain';

/** Meeting types. The option VALUE is the typeKey — see the note above. */
export function useMeetingTypeOptions(): { options: SelectOption[]; loading: boolean } {
  const { options, loading } = useEntityOptions(
    'meetingTypes',
    /* value: prefer typeKey (what Meetings actually stores), fall back to the id */
    ['typeKey', 'meetingTypeId'],
    ['typeName', 'typeKey'],
  );
  return { options, loading };
}

/** Meeting statuses, from Status_Config domain MEETING. */
export function useMeetingStatusOptions(): { options: SelectOption[]; loading: boolean } {
  return useStatusOptions('MEETING');
}

/** Who attended: MEMBER | EMPLOYEE | VENDOR | GUEST. */
export function useAttendeeTypeOptions(): { options: SelectOption[]; loading: boolean } {
  return useEnumOptions('ATTENDEE_TYPE');
}
