/* EmployeeDetailPage.tsx — FE-10 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function EmployeeDetailPage() {
  return (
    <div>
      <PageHeader title="Employee Details" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Employee detail — FE-10.</p></CardBody></Card>
    </div>
  );
}
