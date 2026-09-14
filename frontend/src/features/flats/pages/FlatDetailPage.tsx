/* FlatDetailPage.tsx — FE-05 */

import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';

export default function FlatDetailPage() {
  const { flatId } = useParams<{ flatId: string }>();

  return (
    <div>
      <PageHeader title="Flat Details" subtitle={`Flat ${flatId}`} />
      <Card>
        <CardHeader title="Flat Information" />
        <CardBody>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Flat detail page — to be implemented in FE-05.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
