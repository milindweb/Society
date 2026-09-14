/* DashboardPage.tsx — FE-04 stub (will be fully implemented in FE-04) */

import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/data/KpiCard';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview and current activity" />

      <div className="hs-grid hs-grid-cols-1" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        <div className="hs-grid hs-grid-cols-2" style={{ gap: 'var(--space-4)' }}>
          <KpiCard label="Total Flats" value="0" icon={<Icon name="flats" />} />
          <KpiCard label="Total Members" value="0" icon={<Icon name="members" />} />
          <KpiCard label="Monthly Demand" value="₹0" icon={<Icon name="payments" />} />
          <KpiCard label="Outstanding" value="₹0" icon={<Icon name="warning" />} />
        </div>
      </div>

      <div className="hs-grid hs-grid-cols-1" style={{ gap: 'var(--space-4)' }}>
        <Card>
          <CardHeader title="Recent Activity" />
          <CardBody>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              Dashboard will be fully implemented in FE-04 phase.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
