/* money.test.ts — Tests for money formatting helpers */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatMoney, parseMoneyInput } from '@/lib/money';

vi.mock('@/state/configStore', () => ({
  getConfigSnapshot: vi.fn(() => ({
    config: { currencyCode: 'INR', currencySymbol: '₹' },
    enums: null,
    loaded: true,
  })),
}));

import { getConfigSnapshot } from '@/state/configStore';

describe('formatMoney', () => {
  beforeEach(() => {
    vi.mocked(getConfigSnapshot).mockReturnValue({
      config: { currencyCode: 'INR', currencySymbol: '₹' },
      enums: null,
      loaded: true,
    });
  });

  it('formats a basic positive amount', () => {
    const result = formatMoney(1234.5);
    expect(result).toContain('₹');
    expect(result).toContain('1,234.50');
  });

  it('formats zero', () => {
    expect(formatMoney(0)).toContain('0.00');
  });

  it('formats negative amount with minus sign', () => {
    const result = formatMoney(-500);
    expect(result).toMatch(/^-.*₹.*500/);
  });

  it('shows + sign when showSign is true and amount is positive', () => {
    const result = formatMoney(100, { showSign: true });
    expect(result).toMatch(/^\+.*₹/);
  });

  it('does not show + sign when showSign is true but amount is negative', () => {
    const result = formatMoney(-100, { showSign: true });
    expect(result).toMatch(/^-/);
    expect(result).not.toContain('+');
  });

  it('does not show + sign when showSign is false', () => {
    const result = formatMoney(100, { showSign: false });
    expect(result).not.toContain('+');
  });

  it('compacts lakhs (>=100000)', () => {
    const result = formatMoney(250000, { compact: true });
    expect(result).toBe('₹2.5L');
  });

  it('compacts thousands (>=1000)', () => {
    const result = formatMoney(5500, { compact: true });
    expect(result).toBe('₹5.5K');
  });

  it('does not compact amounts under 1000', () => {
    const result = formatMoney(999, { compact: true });
    expect(result).toContain('999.00');
  });

  it('compacts negative amounts', () => {
    const result = formatMoney(-150000, { compact: true });
    expect(result).toBe('-₹1.5L');
  });

  it('uses default INR when config has no currency', () => {
    vi.mocked(getConfigSnapshot).mockReturnValue({
      config: null,
      enums: null,
      loaded: false,
    });
    const result = formatMoney(100);
    expect(result).toContain('₹');
  });

  it('uses config currency symbol and code when available', () => {
    vi.mocked(getConfigSnapshot).mockReturnValue({
      config: { currencyCode: 'USD', currencySymbol: '$' },
      enums: null,
      loaded: true,
    });
    const result = formatMoney(100);
    expect(result).toContain('$');
    expect(result).toContain('100.00');
  });
});

describe('parseMoneyInput', () => {
  it('parses a valid numeric string', () => {
    expect(parseMoneyInput('1234.56')).toBe(1234.56);
  });

  it('strips non-numeric characters', () => {
    expect(parseMoneyInput('₹1,234.56')).toBe(1234.56);
  });

  it('handles negative values', () => {
    expect(parseMoneyInput('-500')).toBe(-500);
  });

  it('handles empty string', () => {
    expect(parseMoneyInput('')).toBe(0);
  });

  it('handles non-numeric string', () => {
    expect(parseMoneyInput('abc')).toBe(0);
  });

  it('rounds to 2 decimal places', () => {
    expect(parseMoneyInput('10.126')).toBe(10.13);
  });

  it('handles value with only special characters', () => {
    expect(parseMoneyInput('₹$$')).toBe(0);
  });

  it('handles mixed input', () => {
    expect(parseMoneyInput('Price: ₹500.75')).toBe(500.75);
  });
});
