/* DemandDetailPage.tsx — FE-06 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function DemandDetailPage() {
  return (
    <div>
      <PageHeader title="Demand Details" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Demand detail — FE-06.</p></CardBody></Card>
    </div>
  );
}
