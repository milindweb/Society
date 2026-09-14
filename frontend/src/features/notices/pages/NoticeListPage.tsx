/* NoticeListPage.tsx — FE-08 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody } from '@/components/ui/Card';

export default function NoticeListPage() {
  return (
    <div>
      <PageHeader title="Notices" subtitle="Society notices and announcements" actions={<Button icon={<Icon name="plus" size={16} />}>New Notice</Button>} />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Notice list — FE-08.</p></CardBody></Card>
    </div>
  );
}
