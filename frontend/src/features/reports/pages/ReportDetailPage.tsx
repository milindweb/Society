/* ReportDetailPage.tsx — FE-12 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function ReportDetailPage() {
  return (
    <div>
      <PageHeader title="Report" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Report detail — FE-12.</p></CardBody></Card>
    </div>
  );
}
