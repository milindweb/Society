/* FlatFormPage.tsx — FE-05 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function FlatFormPage() {
  return (
    <div>
      <PageHeader title="Create Flat" subtitle="Add a new flat/unit" />
      <Card>
        <CardBody>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Flat form — to be implemented in FE-05.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
