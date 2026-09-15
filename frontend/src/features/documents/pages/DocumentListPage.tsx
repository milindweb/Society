/* DocumentListPage.tsx — FE-09
 * design.md §6 list-page pattern: PageHeader → FilterBar → DataTable → Pagination.
 * frontend-architecture.md §1: no fetching in pages — useDocumentList owns it.
 *
 * SRS §9: "One central Documents module should cover all society documents", with
 * category, title, date, description, related module, search, view, download and
 * archive. This list is the entry point to all of it.
 *
 * Contract notes (verified against backend/src/DocumentService.gs):
 * - `documents.list` filters on categoryId, linkedEntityType, linkedEntityId and
 *   statusKey, and drops ARCHIVED rows unless `includeArchived` is set. There is NO
 *   server-side search box — the search field below is therefore applied to the
 *   CURRENT page only, and says so, rather than pretending to be global.
 * - `fileRef` is a JSON string, so the file column parses it via `parseFileRef`.
 * - A document with no `fileRef` is metadata-only: created via `documents.create`
 *   or awaiting its first upload. That state is shown explicitly rather than as a
 *   broken download link. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PermissionGate } from '@/app/PermissionGate';
import { DataTable, type Column } from '@/components/data/DataTable';
import { DataListMobile } from '@/components/data/DataListMobile';
import { FilterBar } from '@/components/data/FilterBar';
import { PaginationBar } from '@/components/data/PaginationBar';
import { DocumentUploadModal } from '../components/DocumentUploadModal';
import { useDocumentList } from '../hooks/useDocuments';
import {
  useDocumentCategoryOptions,
  useLinkedEntityTypeOptions,
} from '../hooks/useDocumentLookups';
import { parseFileRef } from '@/services/documentService';
import { useDebounce } from '@/lib/useDebounce';
import { formatDate } from '@/lib/dates';
import type { Document } from '@/types/domain';

export default function DocumentListPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [linkedEntityType, setLinkedEntityType] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [uploading, setUploading] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const categories = useDocumentCategoryOptions();
  const entities = useLinkedEntityTypeOptions();

  const { documents, page, loading, error, setFilters, setPage, reload } = useDocumentList({
    categoryId: categoryId || undefined,
    linkedEntityType: linkedEntityType || undefined,
    includeArchived,
  });

  const categoryLabel = (row: Document) =>
    row.categoryName ||
    categories.options.find((option) => option.value === row.categoryId)?.label ||
    row.categoryId ||
    '—';

  /* `documents.list` has no server-side search, so the box narrows the page that
   * is already in hand. Being explicit about that beats a field that silently
   * does nothing. */
  const visible = debouncedSearch
    ? documents.filter((row) => {
        const needle = debouncedSearch.toLowerCase();
        return (
          row.title?.toLowerCase().includes(needle) ||
          row.documentNumber?.toLowerCase().includes(needle) ||
          row.description?.toLowerCase().includes(needle) ||
          row.tags?.toLowerCase().includes(needle)
        );
      })
    : documents;

  const columns: Column<Document>[] = [
    {
      key: 'title',
      header: 'Document',
      render: (row) => (
        <div>
          <div>{row.title}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {row.documentNumber}
            {` · ${categoryLabel(row)}`}
          </div>
        </div>
      ),
    },
    {
      key: 'linkedEntityType',
      header: 'Related module',
      render: (row) =>
        row.linkedEntityType ? (
          <span>
            {row.linkedEntityType}
            {row.linkedEntityId ? (
              <span style={{ color: 'var(--color-text-muted)' }}> · {row.linkedEntityId}</span>
            ) : null}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'effectiveDate',
      header: 'Date',
      render: (row) => (row.effectiveDate ? formatDate(row.effectiveDate) : '—'),
    },
    {
      key: 'fileRef',
      header: 'File',
      render: (row) => {
        const file = parseFileRef(row.fileRef);
        if (!file) {
          return <span style={{ color: 'var(--color-text-muted)' }}>No file</span>;
        }
        return (
          <span title={file.name}>
            {file.name}
            <span style={{ color: 'var(--color-text-muted)' }}> · v{row.versionNo}</span>
          </span>
        );
      },
    },
    {
      key: 'statusKey',
      header: 'Status',
      render: (row) => <StatusBadge statusKey={row.statusKey} />,
    },
  ];

  const renderMobile = (row: Document) => {
    const file = parseFileRef(row.fileRef);
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <strong>{row.title}</strong>
          <StatusBadge statusKey={row.statusKey} />
        </div>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-muted)',
            marginTop: 'var(--space-1)',
          }}
        >
          {row.documentNumber} · {categoryLabel(row)} ·{' '}
          {row.effectiveDate ? formatDate(row.effectiveDate) : 'No date'}
        </div>
        <div style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
          {file ? `${file.name} (v${row.versionNo})` : 'No file uploaded yet'}
        </div>
      </div>
    );
  };

  const body = (() => {
    if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
    if (loading) return <Skeleton height={240} variant="rect" />;
    if (documents.length === 0) {
      return (
        <EmptyState
          title="No documents found"
          description={
            categoryId || linkedEntityType || includeArchived
              ? 'No document matches the current filters.'
              : 'No documents have been uploaded yet.'
          }
        />
      );
    }
    if (visible.length === 0) {
      return (
        <EmptyState
          title="No matches on this page"
          description={`Nothing on page ${page.page} matches "${debouncedSearch}". Searching covers the loaded page only — clear the box or change pages.`}
        />
      );
    }
    return (
      <>
        <div className="hs-only-desktop">
          <DataTable
            columns={columns}
            data={visible}
            getRowId={(row) => row.documentId}
            onRowClick={(row) => navigate(`/documents/${row.documentId}`)}
            emptyTitle="No documents found"
          />
        </div>
        <div className="hs-only-mobile">
          <DataListMobile
            data={visible}
            render={renderMobile}
            onRowClick={(row) => navigate(`/documents/${row.documentId}`)}
            emptyTitle="No documents found"
          />
        </div>
        <PaginationBar page={page} onPageChange={setPage} />
      </>
    );
  })();

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="One central repository for every society document"
        actions={
          <PermissionGate permission="documents.write">
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button
                variant="secondary"
                onClick={() => navigate('/documents/new')}
                icon={<Icon name="edit" size={16} />}
              >
                Add metadata
              </Button>
              <Button
                icon={<Icon name="upload" size={16} />}
                onClick={() => setUploading(true)}
              >
                Upload
              </Button>
            </div>
          </PermissionGate>
        }
      />

      <Card>
        <CardBody>
          <FilterBar>
            <Input
              value={search}
              placeholder="Search this page..."
              aria-label="Search documents on this page"
              className="hs-input--filter"
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              aria-label="Filter by category"
              value={categoryId}
              options={[{ value: '', label: 'All categories' }, ...categories.options]}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setFilters({ categoryId: e.target.value || undefined });
              }}
            />
            <Select
              aria-label="Filter by related module"
              value={linkedEntityType}
              options={[{ value: '', label: 'All modules' }, ...entities.options]}
              onChange={(e) => {
                setLinkedEntityType(e.target.value);
                setFilters({ linkedEntityType: e.target.value || undefined });
              }}
            />
            <Select
              aria-label="Filter by archive state"
              value={includeArchived ? 'all' : 'active'}
              options={[
                { value: 'active', label: 'Active only' },
                { value: 'all', label: 'Include archived' },
              ]}
              onChange={(e) => {
                const all = e.target.value === 'all';
                setIncludeArchived(all);
                setFilters({ includeArchived: all });
              }}
            />
            <Button variant="ghost" onClick={() => void reload()} disabled={loading}>
              Refresh
            </Button>
          </FilterBar>
          <p
            style={{
              marginTop: 'var(--space-3)',
              marginBottom: 0,
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
            }}
          >
            Archived documents are hidden unless you choose to include them. The server filters by
            category and related module; the search box narrows the page already loaded.
          </p>
        </CardBody>
      </Card>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardBody>{body}</CardBody>
      </Card>

      <DocumentUploadModal
        open={uploading}
        onClose={() => setUploading(false)}
        onUploaded={(doc) => {
          setUploading(false);
          navigate(`/documents/${doc.documentId}`);
        }}
      />
    </div>
  );
}
