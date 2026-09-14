/* PeriodListPage.tsx — FE-06 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function PeriodListPage() {
  return (
    <div>
      <PageHeader title="Billing Periods" subtitle="Manage billing periods" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Period list — FE-06.</p></CardBody></Card>
    </div>
  );
}
