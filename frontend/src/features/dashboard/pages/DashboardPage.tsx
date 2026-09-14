/* DashboardPage.tsx — design.md §6, §10: KPI row + recent activity */

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/data/KpiCard';
import { AmountText } from '@/components/data/AmountText';
import { DataTable, type Column } from '@/components/data/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { DashboardSummary, Payment, Complaint } from '@/types/domain';

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    import('@/services/dashboardService')
      .then(({ getDashboardSummary }) => getDashboardSummary())
      .then((res) => {
        setSummary(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
        setLoading(false);
      });
  };

  useEffect(load, []);

  const paymentColumns: Column<Payment>[] = [
    { key: 'receiptNumber', header: 'Receipt' },
    { key: 'flatNumber', header: 'Flat' },
    { key: 'amount', header: 'Amount', align: 'right', render: (r) => <AmountText amount={r.amount} /> },
    { key: 'paymentDate', header: 'Date', render: (r) => formatDate(r.paymentDate) },
    { key: 'statusKey', header: 'Status', render: (r) => <StatusBadge statusKey={r.statusKey} /> },
  ];

  const complaintColumns: Column<Complaint>[] = [
    { key: 'complaintNumber', header: 'No' },
    { key: 'title', header: 'Title' },
    { key: 'flatNumber', header: 'Flat' },
    { key: 'statusKey', header: 'Status', render: (r) => <StatusBadge statusKey={r.statusKey} /> },
    { key: 'createdAt', header: 'Date', render: (r) => formatDate(r.createdAt) },
  ];

  if (error) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Overview and current activity" />
        <ErrorState title="Could not load dashboard" message={error} onRetry={load} />
      </div>
    );
  }

  const finance = summary?.finance;
  const fm = summary?.flatsMembers;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview and current activity" />

      <div className="hs-grid hs-grid-cols-2 hs-lg-grid-cols-4" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        <KpiCard label="Total Flats" value={loading ? '…' : (fm?.totalFlats ?? 0)} icon={<Icon name="flats" />} />
        <KpiCard label="Total Members" value={loading ? '…' : (fm?.totalMembers ?? 0)} icon={<Icon name="members" />} />
        <KpiCard label="Total Demand" value={loading ? '…' : formatMoney(finance?.totalDemand ?? 0)} icon={<Icon name="payments" />} />
        <KpiCard label="Outstanding" value={loading ? '…' : formatMoney(finance?.totalOutstanding ?? 0)} icon={<Icon name="warning" />} />
      </div>

      <div className="hs-grid hs-grid-cols-1" style={{ gap: 'var(--space-4)' }}>
        <Card>
          <CardHeader title="Recent Payments" />
          <CardBody>
            <DataTable
              columns={paymentColumns}
              data={summary?.recentPayments ?? []}
              loading={loading}
              getRowId={(r) => r.paymentId}
              emptyTitle="No recent payments"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent Complaints" />
          <CardBody>
            <DataTable
              columns={complaintColumns}
              data={summary?.recentComplaints ?? []}
              loading={loading}
              getRowId={(r) => r.complaintId}
              emptyTitle="No recent complaints"
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
