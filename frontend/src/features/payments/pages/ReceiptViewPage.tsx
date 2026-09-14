/* ReceiptViewPage.tsx — FE-06 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function ReceiptViewPage() {
  return (
    <div>
      <PageHeader title="Receipt" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Receipt view — FE-06.</p></CardBody></Card>
    </div>
  );
}
