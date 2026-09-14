/* ArchiveRunPage.tsx — FE-14: Archive run with dry-run support */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Alert } from '@/components/ui/Alert';
import { DataTable, type Column } from '@/components/data/DataTable';
import { useArchiveRun } from '../hooks/useArchive';
import type { ArchiveRunJob } from '@/services/backupService';

const ENTITY_OPTIONS = [
  { value: '', label: 'All entities' },
  { value: 'Demands', label: 'Demands' },
  { value: 'Payments', label: 'Payments' },
  { value: 'Complaints', label: 'Complaints' },
  { value: 'Visitors', label: 'Visitors' },
  { value: 'Expenses', label: 'Expenses' },
  { value: 'Attendance', label: 'Attendance' },
];

const jobColumns: Column<ArchiveRunJob>[] = [
  { key: 'entity', header: 'Entity' },
  { key: 'moved', header: 'Moved', align: 'right' },
  { key: 'skipped', header: 'Skipped', align: 'right' },
];

export default function ArchiveRunPage() {
  const navigate = useNavigate();
  const { run, result, loading, error } = useArchiveRun();
  const [entity, setEntity] = useState('');
  const [olderThanMonths, setOlderThanMonths] = useState<number>(12);
  const [dryRun, setDryRun] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(entity || undefined, olderThanMonths, dryRun);
  };

  return (
    <div>
      <PageHeader title="Run Archive" subtitle="Move old records to archive sheets" />

      <Card style={{ maxWidth: 700 }}>
        <form onSubmit={handleSubmit}>
          <CardBody>
            {error && <Alert variant="danger">{error}</Alert>}

            {result && (
              <Alert variant={dryRun ? 'info' : 'success'}>
                {dryRun ? 'Dry run complete.' : 'Archive complete.'}{' '}
                Moved: {result.movedCount}, Skipped: {result.skippedCount}
              </Alert>
            )}

            <FormField label="Entity">
              <Select
                options={ENTITY_OPTIONS}
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
              />
            </FormField>

            <FormField label="Older than (months)" required>
              <Input
                type="number"
                min={1}
                value={olderThanMonths}
                onChange={(e) => setOlderThanMonths(Number(e.target.value))}
              />
            </FormField>

            <FormField label="Dry Run">
              <Switch
                label="Preview without moving records"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
              />
            </FormField>

            {result && result.jobs.length > 0 && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <h4 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>Results by entity:</h4>
                <DataTable columns={jobColumns} data={result.jobs} />
              </div>
            )}
          </CardBody>

          <CardFooter>
            <Button type="button" variant="ghost" onClick={() => navigate('/settings/backup')}>
              Back
            </Button>
            <Button type="submit" loading={loading} variant={dryRun ? 'secondary' : 'danger'}>
              {dryRun ? 'Preview (Dry Run)' : 'Run Archive'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
