/* statusTone.ts — Status key → visual tone mapping (design.md §8) */

export type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const STATUS_TONE_MAP: Record<string, Tone> = {
  /* Complaint */
  OPEN: 'info',
  ASSIGNED: 'warning',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  REOPENED: 'danger',

  /* Demand */
  PENDING: 'warning',
  PARTIAL: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'neutral',

  /* Payment */
  COMPLETED: 'success',
  FAILED: 'danger',
  REVERSED: 'danger',

  /* Visitor */
  INSIDE: 'info',
  EXITED: 'success',

  /* Attendance */
  PRESENT: 'success',
  ABSENT: 'danger',
  LEAVE: 'warning',
  HALF_DAY: 'warning',
  HOLIDAY: 'neutral',

  /* Salary */
  DRAFT: 'neutral',
  APPROVED: 'success',
  PAID_SALARY: 'success',

  /* Notice */
  PUBLISHED: 'success',
  UNPUBLISHED: 'neutral',
  EXPIRED: 'neutral',

  /* Meeting */
  SCHEDULED: 'info',
  COMPLETED_MEETING: 'success',
  CANCELLED_MEETING: 'neutral',

  /* Document */
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  ARCHIVED: 'neutral',
  EXPIRED_DOC: 'danger',

  /* Parking */
  AVAILABLE: 'success',
  OCCUPIED: 'info',
  BLOCKED: 'danger',

  /* Flat / Entity */
  VACANT: 'success',
  MAINTENANCE: 'warning',

  /* User */
  ACTIVE_USER: 'success',
  INACTIVE_USER: 'neutral',
  LOCKED: 'danger',

  /* Expense */
  EXPENSE_CANCELLED: 'neutral',

  /* Billing */
  OPEN_PERIOD: 'info',
  LOCKED_PERIOD: 'warning',
  CLOSED_PERIOD: 'neutral',
};

export function getStatusTone(statusKey: string): Tone {
  return STATUS_TONE_MAP[statusKey] ?? 'neutral';
}

export function getStatusLabel(statusKey: string): string {
  return statusKey
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
