/* ParkingListPage.tsx — FE-09 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody } from '@/components/ui/Card';

export default function ParkingListPage() {
  return (
    <div>
      <PageHeader title="Parking" subtitle="Parking slots and allocations" actions={<Button icon={<Icon name="plus" size={16} />}>Allocate Slot</Button>} />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Parking list — FE-09.</p></CardBody></Card>
    </div>
  );
}
