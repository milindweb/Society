/* MeetingListPage.tsx — FE-08 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody } from '@/components/ui/Card';

export default function MeetingListPage() {
  return (
    <div>
      <PageHeader title="Meetings" subtitle="AGM, SGM and committee meetings" actions={<Button icon={<Icon name="plus" size={16} />}>New Meeting</Button>} />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Meeting list — FE-08.</p></CardBody></Card>
    </div>
  );
}
