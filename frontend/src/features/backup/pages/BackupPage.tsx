/* BackupPage.tsx — FE-14 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody } from '@/components/ui/Card';

export default function BackupPage() {
  return (
    <div>
      <PageHeader title="Backup & Archive" subtitle="Data backup and archive management" actions={<Button icon={<Icon name="download" size={16} />}>Create Backup</Button>} />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Backup & archive — FE-14.</p></CardBody></Card>
    </div>
  );
}
