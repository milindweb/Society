/* DashboardPage.tsx — FE-04
 * SRS §2: role-aware dashboard — KPI row, recent payments/complaints/notices/visitors as
 *         COMPACT TABLES (not large cards), quick actions.
 * design.md §6: PageHeader -> KPI row -> primary data -> recent activity tables.
 * design.md §5: sections and quick actions are permission-derived, never a hardcoded role list.
 * Layering (frontend-architecture.md §1): page composes; useDashboard owns the fetch. */

import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { type Column } from '@/components/data/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AmountText } from '@/components/data/AmountText';
import { ErrorState } from '@/components/ui/ErrorState';
import { PermissionGate } from '@/app/PermissionGate';
import { KpiRow } from '../components/KpiRow';
import { RecentTable } from '../components/RecentTable';
import { useDashboard } from '../hooks/useDashboard';
import { formatDate } from '@/lib/dates';
import type { Payment, Complaint, Notice, Visitor } from '@/types/domain';

const DashboardCharts = lazy(() => import('../components/DashboardCharts'));

export default function DashboardPage() {
  const navigate = useNavigate();
  const { summary, loading, error, reload } = useDashboard();

  const paymentColumns: Column<Payment>[] = [
    { key: 'receiptNumber', header: 'Receipt', render: (r) => r.receiptNumber ?? '—' },
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
    { key: 'raisedAt', header: 'Date', render: (r) => formatDate(r.raisedAt) },
  ];

  const noticeColumns: Column<Notice>[] = [
    { key: 'title', header: 'Title' },
    { key: 'noticeTypeName', header: 'Type', render: (r) => r.noticeTypeName ?? '—' },
    { key: 'noticeDate', header: 'Date', render: (r) => formatDate(r.noticeDate) },
    {
      key: 'isPublished',
      header: 'Status',
      render: (r) => <StatusBadge statusKey={r.isPublished === 'TRUE' ? 'PUBLISHED' : 'DRAFT'} />,
    },
  ];

  const visitorColumns: Column<Visitor>[] = [
    { key: 'visitorName', header: 'Visitor' },
    { key: 'flatNumber', header: 'Flat' },
    { key: 'visitorTypeName', header: 'Type', render: (r) => r.visitorTypeName ?? '—' },
    { key: 'entryAt', header: 'Entry', render: (r) => formatDate(r.entryAt) },
    { key: 'statusKey', header: 'Status', render: (r) => <StatusBadge statusKey={r.statusKey} /> },
  ];

  if (error) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Overview and current activity" />
        <ErrorState title="Could not load dashboard" message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  const recentPayments = summary?.recentPayments ?? [];
  const recentComplaints = summary?.recentComplaints ?? [];
  const recentNotices = summary?.recentNotices ?? [];
  const recentVisitors = summary?.recentVisitors ?? [];
  const quickActions = summary?.quickActions ?? [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview and current activity"
        actions={
          <Button
            variant="secondary"
            icon={<Icon name="refresh" size={16} />}
            onClick={() => void reload()}
            loading={loading}
          >
            Refresh
          </Button>
        }
      />

      <KpiRow summary={summary} loading={loading} />

      <Suspense>
        <DashboardCharts summary={summary} loading={loading} />
      </Suspense>

      {quickActions.length > 0 && (
        <Card style={{ marginBottom: 'var(--space-5)' }}>
          <CardBody>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {quickActions.map((action) => (
                <PermissionGate key={action.route} permission={action.permission}>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={action.icon ? <Icon name={action.icon as never} size={16} /> : undefined}
                    onClick={() => navigate(action.route)}
                  >
                    {action.label}
                  </Button>
                </PermissionGate>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <div
        className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
        style={{ gap: 'var(--space-4)' }}
      >
        <RecentTable<Payment>
          title="Recent Payments"
          permission="payments.read"
          columns={paymentColumns}
          data={recentPayments}
          loading={loading}
          getRowId={(r) => r.paymentId}
          emptyTitle="No recent payments"
          onRowClick={(r) => navigate(`/payments/${r.paymentId}`)}
        />

        <RecentTable<Complaint>
          title="Recent Complaints"
          permission="complaints.read"
          columns={complaintColumns}
          data={recentComplaints}
          loading={loading}
          getRowId={(r) => r.complaintId}
          emptyTitle="No recent complaints"
          onRowClick={(r) => navigate(`/complaints/${r.complaintId}`)}
        />

        <RecentTable<Notice>
          title="Recent Notices"
          permission="notices.read"
          columns={noticeColumns}
          data={recentNotices}
          loading={loading}
          getRowId={(r) => r.noticeId}
          emptyTitle="No recent notices"
          onRowClick={(r) => navigate(`/notices/${r.noticeId}`)}
        />

        <RecentTable<Visitor>
          title="Recent Visitors"
          permission="visitors.read"
          columns={visitorColumns}
          data={recentVisitors}
          loading={loading}
          getRowId={(r) => r.visitorId}
          emptyTitle="No recent visitors"
        />
      </div>
    </div>
  );
}
