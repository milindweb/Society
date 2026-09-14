/* AuditPage.tsx — FE-14 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function AuditPage() {
  return (
    <div>
      <PageHeader title="Audit Log" subtitle="System audit trail" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Audit log — FE-14.</p></CardBody></Card>
    </div>
  );
}
