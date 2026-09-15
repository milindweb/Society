/* ComplaintListPage.tsx — FE-07
 * SRS §5: complaint register with category, priority, status and date.
 * SRS §15: categories and priorities come from config, never literals.
 *
 * The Raise action is a modal rather than a page — SRS §5 asks for this module
 * to be "simple but complete", and raising a complaint is four fields. */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PermissionGate } from '@/app/PermissionGate';
import { DataTable, type Column } from '@/components/data/DataTable';
import { DataListMobile } from '@/components/data/DataListMobile';
import { FilterBar } from '@/components/data/FilterBar';
import { PaginationBar } from '@/components/data/PaginationBar';
import { RaiseComplaintModal } from '../components/RaiseComplaintModal';
import { useComplaintList } from '../hooks/useComplaints';
import {
  useComplaintCategoryOptions,
  useComplaintPriorityOptions,
  useComplaintStatusOptions,
} from '../hooks/useComplaintLookups';
import { useDebounce } from '@/lib/useDebounce';
import { formatDate } from '@/lib/dates';
import { ExportButton } from '@/components/ui/ExportButton';
import type { Complaint } from '@/types/domain';

export default function ComplaintListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [statusKey, setStatusKey] = useState(searchParams.get('statusKey') ?? '');
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') ?? '');
  const [priorityKey, setPriorityKey] = useState(searchParams.get('priorityKey') ?? '');
  const [raising, setRaising] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const categories = useComplaintCategoryOptions();
  const priorities = useComplaintPriorityOptions();
  const statuses = useComplaintStatusOptions();

  const { complaints, page, loading, error, setPage, reload } = useComplaintList({
    search: debouncedSearch || undefined,
    statusKey: statusKey || undefined,
    categoryId: categoryId || undefined,
    priorityKey: priorityKey || undefined,
  });

  /* Keep the address bar in step so a filtered view can be shared or reloaded. */
  const syncParams = (next: Record<string, string>) => {
    const merged: Record<string, string> = {
      search,
      statusKey,
      categoryId,
      priorityKey,
      ...next,
    };
    setSearchParams(
      Object.fromEntries(Object.entries(merged).filter(([, value]) => value)),
      { replace: true },
    );
  };

  const categoryName = (complaint: Complaint) =>
    complaint.categoryName ||
    categories.options.find((option) => option.value === complaint.categoryId)?.label ||
    '—';

  const columns: Column<Complaint>[] = [
    { key: 'complaintNumber', header: 'No' },
    {
      key: 'title',
      header: 'Complaint',
      render: (row) => (
        <div>
          <div>{row.title}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {categoryName(row)}
          </div>
        </div>
      ),
    },
    { key: 'flatNumber', header: 'Flat', render: (row) => row.flatNumber ?? '—' },
    { key: 'priorityKey', header: 'Priority', render: (row) => <StatusBadge statusKey={row.priorityKey} /> },
    { key: 'statusKey', header: 'Status', render: (row) => <StatusBadge statusKey={row.statusKey} /> },
    { key: 'raisedAt', header: 'Raised', render: (row) => formatDate(row.raisedAt) },
  ];

  const renderMobile = (complaint: Complaint) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <strong>{complaint.title}</strong>
        <StatusBadge statusKey={complaint.statusKey} />
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
        {complaint.complaintNumber} · {categoryName(complaint)}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 'var(--space-2)' }}>
        <StatusBadge statusKey={complaint.priorityKey} />
        <span style={{ fontSize: 'var(--text-sm)' }}>{formatDate(complaint.raisedAt)}</span>
      </div>
    </div>
  );

  const body = (() => {
    if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
    if (loading) return <Skeleton height={240} variant="rect" />;
    if (complaints.length === 0) {
      return (
        <EmptyState
          title="No complaints found"
          description={
            search || statusKey || categoryId || priorityKey
              ? 'No complaint matches the current filters.'
              : 'No complaints have been raised yet.'
          }
        />
      );
    }
    return (
      <>
        <div className="hs-only-desktop">
          <DataTable
            columns={columns}
            data={complaints}
            getRowId={(row) => row.complaintId}
            onRowClick={(row) => navigate(`/complaints/${row.complaintId}`)}
            emptyTitle="No complaints found"
          />
        </div>
        <div className="hs-only-mobile">
          <DataListMobile
            data={complaints}
            render={renderMobile}
            onRowClick={(row) => navigate(`/complaints/${row.complaintId}`)}
            emptyTitle="No complaints found"
          />
        </div>
        <PaginationBar page={page} onPageChange={setPage} />
      </>
    );
  })();

  return (
    <div>
      <PageHeader
        title="Complaints"
        subtitle="Raise → Assign → Corrective action → Resolve → Close"
        actions={
          <>
            <ExportButton columns={columns} data={complaints} filename="complaints-list" />
            <PermissionGate permission="complaints.write">
              <Button onClick={() => setRaising(true)}>Raise complaint</Button>
            </PermissionGate>
          </>
        }
      />

      <Card>
        <CardBody>
          <FilterBar>
            <Input
              value={search}
              placeholder="Search complaints..."
              aria-label="Search complaints"
              className="hs-input--filter"
              onChange={(e) => {
                setSearch(e.target.value);
                syncParams({ search: e.target.value });
              }}
            />
            <Select
              aria-label="Filter by status"
              value={statusKey}
              options={[{ value: '', label: 'All statuses' }, ...statuses.options]}
              onChange={(e) => {
                setStatusKey(e.target.value);
                syncParams({ statusKey: e.target.value });
              }}
            />
            <Select
              aria-label="Filter by category"
              value={categoryId}
              options={[{ value: '', label: 'All categories' }, ...categories.options]}
              onChange={(e) => {
                setCategoryId(e.target.value);
                syncParams({ categoryId: e.target.value });
              }}
            />
            <Select
              aria-label="Filter by priority"
              value={priorityKey}
              options={[{ value: '', label: 'All priorities' }, ...priorities.options]}
              onChange={(e) => {
                setPriorityKey(e.target.value);
                syncParams({ priorityKey: e.target.value });
              }}
            />
            <Button variant="ghost" onClick={() => void reload()} disabled={loading}>
              Refresh
            </Button>
          </FilterBar>
          {categories.options.length === 0 && !categories.loading ? (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <Alert variant="warning">
                No complaint categories were returned by the server. Categories are configuration
                data — add them in Settings before raising complaints.
              </Alert>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardBody>{body}</CardBody>
      </Card>

      <RaiseComplaintModal
        open={raising}
        onClose={() => setRaising(false)}
        onCreated={(complaint) => navigate(`/complaints/${complaint.complaintId}`)}
      />
    </div>
  );
}
