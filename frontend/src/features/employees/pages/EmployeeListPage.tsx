/* EmployeeListPage.tsx — FE-10 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody } from '@/components/ui/Card';

export default function EmployeeListPage() {
  return (
    <div>
      <PageHeader title="Employees" subtitle="Society employees" actions={<Button icon={<Icon name="plus" size={16} />}>Add Employee</Button>} />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Employee list — FE-10.</p></CardBody></Card>
    </div>
  );
}
