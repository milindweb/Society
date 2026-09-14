/* SalaryPage.tsx — FE-10 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function SalaryPage() {
  return (
    <div>
      <PageHeader title="Salary" subtitle="Employee salary management" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Salary — FE-10.</p></CardBody></Card>
    </div>
  );
}
