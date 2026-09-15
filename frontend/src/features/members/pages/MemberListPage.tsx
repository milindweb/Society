/* MemberListPage.tsx — FE-05
 * design.md §6 list-page pattern. frontend-architecture.md §1: no fetching in pages.
 * SRS §15: relation types come from config.enums (RELATION_TYPE), never a literal list. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/data/DataTable';
import { FilterBar } from '@/components/data/FilterBar';
import { LookupSelect } from '@/components/data/LookupSelect';
import { Pagination } from '@/components/ui/Pagination';
import { PermissionGate } from '@/app/PermissionGate';
import { useMemberList } from '../hooks/useMembers';
import { useEnumOptions, useStatusOptions } from '@/features/flats/hooks/useLookups';
import { useDebounce } from '@/lib/useDebounce';
import { formatEnumKey } from '@/lib/format';
import { ExportButton } from '@/components/ui/ExportButton';
import type { Member } from '@/types/domain';

export default function MemberListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { options: relationOptions, loading: relationsLoading } = useEnumOptions('RELATION_TYPE');
  const { options: statusOptions, loading: statusesLoading } = useStatusOptions('MEMBER');

  const { members, page, loading, error, filters, setFilters, setPage, reload } = useMemberList({
    search: debouncedSearch || undefined,
  });

  const effectiveSearch = search ? debouncedSearch : '';
  if (effectiveSearch !== (filters.search ?? '')) {
    setFilters({ search: effectiveSearch || undefined });
  }

  const columns: Column<Member>[] = [
    { key: 'memberCode', header: 'Code', sortable: true },
    {
      key: 'fullName',
      header: 'Name',
      sortable: true,
      render: (r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {r.fullName}
          {r.isPrimary && <Badge variant="info">Primary</Badge>}
        </span>
      ),
    },
    { key: 'flatNumber', header: 'Flat', render: (r) => r.flatNumber || '—' },
    {
      key: 'relationType',
      header: 'Relation',
      render: (r) => formatEnumKey(r.relationType),
    },
    { key: 'mobile', header: 'Mobile' },
    { key: 'email', header: 'Email', render: (r) => r.email || '—' },
    { key: 'statusKey', header: 'Status', render: (r) => <StatusBadge statusKey={r.statusKey} /> },
  ];

  if (error) {
    return (
      <div>
        <PageHeader title="Members" subtitle="Manage society members" />
        <ErrorState message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle="Manage society members"
        actions={
          <>
            <ExportButton columns={columns} data={members} filename="members-list" />
            <PermissionGate permission="members.create">
              <Button icon={<Icon name="plus" size={16} />} onClick={() => navigate('/members/new')}>
                Add Member
              </Button>
            </PermissionGate>
          </>
        }
      />

      <FilterBar>
        <Input
          placeholder="Search by name, code or mobile..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '18rem' }}
          aria-label="Search members"
        />
        <LookupSelect
          options={relationOptions}
          value={filters.relationType ?? ''}
          onChange={(relationType) => setFilters({ relationType: relationType || undefined })}
          placeholder="All Relations"
          loading={relationsLoading}
          className="hs-input--filter"
        />
        <LookupSelect
          options={statusOptions}
          value={filters.statusKey ?? ''}
          onChange={(statusKey) => setFilters({ statusKey: statusKey || undefined })}
          placeholder="All Statuses"
          loading={statusesLoading}
          className="hs-input--filter"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={members}
        loading={loading}
        onRowClick={(r) => navigate(`/members/${r.memberId}`)}
        getRowId={(r) => r.memberId}
        emptyTitle="No members found"
        emptyDescription="Adjust your filters, or add the first member to get started."
        emptyAction={
          <PermissionGate permission="members.create">
            <Button
              icon={<Icon name="plus" size={16} />}
              onClick={() => navigate('/members/new')}
            >
              Add Member
            </Button>
          </PermissionGate>
        }
      />


      {!loading && members.length > 0 && <Pagination page={page} onPageChange={setPage} />}
    </div>
  );
}
