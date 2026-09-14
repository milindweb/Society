/* NoticeDetailPage.tsx — FE-08 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function NoticeDetailPage() {
  return (
    <div>
      <PageHeader title="Notice Details" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Notice detail — FE-08.</p></CardBody></Card>
    </div>
  );
}
