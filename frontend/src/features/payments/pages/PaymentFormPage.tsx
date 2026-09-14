/* PaymentFormPage.tsx — FE-06 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function PaymentFormPage() {
  return (
    <div>
      <PageHeader title="Record Payment" subtitle="Record a new payment" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Payment form — FE-06.</p></CardBody></Card>
    </div>
  );
}
