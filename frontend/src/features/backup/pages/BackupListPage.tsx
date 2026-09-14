/* BackupListPage.tsx — FE-14: Backup list view */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/data/DataTable';
import { PaginationBar } from '@/components/data/PaginationBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Icon } from '@/components/ui/Icon';
import { useBackupList } from '../hooks/useBackup';
import type { Backup } from '@/types/domain';

const columns: Column<Backup>[] = [
  { key: 'backupId', header: 'ID', render: (row) => row.backupId },
  {
    key: 'scope',
    header: 'Scope',
    render: (row) => <StatusBadge statusKey={row.scope} />,
  },
  { key: 'createdAt', header: 'Created', render: (row) => new Date(row.createdAt).toLocaleString() },
  { key: 'createdBy', header: 'By' },
  { key: 'checksum', header: 'Checksum', render: (row) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{row.checksum}</span> },
  { key: 'rowCount', header: 'Rows', align: 'right' },
  { key: 'notes', header: 'Notes', render: (row) => row.notes ?? '—' },
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
          <Button onClick={() => navigate('/settings/backup/new')} icon={<Icon name="plus" />}>
            New Backup
          </Button>
        }
      />

      <Card>
        <CardBody>
          {error && <div className="hs-alert hs-alert--danger" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}
          <DataTable
            columns={columns}
            data={backups}
            loading={loading}
            emptyTitle="No backups found"
            emptyDescription="Create your first backup to get started."
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
