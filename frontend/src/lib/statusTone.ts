/* statusTone.ts — Status key → visual tone mapping (design.md §8)
 *
 * The tone map is derived from Status_Config rows at runtime. The fallback
 * map below covers common statuses for the brief window before config loads. */

import { configStore } from '@/state/configStore';

export type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

/** Fallback tones for common statuses — used before config.enums loads. */
const FALLBACK_TONES: Record<string, Tone> = {
  OPEN: 'info',
  ASSIGNED: 'warning',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  REOPENED: 'danger',
  PENDING: 'warning',
  PARTIAL: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'neutral',
  COMPLETED: 'success',
  FAILED: 'danger',
  REVERSED: 'danger',
  INSIDE: 'info',
  EXITED: 'success',
  PRESENT: 'success',
  ABSENT: 'danger',
  LEAVE: 'warning',
  HALF_DAY: 'warning',
  HOLIDAY: 'neutral',
  DRAFT: 'neutral',
  APPROVED: 'success',
  PUBLISHED: 'success',
  UNPUBLISHED: 'neutral',
  EXPIRED: 'neutral',
  SCHEDULED: 'info',
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  ARCHIVED: 'neutral',
  AVAILABLE: 'success',
  OCCUPIED: 'info',
  BLOCKED: 'danger',
  VACANT: 'success',
  MAINTENANCE: 'warning',
  LOCKED: 'danger',
  POSTED: 'success',
  SUCCESS: 'success',
};

/** Build a tone map from config.enums.statuses. Each status row may have a
 *  `tone` field; otherwise we infer from the statusKey pattern. */
function buildToneMapFromConfig(): Record<string, Tone> {
  const enums = configStore.enums;
  if (!enums?.statuses) return {};

  const map: Record<string, Tone> = {};
  const statuses = enums.statuses as Record<string, Array<{ statusKey?: string; tone?: string }>>;

  for (const family of Object.values(statuses)) {
    for (const row of family) {
      if (!row.statusKey) continue;
      if (row.tone && ['info', 'success', 'warning', 'danger', 'neutral'].includes(row.tone)) {
        map[row.statusKey] = row.tone as Tone;
      }
    }
  }
  return map;
}

let cachedConfigMap: Record<string, Tone> | null = null;

export function getStatusTone(statusKey: string): Tone {
  if (cachedConfigMap === null) {
    cachedConfigMap = buildToneMapFromConfig();
  }
  return cachedConfigMap[statusKey] ?? FALLBACK_TONES[statusKey] ?? 'neutral';
}

/** Clear the cached config-derived tone map (call after configStore.setEnums). */
export function resetToneCache(): void {
  cachedConfigMap = null;
}

export function getStatusLabel(statusKey: string): string {
  return statusKey
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
