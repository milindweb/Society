/* MeetingDetailPage.tsx — FE-08 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function MeetingDetailPage() {
  return (
    <div>
      <PageHeader title="Meeting Details" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Meeting detail — FE-08.</p></CardBody></Card>
    </div>
  );
}
