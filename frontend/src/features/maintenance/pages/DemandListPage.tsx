/* DemandListPage.tsx — FE-06 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody } from '@/components/ui/Card';

export default function DemandListPage() {
  return (
    <div>
      <PageHeader
        title="Demands"
        subtitle="Monthly maintenance demands"
        actions={<Button icon={<Icon name="plus" size={16} />}>Generate Demands</Button>}
      />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Demand list — FE-06.</p></CardBody></Card>
    </div>
  );
}
