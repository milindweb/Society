/* ComplaintDetailPage.tsx — FE-07 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function ComplaintDetailPage() {
  return (
    <div>
      <PageHeader title="Complaint Details" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Complaint detail — FE-07.</p></CardBody></Card>
    </div>
  );
}
