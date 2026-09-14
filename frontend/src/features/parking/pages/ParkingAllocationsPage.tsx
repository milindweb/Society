/* ParkingAllocationsPage.tsx — FE-09 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function ParkingAllocationsPage() {
  return (
    <div>
      <PageHeader title="Parking Allocations" subtitle="Active parking allocations" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Parking allocations — FE-09.</p></CardBody></Card>
    </div>
  );
}
