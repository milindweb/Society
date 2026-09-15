/* MemberDetailPage.tsx — FE-05
 * design.md §36: detail page. Family members and vehicles are part of the Member payload. */

import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { DataTable, type Column } from '@/components/data/DataTable';
import { PermissionGate } from '@/app/PermissionGate';
import { useMember } from '../hooks/useMembers';
import { formatEnumKey } from '@/lib/format';
import type { FamilyMember, Vehicle } from '@/types/domain';

export default function MemberDetailPage() {
  const navigate = useNavigate();
  const { memberId } = useParams<{ memberId: string }>();
  const { member, loading, error, reload } = useMember(memberId);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div>
        <PageHeader title="Member Details" />
        <ErrorState
          title="Member not found"
          message={error ?? 'This member may have been removed.'}
          onRetry={() => void reload()}
        />
      </div>
    );
  }

  const familyColumns: Column<FamilyMember>[] = [
    { key: 'name', header: 'Name' },
    { key: 'relation', header: 'Relation' },
    { key: 'mobile', header: 'Mobile', render: (r) => r.mobile || '—' },
    { key: 'email', header: 'Email', render: (r) => r.email || '—' },
  ];

  /* `members.get` returns raw `Vehicles` rows: { memberId, flatId,
   * vehicleTypeKey, vehicleNumber, makeModel, colour, statusKey }. There is no
   * `registrationNumber` and no `parkingSlotId` — parking is linked the other way
   * round, through `Parking_Allocations.vehicleId` (see the Parking module). */
  const vehicleColumns: Column<Vehicle>[] = [
    { key: 'vehicleNumber', header: 'Number' },
    { key: 'makeModel', header: 'Make / model', render: (r) => r.makeModel || '—' },
    { key: 'colour', header: 'Colour', render: (r) => r.colour || '—' },
    { key: 'vehicleTypeKey', header: 'Type', render: (r) => r.vehicleTypeKey || '—' },
    { key: 'statusKey', header: 'Status', render: (r) => <StatusBadge statusKey={r.statusKey} /> },
  ];

  const overview = (
    <div className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2" style={{ gap: 'var(--space-4)' }}>
      <Card>
        <CardHeader title="Member Information" />
        <CardBody>
          <DescriptionList
            items={[
              { label: 'Member Code', value: member.memberCode },
              {
                label: 'Full Name',
                value: (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    {member.fullName}
                    {member.isPrimary && <Badge variant="info">Primary</Badge>}
                  </span>
                ),
              },
              { label: 'Relation', value: formatEnumKey(member.relationType) },
              {
                label: 'Flat',
                value: (
                  <Button variant="link" onClick={() => navigate(`/flats/${member.flatId}`)}>
                    {member.flatNumber || member.flatId}
                  </Button>
                ),
              },
              { label: 'Status', value: <StatusBadge statusKey={member.statusKey} /> },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Contact" />
        <CardBody>
          <DescriptionList
            items={[
              { label: 'Mobile', value: member.mobile || '—' },
              { label: 'Email', value: member.email || '—' },
              { label: 'Emergency Contact', value: member.emergencyContact || '—' },
              { label: 'Address', value: member.address || '—', span: 2 },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );

  const familyTab = (
    <DataTable
      columns={familyColumns}
      data={member.familyMembers ?? []}
      getRowId={(r) => r.familyMemberId}
      emptyTitle="No family members"
      emptyDescription="No family members are recorded against this member."
    />
  );

  const vehiclesTab = (
    <DataTable
      columns={vehicleColumns}
      data={member.vehicles ?? []}
      getRowId={(r) => r.vehicleId}
      emptyTitle="No vehicles"
      emptyDescription="No vehicles are registered to this member."
    />
  );

  return (
    <div>
      <PageHeader
        title={member.fullName}
        subtitle={
          member.flatNumber
            ? `${member.memberCode} · Flat ${member.flatNumber}`
            : member.memberCode
        }
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Members', route: '/members', onClick: () => navigate('/members') },
              { label: member.fullName },
            ]}
          />
        }
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="ghost"
              icon={<Icon name="back" size={16} />}
              onClick={() => navigate('/members')}
            >
              Back
            </Button>
            <Button
              variant="secondary"
              icon={<Icon name="refresh" size={16} />}
              onClick={() => void reload()}
            >
              Refresh
            </Button>
            <PermissionGate permission="members.update">
              <Button
                icon={<Icon name="edit" size={16} />}
                onClick={() => navigate(`/members/${member.memberId}/edit`)}
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
          {
            key: 'family',
            label: `Family (${member.familyMembers?.length ?? 0})`,
            content: familyTab,
          },
          {
            key: 'vehicles',
            label: `Vehicles (${member.vehicles?.length ?? 0})`,
            content: vehiclesTab,
          },
        ]}
      />
    </div>
  );
}
