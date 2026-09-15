/* NoticeListPage.tsx — FE-08
 * design.md §6 list-page pattern: PageHeader → FilterBar → DataTable → Pagination.
 * frontend-architecture.md §1: no fetching in pages — useNoticeList owns it.
 *
 * SRS §6 asks for a "single simple Notice module" covering all society
 * communication, plus publish/unpublish and a notice ARCHIVE. The archive is this
 * list: nothing is deleted, an old notice simply stops being PUBLISHED and remains
 * reachable under the status filter.
 *
 * The published/draft split is a server-side filter, so it is a first-class
 * control here rather than client-side filtering of one page of results. */

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
import { NoticeCreateModal } from '../components/NoticeCreateModal';
import { useNoticeList } from '../hooks/useNotices';
import { useNoticeTypeOptions, useAudienceTypeOptions } from '../hooks/useNoticeLookups';
import { useDebounce } from '@/lib/useDebounce';
import { formatDate } from '@/lib/dates';
import { isTrueFlag } from '@/services/noticeService';
import type { Notice } from '@/types/domain';

/** The published/draft toggle maps onto the server's `isPublished` filter. */
type PublishFilter = '' | 'published' | 'draft';

export default function NoticeListPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [noticeTypeId, setNoticeTypeId] = useState('');
  const [publishFilter, setPublishFilter] = useState<PublishFilter>('');
  const [creating, setCreating] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const types = useNoticeTypeOptions();
  const audiences = useAudienceTypeOptions();

  const { notices, page, loading, error, setFilters, setPage, reload } = useNoticeList({
    search: debouncedSearch || undefined,
    noticeTypeId: noticeTypeId || undefined,
    isPublished: publishFilter === '' ? undefined : publishFilter === 'published',
  });

  const audienceLabel = (value: string) =>
    audiences.options.find((option) => option.value === value)?.label ?? value ?? '—';

  const columns: Column<Notice>[] = [
    {
      key: 'title',
      header: 'Notice',
      render: (row) => (
        <div>
          <div>
            {isTrueFlag(row.isPinned) ? '📌 ' : ''}
            {row.title}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {row.noticeNumber}
            {row.noticeTypeName ? ` · ${row.noticeTypeName}` : ''}
          </div>
        </div>
      ),
    },
    { key: 'noticeDate', header: 'Date', render: (row) => formatDate(row.noticeDate) },
    { key: 'audienceType', header: 'Audience', render: (row) => audienceLabel(row.audienceType) },
    {
      key: 'expiryDate',
      header: 'Expires',
      render: (row) => (row.expiryDate ? formatDate(row.expiryDate) : '—'),
    },
    { key: 'statusKey', header: 'Status', render: (row) => <StatusBadge statusKey={row.statusKey} /> },
  ];

  const renderMobile = (notice: Notice) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <strong>
          {isTrueFlag(notice.isPinned) ? '📌 ' : ''}
          {notice.title}
        </strong>
        <StatusBadge statusKey={notice.statusKey} />
      </div>
      <div
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          marginTop: 'var(--space-1)',
        }}
      >
        {notice.noticeNumber} · {formatDate(notice.noticeDate)}
        {notice.noticeTypeName ? ` · ${notice.noticeTypeName}` : ''}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
        {audienceLabel(notice.audienceType)}
        {notice.expiryDate ? ` · expires ${formatDate(notice.expiryDate)}` : ''}
      </div>
    </div>
  );

  const body = (() => {
    if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
    if (loading) return <Skeleton height={240} variant="rect" />;
    if (notices.length === 0) {
      return (
        <EmptyState
          title="No notices found"
          description={
            search || noticeTypeId || publishFilter
              ? 'No notice matches the current filters.'
              : 'No notices have been created yet.'
          }
        />
      );
    }
    return (
      <>
        <div className="hs-only-desktop">
          <DataTable
            columns={columns}
            data={notices}
            getRowId={(row) => row.noticeId}
            onRowClick={(row) => navigate(`/notices/${row.noticeId}`)}
            emptyTitle="No notices found"
          />
        </div>
        <div className="hs-only-mobile">
          <DataListMobile
            data={notices}
            render={renderMobile}
            onRowClick={(row) => navigate(`/notices/${row.noticeId}`)}
            emptyTitle="No notices found"
          />
        </div>
        <PaginationBar page={page} onPageChange={setPage} />
      </>
    );
  })();

  return (
    <div>
      <PageHeader
        title="Notices"
        subtitle="Society notices, circulars and announcements"
        actions={
          <PermissionGate permission="notices.write">
            <Button icon={<Icon name="plus" size={16} />} onClick={() => setCreating(true)}>
              New notice
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <CardBody>
          <FilterBar>
            <Input
              value={search}
              placeholder="Search notices..."
              aria-label="Search notices"
              className="hs-input--filter"
              onChange={(e) => {
                setSearch(e.target.value);
                setFilters({ search: e.target.value || undefined });
              }}
            />
            <Select
              aria-label="Filter by notice type"
              value={noticeTypeId}
              options={[{ value: '', label: 'All types' }, ...types.options]}
              onChange={(e) => {
                setNoticeTypeId(e.target.value);
                setFilters({ noticeTypeId: e.target.value || undefined });
              }}
            />
            <Select
              aria-label="Filter by publication state"
              value={publishFilter}
              options={[
                { value: '', label: 'All notices' },
                { value: 'published', label: 'Published' },
                { value: 'draft', label: 'Drafts' },
              ]}
              onChange={(e) => {
                const value = e.target.value as PublishFilter;
                setPublishFilter(value);
                setFilters({ isPublished: value === '' ? undefined : value === 'published' });
              }}
            />
            <Button variant="ghost" onClick={() => void reload()} disabled={loading}>
              Refresh
            </Button>
          </FilterBar>
          {types.options.length === 0 && !types.loading ? (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <Alert variant="warning">
                No notice types were returned by the server. Notice types are configuration data —
                add them in Settings before creating notices.
              </Alert>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardBody>{body}</CardBody>
      </Card>

      <NoticeCreateModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(notice) => {
          setCreating(false);
          navigate(`/notices/${notice.noticeId}`);
        }}
      />
    </div>
  );
}
