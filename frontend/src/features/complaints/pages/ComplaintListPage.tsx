/* ComplaintListPage.tsx — FE-07 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody } from '@/components/ui/Card';

export default function ComplaintListPage() {
  return (
    <div>
      <PageHeader title="Complaints" subtitle="Track and manage complaints" actions={<Button icon={<Icon name="plus" size={16} />}>New Complaint</Button>} />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Complaint list — FE-07.</p></CardBody></Card>
    </div>
  );
}
