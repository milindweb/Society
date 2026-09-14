/* MaintenanceDashboardPage.tsx — FE-06 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function MaintenanceDashboardPage() {
  return (
    <div>
      <PageHeader title="Maintenance Dashboard" subtitle="Demand, collection and outstanding overview" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Maintenance dashboard — FE-06.</p></CardBody></Card>
    </div>
  );
}
