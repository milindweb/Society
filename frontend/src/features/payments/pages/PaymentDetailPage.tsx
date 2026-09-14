/* PaymentDetailPage.tsx — FE-06 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function PaymentDetailPage() {
  return (
    <div>
      <PageHeader title="Payment Details" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Payment detail — FE-06.</p></CardBody></Card>
    </div>
  );
}
