/* LedgerStep.tsx — one stage of the ledger narrative (FE-06)
 * SRS §4 renders the money story as Demand → Payment → Interest → Adjustment →
 * Pending → Balance. Each stage is one of these cards.
 *
 * `amount === null` means the backend does not break that stage out as a single
 * figure (it appears only inside the entry rows) — the card says so rather than
 * inventing a number. This component never computes a total. */

import { AmountText } from '@/components/data/AmountText';

interface LedgerStepProps {
  label: string;
  amount: number | null;
  hint: string;
  emphasis?: boolean;
}

export function LedgerStep({ label, amount, hint, emphasis = false }: LedgerStepProps) {
  return (
    <div style={{ minWidth: 150 }}>
      <div
        style={{
          fontSize: 'var(--text-xs)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--color-text-muted)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: emphasis ? 'var(--text-xl)' : 'var(--text-lg)',
          fontWeight: emphasis ? 700 : 600,
          marginTop: 'var(--space-1)',
        }}
      >
        {amount === null ? '—' : <AmountText amount={amount} />}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
        {hint}
      </div>
    </div>
  );
}
