/* VisitorListPage.tsx — FE-07
 * design.md §6 list-page pattern: PageHeader → FilterBar → DataTable → Pagination.
 * SRS §7: admin/committee see visitor history; the Exit action lives here (the
 * same action the watchman uses, since he is the one who watches them leave).
 *
 * Contract notes (verified against backend/src/VisitorService.gs):
 * - `visitors.list` filters on statusKey / flatId / typeKey only, so a date
 *   range that the spec asks for is NOT sent to the server; the toolbar keeps
 *   the filters the server can actually honour rather than faking one.
 * - `visitors.exit` REJECTS a visitor that has already exited, so the Exit
 *   action is rendered only for rows whose status is INSIDE. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { KpiCard } from '@/components/data/KpiCard';
import { PermissionGate } from '@/app/PermissionGate';
import { DataTable, type Column } from '@/components/data/DataTable';
import { DataListMobile } from '@/components/data/DataListMobile';
import { FilterBar } from '@/components/data/FilterBar';
import { PaginationBar } from '@/components/data/PaginationBar';
import { ExitVisitorModal } from '../components/ExitVisitorModal';
import { useVisitorList, useVisitorSummary } from '../hooks/useVisitors';
import { useVisitorTypeOptions, useVisitorStatusOptions } from '../hooks/useVisitorLookups';
import { useDebounce } from '@/lib/useDebounce';
import { formatDateTime } from '@/lib/dates';
import type { Visitor } from '@/types/domain';

export default function VisitorListPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusKey, setStatusKey] = useState('');
  const [typeKey, setTypeKey] = useState('');
  const [exiting, setExiting] = useState<Visitor | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const types = useVisitorTypeOptions();
  const statuses = useVisitorStatusOptions();
  const { summary, reload: reloadSummary } = useVisitorSummary();

  const { visitors, page, loading, error, setFilters, setPage, reload, exitingId, exit } =
    useVisitorList({
      search: debouncedSearch || undefined,
      statusKey: statusKey || undefined,
      typeKey: typeKey || undefined,
    });

  /* Keep the hook's filters in step with the debounced box without re-creating
   * the load callback on every keystroke. */
  const applySearch = (value: string) => {
    setSearch(value);
    setFilters({ search: value || undefined });
  };

  const handleExit = async (input: { exitGate?: string; remarks?: string }) => {
    if (!exiting) return;
    await exit({ visitorId: exiting.visitorId, ...input });
    setExiting(null);
    /* The summary counts INSIDE rows, so it is stale the moment someone exits. */
    await reloadSummary();
  };

  const columns: Column<Visitor>[] = [
    { key: 'passNumber', header: 'Pass' },
    {
      key: 'visitorName',
      header: 'Visitor',
      render: (row) => (
        <div>
          <div>{row.visitorName}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {row.mobile || '—'}
            {row.visitorTypeName ? ` · ${row.visitorTypeName}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'flatNumber',
      header: 'Visiting',
      render: (row) => (
        <div>
          <div>{row.flatNumber ? `Flat ${row.flatNumber}` : row.flatId || '—'}</div>
          {row.residentName ? (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {row.residentName}
            </div>
          ) : null}
        </div>
      ),
    },
    { key: 'purpose', header: 'Purpose', render: (row) => row.purpose || '—' },
    { key: 'entryAt', header: 'Entry', render: (row) => formatDateTime(row.entryAt) },
    {
      key: 'exitAt',
      header: 'Exit',
      render: (row) => (row.exitAt ? formatDateTime(row.exitAt) : '—'),
    },
    { key: 'statusKey', header: 'Status', render: (row) => <StatusBadge statusKey={row.statusKey} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        row.statusKey === 'INSIDE' ? (
          <PermissionGate permission="visitors.write">
            <Button
              size="sm"
              variant="secondary"
              loading={exitingId === row.visitorId}
              onClick={(e) => {
                e.stopPropagation();
                setExiting(row);
              }}
            >
              Exit
            </Button>
          </PermissionGate>
        ) : null,
    },
  ];

  const renderMobile = (visitor: Visitor) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <strong>{visitor.visitorName}</strong>
        <StatusBadge statusKey={visitor.statusKey} />
      </div>
      <div
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          marginTop: 'var(--space-1)',
        }}
      >
        {visitor.passNumber} · {visitor.flatNumber ? `Flat ${visitor.flatNumber}` : visitor.flatId}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
        {visitor.purpose || '—'}
      </div>
      <div
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-muted)',
          marginTop: 'var(--space-1)',
        }}
      >
        In {formatDateTime(visitor.entryAt)}
        {visitor.exitAt ? ` · Out ${formatDateTime(visitor.exitAt)}` : ''}
      </div>
      {visitor.statusKey === 'INSIDE' ? (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <PermissionGate permission="visitors.write">
            <Button
              size="lg"
              variant="secondary"
              className="hs-w-full"
              loading={exitingId === visitor.visitorId}
              onClick={() => setExiting(visitor)}
            >
              Record exit
            </Button>
          </PermissionGate>
        </div>
      ) : null}
    </div>
  );

  const body = (() => {
    if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
    if (loading) return <Skeleton height={240} variant="rect" />;
    if (visitors.length === 0) {
      return (
        <EmptyState
          title="No visitors found"
          description={
            search || statusKey || typeKey
              ? 'No visitor matches the current filters.'
              : 'No visitors have been logged yet.'
          }
        />
      );
    }
    return (
      <>
        <div className="hs-only-desktop">
          <DataTable
            columns={columns}
            data={visitors}
            getRowId={(row) => row.visitorId}
            emptyTitle="No visitors found"
          />
        </div>
        <div className="hs-only-mobile">
          <DataListMobile data={visitors} render={renderMobile} emptyTitle="No visitors found" />
        </div>
        <PaginationBar page={page} onPageChange={setPage} />
      </>
    );
  })();

  return (
    <div>
      <PageHeader
        title="Visitors"
        subtitle="Gate movements and visitor history"
        actions={
          <PermissionGate permission="visitors.write">
            <Button
              icon={<Icon name="plus" size={16} />}
              onClick={() => navigate('/visitors/new')}
            >
              Log visitor
            </Button>
          </PermissionGate>
        }
      />

      <div
        className="hs-grid hs-grid-cols-2 hs-lg-grid-cols-4"
        style={{ gap: 'var(--space-4)' }}
      >
        <KpiCard label="Currently inside" value={String(summary.inside)} />
        <KpiCard label="Entries today" value={String(summary.todayEntries)} />
        <KpiCard label="Exits today" value={String(summary.todayExits)} />
        <KpiCard label="Total records" value={String(summary.total)} />
      </div>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardBody>
          <FilterBar>
            <Input
              value={search}
              placeholder="Search visitors..."
              aria-label="Search visitors"
              className="hs-input--filter"
              onChange={(e) => applySearch(e.target.value)}
            />
            <Select
              aria-label="Filter by status"
              value={statusKey}
              options={[{ value: '', label: 'All statuses' }, ...statuses.options]}
              onChange={(e) => setStatusKey(e.target.value)}
            />
            <Select
              aria-label="Filter by visitor type"
              value={typeKey}
              options={[{ value: '', label: 'All types' }, ...types.options]}
              onChange={(e) => setTypeKey(e.target.value)}
            />
            <Button variant="ghost" onClick={() => void reload()} disabled={loading}>
              Refresh
            </Button>
          </FilterBar>
          {types.options.length === 0 && !types.loading ? (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <Alert variant="warning">
                No visitor types were returned by the server. Visitor types are configuration
                data — add them in Settings before logging visitors.
              </Alert>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardBody>{body}</CardBody>
      </Card>

      <ExitVisitorModal
        visitor={exiting}
        onClose={() => setExiting(null)}
        onConfirm={handleExit}
        saving={exitingId !== null}
      />
    </div>
  );
}
