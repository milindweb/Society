/* MeetingListPage.tsx — FE-08
 * design.md §6 list-page pattern: PageHeader → FilterBar → DataTable → Pagination.
 * frontend-architecture.md §1: no fetching in pages — useMeetingList owns it.
 *
 * SRS §8 wants AGM / SGM / committee meetings with date, venue, agenda and a
 * record of attendance and minutes. This list is the entry point to all of that;
 * the detail page carries the minutes, resolutions and attendance sheet.
 *
 * Contract notes (verified against backend/src/CommunicationService.gs):
 * - `meetings.list` filters on meetingTypeId (mapped server-side onto the
 *   `meetingTypeKey` column), statusKey and a free-text search over
 *   title / venue / agenda / meetingNumber. There is NO server-side date-range
 *   filter, so the toolbar offers only what the server can honour — the same
 *   call the visitors list made rather than faking a filter client-side.
 * - The type filter is labelled "Meeting type" but its VALUE is a typeKey, since
 *   that is what `Meetings.meetingTypeKey` stores. See useMeetingLookups. */

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
import { PermissionGate } from '@/app/PermissionGate';
import { DataTable, type Column } from '@/components/data/DataTable';
import { DataListMobile } from '@/components/data/DataListMobile';
import { FilterBar } from '@/components/data/FilterBar';
import { PaginationBar } from '@/components/data/PaginationBar';
import { MeetingCreateModal } from '../components/MeetingCreateModal';
import { useMeetingList } from '../hooks/useMeetings';
import { useMeetingTypeOptions, useMeetingStatusOptions } from '../hooks/useMeetingLookups';
import { useDebounce } from '@/lib/useDebounce';
import { formatDate } from '@/lib/dates';
import { ExportButton } from '@/components/ui/ExportButton';
import type { Meeting } from '@/types/domain';

/** '12' → '12' ; '' / undefined / non-numeric → '—'.
 * quorumPresent and quorumRequired are STRING columns on the sheet. */
function quorumLabel(present?: string, required?: string): string {
  if (!present && !required) return '—';
  return `${present || '0'}${required ? ` / ${required}` : ''}`;
}

export default function MeetingListPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [meetingTypeId, setMeetingTypeId] = useState('');
  const [statusKey, setStatusKey] = useState('');
  const [creating, setCreating] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const types = useMeetingTypeOptions();
  const statuses = useMeetingStatusOptions();

  const { meetings, page, loading, error, setFilters, setPage, reload } = useMeetingList({
    search: debouncedSearch || undefined,
    meetingTypeId: meetingTypeId || undefined,
    statusKey: statusKey || undefined,
  });

  const typeLabel = (value: string) =>
    types.options.find((option) => option.value === value)?.label ?? value ?? '—';

  const columns: Column<Meeting>[] = [
    {
      key: 'title',
      header: 'Meeting',
      render: (row) => (
        <div>
          <div>{row.title}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {row.meetingNumber}
            {` · ${typeLabel(row.meetingTypeName || row.meetingTypeKey)}`}
          </div>
        </div>
      ),
    },
    { key: 'meetingDate', header: 'Date', render: (row) => formatDate(row.meetingDate) },
    {
      key: 'time',
      header: 'Time',
      render: (row) =>
        row.startTime ? `${row.startTime}${row.endTime ? ` – ${row.endTime}` : ''}` : '—',
    },
    { key: 'venue', header: 'Venue', render: (row) => row.venue || '—' },
    {
      key: 'quorumPresent',
      header: 'Quorum',
      align: 'center',
      render: (row) => quorumLabel(row.quorumPresent, row.quorumRequired),
    },
    { key: 'statusKey', header: 'Status', render: (row) => <StatusBadge statusKey={row.statusKey} /> },
  ];

  const renderMobile = (meeting: Meeting) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <strong>{meeting.title}</strong>
        <StatusBadge statusKey={meeting.statusKey} />
      </div>
      <div
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          marginTop: 'var(--space-1)',
        }}
      >
        {meeting.meetingNumber} · {formatDate(meeting.meetingDate)}
        {meeting.startTime ? ` · ${meeting.startTime}` : ''}
        {meeting.meetingTypeName ? ` · ${meeting.meetingTypeName}` : ''}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
        {meeting.venue || 'Venue not set'} · quorum{' '}
        {quorumLabel(meeting.quorumPresent, meeting.quorumRequired)}
      </div>
    </div>
  );

  const body = (() => {
    if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
    if (loading) return <Skeleton height={240} variant="rect" />;
    if (meetings.length === 0) {
      return (
        <EmptyState
          title="No meetings found"
          description={
            search || meetingTypeId || statusKey
              ? 'No meeting matches the current filters.'
              : 'No meetings have been scheduled yet.'
          }
        />
      );
    }
    return (
      <>
        <div className="hs-only-desktop">
          <DataTable
            columns={columns}
            data={meetings}
            getRowId={(row) => row.meetingId}
            onRowClick={(row) => navigate(`/meetings/${row.meetingId}`)}
            emptyTitle="No meetings found"
          />
        </div>
        <div className="hs-only-mobile">
          <DataListMobile
            data={meetings}
            render={renderMobile}
            onRowClick={(row) => navigate(`/meetings/${row.meetingId}`)}
            emptyTitle="No meetings found"
          />
        </div>
        <PaginationBar page={page} onPageChange={setPage} />
      </>
    );
  })();

  return (
    <div>
      <PageHeader
        title="Meetings"
        subtitle="AGM, SGM and committee meetings with agenda, minutes and attendance"
        actions={
          <>
            <ExportButton columns={columns} data={meetings} filename="meetings-list" />
            <PermissionGate permission="meetings.write">
              <Button icon={<Icon name="plus" size={16} />} onClick={() => setCreating(true)}>
                New meeting
              </Button>
            </PermissionGate>
          </>
        }
      />

      <Card>
        <CardBody>
          <FilterBar>
            <Input
              value={search}
              placeholder="Search meetings..."
              aria-label="Search meetings"
              className="hs-input--filter"
              onChange={(e) => {
                setSearch(e.target.value);
                setFilters({ search: e.target.value || undefined });
              }}
            />
            <Select
              aria-label="Filter by meeting type"
              value={meetingTypeId}
              options={[{ value: '', label: 'All types' }, ...types.options]}
              onChange={(e) => {
                setMeetingTypeId(e.target.value);
                setFilters({ meetingTypeId: e.target.value || undefined });
              }}
            />
            <Select
              aria-label="Filter by meeting status"
              value={statusKey}
              options={[{ value: '', label: 'All statuses' }, ...statuses.options]}
              onChange={(e) => {
                setStatusKey(e.target.value);
                setFilters({ statusKey: e.target.value || undefined });
              }}
            />
            <Button variant="ghost" onClick={() => void reload()} disabled={loading}>
              Refresh
            </Button>
          </FilterBar>
          {types.options.length === 0 && !types.loading ? (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <Alert variant="warning">
                No meeting types were returned by the server. Meeting types are configuration data —
                add them in Settings before scheduling a meeting.
              </Alert>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardBody>{body}</CardBody>
      </Card>

      <MeetingCreateModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(meeting) => {
          setCreating(false);
          navigate(`/meetings/${meeting.meetingId}`);
        }}
      />
    </div>
  );
}
