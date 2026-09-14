/* VisitorFormPage.tsx — FE-07 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function VisitorFormPage() {
  return (
    <div>
      <PageHeader title="Log Visitor" subtitle="Quick visitor entry" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Visitor form — FE-07.</p></CardBody></Card>
    </div>
  );
}
