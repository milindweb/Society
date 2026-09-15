/* ArchivedRecordsPage.tsx — FE-14: Browse archived records */

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/data/DataTable';
import { PaginationBar } from '@/components/data/PaginationBar';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { useArchiveList, useArchivableEntities } from '../hooks/useArchive';
import { formatDateTime } from '@/lib/dates';
import type { ArchiveEntry } from '@/types/domain';

/** Columns mirror the real `Archive_Index` sheet (`Schema.gs:290`):
 *  `archiveIndexId`, `entity` (source sheet), `archiveSheet`, `originalId`,
 *  `archivedAt`, `archivedBy`, `reason`. */
const mono = { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' } as const;

const columns: Column<ArchiveEntry>[] = [
  { key: 'archiveIndexId', header: 'Index ID', render: (row) => <span style={mono}>{row.archiveIndexId}</span> },
  { key: 'entity', header: 'Source sheet' },
  {
    key: 'archiveSheet',
    header: 'Archive sheet',
    render: (row) => <span style={mono}>{row.archiveSheet || '—'}</span>,
  },
  { key: 'originalId', header: 'Original ID', render: (row) => <span style={mono}>{row.originalId || '—'}</span> },
  {
    key: 'archivedAt',
    header: 'Archived',
    render: (row) => (row.archivedAt ? formatDateTime(row.archivedAt) : '—'),
  },
  { key: 'archivedBy', header: 'By', render: (row) => row.archivedBy || '—' },
  { key: 'reason', header: 'Reason', render: (row) => row.reason || '—' },
];

export default function ArchivedRecordsPage() {
  const { archives, page, loading, error, fetchArchives } = useArchiveList();
  const { options: entityOptions } = useArchivableEntities();
  const [entity, setEntity] = useState('');

  useEffect(() => {
    fetchArchives(1, 25, entity || undefined);
  }, [fetchArchives, entity]);

  const selectOptions = [{ value: '', label: 'All sheets' }, ...entityOptions];

  return (
    <div>
      <PageHeader title="Archived Records" subtitle="Records copied into archive sheets" />

      <Card>
        <CardBody>
          <div style={{ marginBottom: 'var(--space-4)', maxWidth: 280 }}>
            <FormField label="Filter by source sheet">
              <Select
                aria-label="Filter by source sheet"
                options={selectOptions}
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
              />
            </FormField>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}

          <DataTable
            columns={columns}
            data={archives}
            loading={loading}
            emptyTitle="No archived records"
            emptyDescription="No records have been archived yet."
            getRowId={(row) => row.archiveIndexId}
          />

          {page.totalPages > 1 && (
            <PaginationBar
              page={page}
              onPageChange={(p) => fetchArchives(p, 25, entity || undefined)}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
