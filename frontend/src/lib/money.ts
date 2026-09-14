/* money.ts — Money formatting (design.md §6 — config-driven currency) */

import { getConfigSnapshot } from '@/state/configStore';

export function formatMoney(
  amount: number,
  options?: { showSign?: boolean; compact?: boolean },
): string {
  const { config } = getConfigSnapshot();
  const currencyCode = config?.currencyCode ?? 'INR';
  const currencySymbol = config?.currencySymbol ?? '₹';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : options?.showSign && amount > 0 ? '+' : '';

  if (options?.compact && abs >= 100000) {
    const inLakhs = abs / 100000;
    return `${sign}${currencySymbol}${inLakhs.toFixed(1)}L`;
  }
  if (options?.compact && abs >= 1000) {
    const inK = abs / 1000;
    return `${sign}${currencySymbol}${inK.toFixed(1)}K`;
  }

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    currency: currencyCode,
    style: 'currency',
  }).format(abs);

  return `${sign}${formatted}`;
}

export function parseMoneyInput(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
}
