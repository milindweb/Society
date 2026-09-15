/* BackupListPage.tsx — FE-14: Backup list view */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/data/DataTable';
import { PaginationBar } from '@/components/data/PaginationBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Icon } from '@/components/ui/Icon';
import { useBackupList } from '../hooks/useBackup';
import { formatDateTime } from '@/lib/dates';
import { formatEnumKey, formatFileSize, truncate } from '@/lib/format';
import type { Backup } from '@/types/domain';

/** `sheetRowCountsJson` is a JSON string of `{ sheetName: rowCount }` and is the
 *  ONLY place the per-sheet totals live — the `Backups` sheet has no `rowCount`
 *  column (`Schema.gs:282`). The previous version rendered `row.rowCount`, which
 *  is always undefined, so the column was silently blank. */
function summariseContents(raw: string): string {
  if (!raw) return '—';
  try {
    const counts = JSON.parse(raw) as Record<string, unknown>;
    const sheets = Object.keys(counts);
    if (sheets.length === 0) return '—';
    const total = sheets.reduce((sum, name) => sum + (Number(counts[name]) || 0), 0);
    return `${total.toLocaleString()} rows · ${sheets.length} sheets`;
  } catch {
    return '—';
  }
}

const mono = { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' } as const;

const columns: Column<Backup>[] = [
  { key: 'backupId', header: 'ID', render: (row) => <span style={mono}>{row.backupId}</span> },
  /* `scope` is a SchemaMeta enum (BACKUP_SCOPE), not a status domain, so it gets
   * a plain badge rather than a StatusBadge. */
  { key: 'scope', header: 'Scope', render: (row) => <Badge variant="brand">{formatEnumKey(row.scope)}</Badge> },
  {
    key: 'createdAt',
    header: 'Created',
    render: (row) => (row.createdAt ? formatDateTime(row.createdAt) : '—'),
  },
  { key: 'createdBy', header: 'By', render: (row) => row.createdBy || '—' },
  { key: 'contents', header: 'Contents', render: (row) => summariseContents(row.sheetRowCountsJson) },
  {
    key: 'sizeBytes',
    header: 'Size',
    align: 'right',
    render: (row) => formatFileSize(Number(row.sizeBytes) || 0),
  },
  {
    key: 'checksum',
    header: 'Checksum',
    render: (row) => (
      <span style={mono} title={row.checksum}>
        {row.checksum ? truncate(row.checksum, 14) : '—'}
      </span>
    ),
  },
  { key: 'statusKey', header: 'Status', render: (row) => <StatusBadge statusKey={row.statusKey} /> },
];

export default function BackupListPage() {
  const navigate = useNavigate();
  const { backups, page, loading, error, fetchBackups } = useBackupList();

  useEffect(() => {
    fetchBackups(1);
  }, [fetchBackups]);

  return (
    <div>
      <PageHeader
        title="Backups"
        subtitle="Backup history and creation"
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/settings/backup/archived')}>
              Archived records
            </Button>
            <Button variant="secondary" onClick={() => navigate('/settings/backup/archive')}>
              Run archive
            </Button>
            <Button onClick={() => navigate('/settings/backup/new')} icon={<Icon name="plus" />}>
              New Backup
            </Button>
          </>
        }
      />

      <Card>
        <CardBody>
          {error && <Alert variant="danger">{error}</Alert>}
          <DataTable
            columns={columns}
            data={backups}
            loading={loading}
            emptyTitle="No backups found"
            emptyDescription="Create your first backup to get started."
            getRowId={(row) => row.backupId}
          />
          {page.totalPages > 1 && (
            <PaginationBar
              page={page}
              onPageChange={(p) => fetchBackups(p)}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
