/* AttendancePage.tsx — FE-10 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default function AttendancePage() {
  return (
    <div>
      <PageHeader title="Attendance" subtitle="Employee attendance tracking" />
      <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Attendance — FE-10.</p></CardBody></Card>
    </div>
  );
}
