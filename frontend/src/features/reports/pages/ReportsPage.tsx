/* ReportsPage.tsx — FE-12 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate and download reports" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Reports — FE-12.</p></CardBody></Card>
    </div>
  );
}
