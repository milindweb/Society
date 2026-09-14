/* MemberDetailPage.tsx — FE-05 */

import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';

export default function MemberDetailPage() {
  const { memberId } = useParams<{ memberId: string }>();

  return (
    <div>
      <PageHeader title="Member Details" subtitle={`Member ${memberId}`} />
      <Card>
        <CardHeader title="Member Information" />
        <CardBody>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Member detail page — to be implemented in FE-05.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
