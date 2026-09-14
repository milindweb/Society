/* ExpenseListPage.tsx — FE-11 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody } from '@/components/ui/Card';

export default function ExpenseListPage() {
  return (
    <div>
      <PageHeader title="Expenses" subtitle="Society expense management" actions={<Button icon={<Icon name="plus" size={16} />}>Add Expense</Button>} />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Expense list — FE-11.</p></CardBody></Card>
    </div>
  );
}
