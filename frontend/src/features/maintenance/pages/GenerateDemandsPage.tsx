/* GenerateDemandsPage.tsx — FE-06 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function GenerateDemandsPage() {
  return (
    <div>
      <PageHeader title="Generate Demands" subtitle="Create demands for a billing period" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Generate demands — FE-06.</p></CardBody></Card>
    </div>
  );
}
