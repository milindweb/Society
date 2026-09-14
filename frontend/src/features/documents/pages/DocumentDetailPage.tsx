/* DocumentDetailPage.tsx — FE-09 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function DocumentDetailPage() {
  return (
    <div>
      <PageHeader title="Document Details" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Document detail — FE-09.</p></CardBody></Card>
    </div>
  );
}
