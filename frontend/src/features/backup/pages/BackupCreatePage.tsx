/* BackupCreatePage.tsx — FE-14: Backup create form */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { useBackupCreate } from '../hooks/useBackup';
import { useEnumOptions } from '@/lib/useConfigOptions';
import { formatEnumKey } from '@/lib/format';

export default function BackupCreatePage() {
  const navigate = useNavigate();
  const { create, created, loading, error } = useBackupCreate();
  /* Scopes come from `SchemaMeta.ENUM_OPTIONS.BACKUP_SCOPE` via config.enums —
   * SRS §15 forbids hardcoding them, and the server validates against the same
   * list (`BackupService.gs:87`). */
  const { options: scopeOptions, loading: scopesLoading } = useEnumOptions('BACKUP_SCOPE');

  const [scope, setScope] = useState('');
  const [notes, setNotes] = useState('');

  const effectiveScope = scope || scopeOptions[0]?.value || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create(effectiveScope, notes || undefined);
  };

  return (
    <div>
      <PageHeader title="Create Backup" subtitle="Export data to Google Drive" />

      <Card style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          <CardBody>
            {error && <Alert variant="danger">{error}</Alert>}

            {created && (
              <Alert variant="success">
                <p style={{ marginBottom: 'var(--space-3)' }}>Backup created.</p>
                <DescriptionList
                  items={[
                    { label: 'Backup ID', value: created.backupId },
                    { label: 'Scope', value: formatEnumKey(created.scope) },
                    { label: 'Rows', value: created.totalRows.toLocaleString() },
                    { label: 'Sheets', value: String(created.sheets) },
                    { label: 'Checksum', value: created.checksum },
                  ]}
                />
              </Alert>
            )}

            <FormField label="Backup Scope" required>
              <Select
                aria-label="Backup scope"
                options={scopeOptions}
                value={effectiveScope}
                disabled={scopesLoading || Boolean(created)}
                onChange={(e) => setScope(e.target.value)}
              />
            </FormField>

            <FormField label="Notes" hint="Optional description for this backup">
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Pre-migration backup"
                disabled={Boolean(created)}
              />
            </FormField>
          </CardBody>

          <CardFooter>
            <Button type="button" variant="ghost" onClick={() => navigate('/settings/backup')}>
              {created ? 'Back to backups' : 'Cancel'}
            </Button>
            {!created && (
              <Button type="submit" loading={loading} disabled={!effectiveScope}>
                Create Backup
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
