/* LedgerPage.tsx — FE-06 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function LedgerPage() {
  return (
    <div>
      <PageHeader title="Member Ledger" subtitle="Demand → Payment → Interest → Adjustment → Balance" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Ledger page — FE-06.</p></CardBody></Card>
    </div>
  );
}
