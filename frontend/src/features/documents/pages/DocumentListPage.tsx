/* DocumentListPage.tsx — FE-09 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody } from '@/components/ui/Card';

export default function DocumentListPage() {
  return (
    <div>
      <PageHeader title="Documents" subtitle="Society document repository" actions={<Button icon={<Icon name="upload" size={16} />}>Upload Document</Button>} />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Document list — FE-09.</p></CardBody></Card>
    </div>
  );
}
