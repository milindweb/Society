/* ArchivedRecordsPage.tsx — FE-14: Browse archived records */

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/data/DataTable';
import { PaginationBar } from '@/components/data/PaginationBar';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { useArchiveList } from '../hooks/useArchive';
import type { ArchiveEntry } from '@/types/domain';

const ENTITY_OPTIONS = [
  { value: '', label: 'All entities' },
  { value: 'Demands', label: 'Demands' },
  { value: 'Payments', label: 'Payments' },
  { value: 'Complaints', label: 'Complaints' },
  { value: 'Visitors', label: 'Visitors' },
  { value: 'Expenses', label: 'Expenses' },
  { value: 'Attendance', label: 'Attendance' },
];

const columns: Column<ArchiveEntry>[] = [
  { key: 'archiveId', header: 'Archive ID', render: (row) => row.archiveId },
  { key: 'originalEntity', header: 'Entity' },
  { key: 'originalId', header: 'Original ID' },
  { key: 'archivedAt', header: 'Archived', render: (row) => new Date(row.archivedAt).toLocaleString() },
  { key: 'reason', header: 'Reason', render: (row) => row.reason ?? '—' },
];

export default function ArchivedRecordsPage() {
  const { archives, page, loading, error, fetchArchives } = useArchiveList();
  const [entity, setEntity] = useState('');

  useEffect(() => {
    fetchArchives(1, 25, entity || undefined);
  }, [fetchArchives, entity]);

  return (
    <div>
      <PageHeader title="Archived Records" subtitle="Browse records moved to archive" />

      <Card>
        <CardBody>
          <div style={{ marginBottom: 'var(--space-4)', maxWidth: 250 }}>
            <FormField label="Filter by entity">
              <Select
                options={ENTITY_OPTIONS}
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
              />
            </FormField>
          </div>

          {error && <div className="hs-alert hs-alert--danger" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}

          <DataTable
            columns={columns}
            data={archives}
            loading={loading}
            emptyTitle="No archived records"
            emptyDescription="No records have been archived yet."
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
