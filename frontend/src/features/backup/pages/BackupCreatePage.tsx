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
import { useBackupCreate } from '../hooks/useBackup';

const SCOPE_OPTIONS = [
  { value: 'FULL', label: 'Full Backup — All data' },
  { value: 'CONFIG', label: 'Config — Configuration only' },
  { value: 'FINANCE', label: 'Finance — Payments, demands, ledger' },
  { value: 'OPERATIONS', label: 'Operations — Complaints, visitors, meetings' },
];

export default function BackupCreatePage() {
  const navigate = useNavigate();
  const { create, created, loading, error } = useBackupCreate();
  const [scope, setScope] = useState<string>('FULL');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await create(scope, notes || undefined);
    if (result) {
      navigate('/settings/backup');
    }
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
                Backup created successfully. Checksum: {created.checksum}
              </Alert>
            )}

            <FormField label="Backup Scope" required>
              <Select
                options={SCOPE_OPTIONS}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              />
            </FormField>

            <FormField label="Notes" hint="Optional description for this backup">
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Pre-migration backup"
              />
            </FormField>
          </CardBody>

          <CardFooter>
            <Button type="button" variant="ghost" onClick={() => navigate('/settings/backup')}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Create Backup
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
