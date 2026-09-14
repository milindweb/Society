/* dates.test.ts — Tests for date formatting and helpers */

import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateTime,
  toISODate,
  todayISO,
  getMonthName,
  getPeriodKey,
  getFinancialYear,
} from '@/lib/dates';

describe('formatDate', () => {
  it('formats ISO date in DD/MM/YYYY by default', () => {
    expect(formatDate('2026-09-15')).toBe('15/09/2026');
  });

  it('formats ISO date in YYYY-MM-DD', () => {
    expect(formatDate('2026-09-15', 'YYYY-MM-DD')).toBe('2026-09-15');
  });

  it('formats ISO datetime with time', () => {
    const result = formatDate('2026-09-15T14:30:00Z', 'DD/MM/YYYY HH:mm');
    expect(result).toBe('15/09/2026 14:30');
  });

  it('formats in MMM YYYY', () => {
    expect(formatDate('2026-01-01', 'MMM YYYY')).toBe('Jan 2026');
  });

  it('formats December in MMM YYYY', () => {
    expect(formatDate('2026-12-25', 'MMM YYYY')).toBe('Dec 2026');
  });

  it('returns input for invalid date string', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('returns input for empty string', () => {
    expect(formatDate('')).toBe('');
  });

  it('falls back to DD/MM/YYYY for unknown format', () => {
    expect(formatDate('2026-03-10', 'UNKNOWN')).toBe('10/03/2026');
  });

  it('formats first day of year', () => {
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
  });

  it('handles ISO datetime without explicit format', () => {
    expect(formatDate('2026-09-15T00:00:00Z')).toBe('15/09/2026');
  });
});

describe('formatDateTime', () => {
  it('formats datetime with DD/MM/YYYY HH:mm', () => {
    const result = formatDateTime('2026-09-15T08:45:00Z');
    expect(result).toBe('15/09/2026 08:45');
  });

  it('returns input for invalid datetime string', () => {
    expect(formatDateTime('invalid')).toBe('invalid');
  });
});

describe('toISODate', () => {
  it('converts Date to ISO date string', () => {
    const date = new Date(Date.UTC(2026, 8, 15));
    expect(toISODate(date)).toBe('2026-09-15');
  });

  it('pads month and day with leading zeros', () => {
    const date = new Date(Date.UTC(2026, 0, 5));
    expect(toISODate(date)).toBe('2026-01-05');
  });
});

describe('todayISO', () => {
  it('returns today in ISO format', () => {
    const result = todayISO();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getMonthName', () => {
  it('returns Jan for month 1', () => {
    expect(getMonthName(1)).toBe('Jan');
  });

  it('returns Dec for month 12', () => {
    expect(getMonthName(12)).toBe('Dec');
  });

  it('returns Jun for month 6', () => {
    expect(getMonthName(6)).toBe('Jun');
  });

  it('returns empty string for invalid month (0)', () => {
    expect(getMonthName(0)).toBe('');
  });

  it('returns empty string for month 13', () => {
    expect(getMonthName(13)).toBe('');
  });
});

describe('getPeriodKey', () => {
  it('returns YYYY-MM period key', () => {
    const date = new Date(Date.UTC(2026, 8, 15));
    expect(getPeriodKey(date)).toBe('2026-09');
  });

  it('pads single-digit months', () => {
    const date = new Date(Date.UTC(2026, 0, 1));
    expect(getPeriodKey(date)).toBe('2026-01');
  });
});

describe('getFinancialYear', () => {
  it('returns current year to next year for April', () => {
    const date = new Date(Date.UTC(2026, 3, 1));
    expect(getFinancialYear(date)).toBe('2026-27');
  });

  it('returns previous year to current year for March', () => {
    const date = new Date(Date.UTC(2026, 2, 31));
    expect(getFinancialYear(date)).toBe('2025-26');
  });

  it('returns current year range for September', () => {
    const date = new Date(Date.UTC(2026, 8, 1));
    expect(getFinancialYear(date)).toBe('2026-27');
  });

  it('returns previous year range for January', () => {
    const date = new Date(Date.UTC(2026, 0, 1));
    expect(getFinancialYear(date)).toBe('2025-26');
  });
});
