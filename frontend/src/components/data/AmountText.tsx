/* AmountText.tsx — design.md §80: money display component */

import { formatMoney } from '@/lib/money';

interface AmountTextProps {
  amount: number;
  compact?: boolean;
  showSign?: boolean;
  className?: string;
}

export function AmountText({ amount, compact, showSign, className = '' }: AmountTextProps) {
  return (
    <span className={`hs-mono ${className}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {formatMoney(amount, { compact, showSign })}
    </span>
  );
}
