/* FlatDetailPage.tsx — FE-05
 * design.md §36: detail page = PageHeader + breadcrumbs + summary cards + tabs.
 * Read-only composition over useFlat + useMemberList. Money is rendered, never computed (SRS §8). */

import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { DataTable, type Column } from '@/components/data/DataTable';
import { AmountText } from '@/components/data/AmountText';
import { KpiCard } from '@/components/data/KpiCard';
import { PermissionGate } from '@/app/PermissionGate';
import { useFlat } from '../hooks/useFlats';
import { useMemberList } from '@/features/members/hooks/useMembers';
import { configStore } from '@/state/configStore';
import { formatEnumKey } from '@/lib/format';
import type { Member } from '@/types/domain';

export default function FlatDetailPage() {
  const navigate = useNavigate();
  const { flatId } = useParams<{ flatId: string }>();
  const { flat, loading, error, reload } = useFlat(flatId);
  const { members, loading: membersLoading } = useMemberList(flatId ? { flatId } : undefined);

  const dateFormat = configStore.config?.dateDisplayFormat ?? 'DD/MM/YYYY';

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner />
      </div>
    );
  }

  if (error || !flat) {
    return (
      <div>
        <PageHeader title="Flat Details" />
        <ErrorState
          title="Flat not found"
          message={error ?? 'This flat may have been removed.'}
          onRetry={() => void reload()}
        />
      </div>
    );
  }

  const memberColumns: Column<Member>[] = [
    {
      key: 'fullName',
      header: 'Name',
      render: (r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {r.fullName}
          {r.isPrimary && <Badge variant="info">Primary</Badge>}
        </span>
      ),
    },
    { key: 'memberCode', header: 'Code' },
    { key: 'relationType', header: 'Relation', render: (r) => formatEnumKey(r.relationType) },
    { key: 'mobile', header: 'Mobile' },
    { key: 'statusKey', header: 'Status', render: (r) => <StatusBadge statusKey={r.statusKey} /> },
  ];

  const overview = (
    <div className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2" style={{ gap: 'var(--space-4)' }}>
      <Card>
        <CardHeader title="Flat Information" />
        <CardBody>
          <DescriptionList
            items={[
              { label: 'Flat Number', value: flat.flatNumber },
              { label: 'Wing', value: flat.wingName || '—' },
              { label: 'Floor', value: String(flat.floor) },
              { label: 'Type', value: flat.flatTypeName || '—' },
              {
                label: 'Carpet Area',
                value: flat.carpetArea != null ? `${flat.carpetArea} sq.ft` : '—',
              },
              { label: 'Status', value: <StatusBadge statusKey={flat.statusKey} /> },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Ownership" />
        <CardBody>
          <DescriptionList
            items={[
              {
                label: 'Owner',
                value: flat.ownerMemberId ? (
                  <Button
                    variant="link"
                    onClick={() => navigate(`/members/${flat.ownerMemberId}`)}
                  >
                    {flat.ownerName || flat.ownerMemberId}
                  </Button>
                ) : (
                  '—'
                ),
              },
              {
                label: 'Tenant',
                value: flat.tenantMemberId ? (
                  <Button
                    variant="link"
                    onClick={() => navigate(`/members/${flat.tenantMemberId}`)}
                  >
                    {flat.tenantName || flat.tenantMemberId}
                  </Button>
                ) : (
                  '—'
                ),
              },
              { label: 'Parking Slot', value: flat.parkingSlotId || '—' },
              { label: 'Active', value: flat.isActive ? 'Yes' : 'No' },
              { label: 'Display Format', value: dateFormat },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );

  const finance = flat.balanceSummary ? (
    <div>
      <div className="hs-grid hs-grid-cols-2 hs-lg-grid-cols-4" style={{ gap: 'var(--space-4)' }}>
        <KpiCard
          label="Total Demand"
          value={String(flat.balanceSummary.totalDemand)}
          icon={<Icon name="maintenance" size={20} />}
        />
        <KpiCard
          label="Total Paid"
          value={String(flat.balanceSummary.totalPaid)}
          icon={<Icon name="payments" size={20} />}
        />
        <KpiCard
          label="Outstanding"
          value={String(flat.balanceSummary.totalOutstanding)}
          icon={<Icon name="alert" size={20} />}
        />
        <KpiCard
          label="Overdue"
          value={String(flat.balanceSummary.overdueAmount)}
          icon={<Icon name="clock" size={20} />}
        />
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-6)',
          marginTop: 'var(--space-4)',
          fontSize: 'var(--text-sm)',
        }}
      >
        <span>
          <span style={{ color: 'var(--color-text-muted)' }}>Demand: </span>
          <AmountText amount={flat.balanceSummary.totalDemand} />
        </span>
        <span>
          <span style={{ color: 'var(--color-text-muted)' }}>Paid: </span>
          <AmountText amount={flat.balanceSummary.totalPaid} />
        </span>
        <span>
          <span style={{ color: 'var(--color-text-muted)' }}>Outstanding: </span>
          <AmountText amount={flat.balanceSummary.totalOutstanding} />
        </span>
        <span>
          <span style={{ color: 'var(--color-text-muted)' }}>Overdue: </span>
          <AmountText amount={flat.balanceSummary.overdueAmount} />
        </span>
      </div>
      <p
        style={{
          marginTop: 'var(--space-3)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-muted)',
        }}
      >
        Figures are supplied by the backend ledger. The frontend never recalculates money (SRS §8).
      </p>
    </div>
  ) : (
    <EmptyState
      title="No balance information"
      description="This flat has no demand or payment history yet."
      icon={<Icon name="payments" size={40} />}
    />
  );

  const membersTab = (
    <DataTable
      columns={memberColumns}
      data={members}
      loading={membersLoading}
      onRowClick={(r) => navigate(`/members/${r.memberId}`)}
      getRowId={(r) => r.memberId}
      emptyTitle="No members linked"
      emptyDescription="No owner, tenant or family member is mapped to this flat yet."
      emptyAction={
        <PermissionGate permission="members.create">
          <Button icon={<Icon name="plus" size={16} />} onClick={() => navigate('/members/new')}>
            Add Member
          </Button>
        </PermissionGate>
      }
    />
  );

  return (
    <div>
      <PageHeader
        title={`Flat ${flat.flatNumber}`}
        subtitle={flat.wingName ? `${flat.wingName} Wing · Floor ${flat.floor}` : `Floor ${flat.floor}`}
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Flats', route: '/flats', onClick: () => navigate('/flats') },
              { label: flat.flatNumber },
            ]}
          />
        }
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="ghost" icon={<Icon name="back" size={16} />} onClick={() => navigate('/flats')}>
              Back
            </Button>
            <Button variant="secondary" icon={<Icon name="refresh" size={16} />} onClick={() => void reload()}>
              Refresh
            </Button>
            <PermissionGate permission="flats.update">
              <Button
                icon={<Icon name="edit" size={16} />}
                onClick={() => navigate(`/flats/${flat.flatId}/edit`)}
              >
                Edit
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <Tabs
        tabs={[
          { key: 'overview', label: 'Overview', content: overview },
          { key: 'finance', label: 'Finance', content: finance },
          { key: 'members', label: 'Members', content: membersTab },
        ]}
      />
    </div>
  );
}
