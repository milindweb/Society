/* MemberListPage.tsx — FE-05 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { DataTable, type Column } from '@/components/data/DataTable';
import { FilterBar } from '@/components/data/FilterBar';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Member } from '@/types/domain';

export default function MemberListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const columns: Column<Member>[] = [
    { key: 'memberCode', header: 'Code', sortable: true },
    { key: 'fullName', header: 'Name', sortable: true },
    { key: 'flatNumber', header: 'Flat' },
    { key: 'relationType', header: 'Relation' },
    { key: 'mobile', header: 'Mobile' },
    { key: 'statusKey', header: 'Status', render: (r) => <StatusBadge statusKey={r.statusKey} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle="Manage society members"
        actions={<Button icon={<Icon name="plus" size={16} />} onClick={() => navigate('/members/new')}>Add Member</Button>}
      />
      <FilterBar>
        <Input placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: '16rem' }} />
      </FilterBar>
      <DataTable columns={columns} data={[]} loading={false} emptyTitle="No members yet" onRowClick={(r) => navigate(`/members/${r.memberId}`)} getRowId={(r) => r.memberId} />
    </div>
  );
}
