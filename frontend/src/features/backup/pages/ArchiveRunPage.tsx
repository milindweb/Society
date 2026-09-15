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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/data/DataTable';
import { useArchiveRun, useArchivableEntities } from '../hooks/useArchive';
import type { ArchiveRunJob } from '@/services/backupService';

/** Job rows are keyed by the source **sheet** name — the service pushes
 *  `{ sheet: sheetName, moved, skipped }` (`BackupService.gs:311`). */
const jobColumns: Column<ArchiveRunJob>[] = [
  { key: 'sheet', header: 'Sheet' },
  { key: 'moved', header: 'Moved', align: 'right' },
  { key: 'skipped', header: 'Skipped', align: 'right' },
];

export default function ArchiveRunPage() {
  const navigate = useNavigate();
  const { run, result, loading, error } = useArchiveRun();
  /* Only sheets the server actually walks (`Schema.archivableSheets()`, surfaced
   * through config.enums). The old list — Demands/Payments/Complaints/Visitors/
   * Expenses/Attendance — matched nothing, because none of those sheets are
   * declared archivable. */
  const { options: entityOptions, loading: entitiesLoading } = useArchivableEntities();

  const [entity, setEntity] = useState('');
  const [olderThanMonths, setOlderThanMonths] = useState<number>(12);
  const [reason, setReason] = useState('');
  /* Preview is the default. A real run copies rows and writes index entries;
   * `BackupService.gs:266` only skips those writes while `dryRun` is truthy. */
  const [dryRun, setDryRun] = useState(true);
  const [confirming, setConfirming] = useState(false);

  const runNow = async () => {
    setConfirming(false);
    await run(entity || undefined, olderThanMonths, dryRun, reason || undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dryRun) {
      await runNow();
      return;
    }
    setConfirming(true);
  };

  const selectOptions = [{ value: '', label: 'All archivable sheets' }, ...entityOptions];

  return (
    <div>
      <PageHeader title="Run Archive" subtitle="Copy old records into their archive sheets" />

      <Card style={{ maxWidth: 700 }}>
        <form onSubmit={handleSubmit}>
          <CardBody>
            {error && <Alert variant="danger">{error}</Alert>}

            {result && (
              <Alert variant={result.dryRun ? 'info' : 'success'}>
                {result.dryRun
                  ? 'Dry run complete — nothing was moved.'
                  : 'Archive complete.'}{' '}
                Moved: {result.movedCount}, Skipped: {result.skippedCount}
              </Alert>
            )}

            <FormField label="Sheet">
              <Select
                aria-label="Sheet to archive"
                options={selectOptions}
                value={entity}
                disabled={entitiesLoading}
                onChange={(e) => setEntity(e.target.value)}
              />
            </FormField>

            <FormField
              label="Older than (months)"
              required
              hint="Records created before this cutoff are candidates."
            >
              <Input
                type="number"
                min={1}
                value={olderThanMonths}
                onChange={(e) => setOlderThanMonths(Number(e.target.value))}
              />
            </FormField>

            <FormField label="Reason" hint="Recorded on each archive index entry.">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Scheduled archive"
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
                <h4 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
                  Results by sheet:
                </h4>
                <DataTable
                  columns={jobColumns}
                  data={result.jobs}
                  getRowId={(row) => row.sheet}
                />
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

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={runNow}
        title="Run archive for real?"
        message={
          'Matching records will be copied into their archive sheets and an archive index entry ' +
          'will be written for each one. Records with unsettled financial positions are skipped. ' +
          'Run a dry run first if you have not already.'
        }
        confirmLabel="Run Archive"
        variant="danger"
        loading={loading}
      />
    </div>
  );
}
