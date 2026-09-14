/* MemberFormPage.tsx — FE-05 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function MemberFormPage() {
  return (
    <div>
      <PageHeader title="Create Member" subtitle="Add a new member" />
      <Card>
        <CardBody>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Member form — to be implemented in FE-05.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
