/* statusTone.test.ts — Tests for status tone mapping */

import { describe, it, expect } from 'vitest';
import { getStatusTone, getStatusLabel } from '@/lib/statusTone';

describe('getStatusTone', () => {
  it('returns info for OPEN', () => {
    expect(getStatusTone('OPEN')).toBe('info');
  });

  it('returns success for RESOLVED', () => {
    expect(getStatusTone('RESOLVED')).toBe('success');
  });

  it('returns warning for ASSIGNED', () => {
    expect(getStatusTone('ASSIGNED')).toBe('warning');
  });

  it('returns danger for REOPENED', () => {
    expect(getStatusTone('REOPENED')).toBe('danger');
  });

  it('returns neutral for CLOSED', () => {
    expect(getStatusTone('CLOSED')).toBe('neutral');
  });

  it('returns neutral for unknown status', () => {
    expect(getStatusTone('UNKNOWN_STATUS')).toBe('neutral');
  });

  it('returns success for PAID', () => {
    expect(getStatusTone('PAID')).toBe('success');
  });

  it('returns danger for OVERDUE', () => {
    expect(getStatusTone('OVERDUE')).toBe('danger');
  });

  it('returns success for COMPLETED', () => {
    expect(getStatusTone('COMPLETED')).toBe('success');
  });

  it('returns danger for FAILED', () => {
    expect(getStatusTone('FAILED')).toBe('danger');
  });

  it('returns success for PRESENT', () => {
    expect(getStatusTone('PRESENT')).toBe('success');
  });

  it('returns danger for ABSENT', () => {
    expect(getStatusTone('ABSENT')).toBe('danger');
  });

  it('returns neutral for empty string', () => {
    expect(getStatusTone('')).toBe('neutral');
  });

  it('returns success for AVAILABLE parking', () => {
    expect(getStatusTone('AVAILABLE')).toBe('success');
  });

  it('returns danger for LOCKED user', () => {
    expect(getStatusTone('LOCKED')).toBe('danger');
  });
});

describe('getStatusLabel', () => {
  it('converts IN_PROGRESS to "In Progress"', () => {
    expect(getStatusLabel('IN_PROGRESS')).toBe('In Progress');
  });

  it('converts OPEN to "Open"', () => {
    expect(getStatusLabel('OPEN')).toBe('Open');
  });

  it('converts multi-word with underscores', () => {
    expect(getStatusLabel('CANCELLED_MEETING')).toBe('Cancelled Meeting');
  });

  it('handles empty string', () => {
    expect(getStatusLabel('')).toBe('');
  });

  it('handles single word', () => {
    expect(getStatusLabel('PAID')).toBe('Paid');
  });
});
