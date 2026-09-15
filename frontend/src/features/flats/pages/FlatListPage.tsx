/* FlatListPage.tsx — FE-05
 * design.md §6 list-page pattern: PageHeader → FilterBar → DataTable → Pagination.
 * frontend-architecture.md §1: no fetching in pages — useFlatList owns it.
 * SRS §15: no hardcoded wings/statuses — options come from useLookups. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ErrorState } from '@/components/ui/ErrorState';
import { DataTable, type Column } from '@/components/data/DataTable';
import { FilterBar } from '@/components/data/FilterBar';
import { LookupSelect } from '@/components/data/LookupSelect';
import { AmountText } from '@/components/data/AmountText';
import { Pagination } from '@/components/ui/Pagination';
import { PermissionGate } from '@/app/PermissionGate';
import { useFlatList } from '../hooks/useFlats';
import { useWingOptions, useStatusOptions } from '../hooks/useLookups';
import { useDebounce } from '@/lib/useDebounce';
import type { Flat } from '@/types/domain';

export default function FlatListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { options: wingOptions, loading: wingsLoading } = useWingOptions();
  const { options: statusOptions, loading: statusesLoading } = useStatusOptions('FLAT');

  const { flats, page, loading, error, filters, setFilters, setPage, reload } = useFlatList({
    search: debouncedSearch || undefined,
  });

  // Keep the hook's filter in sync with the debounced search box.
  const effectiveSearch = search ? debouncedSearch : '';
  if (effectiveSearch !== (filters.search ?? '')) {
    setFilters({ search: effectiveSearch || undefined });
  }

  const columns: Column<Flat>[] = [
    { key: 'flatNumber', header: 'Flat No', sortable: true },
    { key: 'wingName', header: 'Wing', sortable: true },
    { key: 'floor', header: 'Floor', sortable: true, align: 'right' },
    { key: 'flatTypeName', header: 'Type' },
    { key: 'ownerName', header: 'Owner', render: (r) => r.ownerName || '—' },
    { key: 'tenantName', header: 'Tenant', render: (r) => r.tenantName || '—' },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      render: (r) =>
        r.balanceSummary ? <AmountText amount={r.balanceSummary.totalOutstanding} /> : '—',
    },
    { key: 'statusKey', header: 'Status', render: (r) => <StatusBadge statusKey={r.statusKey} /> },
  ];

  if (error) {
    return (
      <div>
        <PageHeader title="Flats" subtitle="Manage flat/unit master data" />
        <ErrorState message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Flats"
        subtitle="Manage flat/unit master data"
        actions={
          <PermissionGate permission="flats.create">
            <Button icon={<Icon name="plus" size={16} />} onClick={() => navigate('/flats/new')}>
              Add Flat
            </Button>
          </PermissionGate>
        }
      />

      <FilterBar>
        <Input
          placeholder="Search by flat number or owner..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '18rem' }}
          aria-label="Search flats"
        />
        <LookupSelect
          options={wingOptions}
          value={filters.wingId ?? ''}
          onChange={(wingId) => setFilters({ wingId: wingId || undefined })}
          placeholder="All Wings"
          loading={wingsLoading}
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
        data={flats}
        loading={loading}
        onRowClick={(r) => navigate(`/flats/${r.flatId}`)}
        getRowId={(r) => r.flatId}
        emptyTitle="No flats found"
        emptyDescription="Adjust your filters, or add the first flat to get started."
        emptyAction={
          <PermissionGate permission="flats.create">
            <Button
              icon={<Icon name="plus" size={16} />}
              onClick={() => navigate('/flats/new')}
            >
              Add Flat
            </Button>
          </PermissionGate>
        }
      />

      {!loading && flats.length > 0 && <Pagination page={page} onPageChange={setPage} />}
    </div>
  );
}
