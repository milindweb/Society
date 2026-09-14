/* ExpenseDetailPage.tsx — FE-11 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function ExpenseDetailPage() {
  return (
    <div>
      <PageHeader title="Expense Details" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Expense detail — FE-11.</p></CardBody></Card>
    </div>
  );
}
