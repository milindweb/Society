/* useAttendanceLookups.ts — config-driven attendance options (FE-10)
 * SRS §15: attendance statuses are configuration data.
 *
 * Source: Status_Config domain ATTENDANCE (`Setup.gs:70`)
 *   PRESENT / ABSENT / LEAVE / HALF_DAY / HOLIDAY
 * which matches HRService.gs:15 exactly — the two cannot drift without the seed
 * changing too. */

import { useStatusOptions } from '@/lib/useConfigOptions';
import type { SelectOption } from '@/types/domain';

/** Attendance statuses, from Status_Config domain **ATTENDANCE**. */
export function useAttendanceStatusOptions(): { options: SelectOption[]; loading: boolean } {
  return useStatusOptions('ATTENDANCE');
}
