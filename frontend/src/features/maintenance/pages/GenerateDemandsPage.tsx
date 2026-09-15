/* GenerateDemandsPage.tsx — FE-06
 * Raise demands for a billing period.
 *
 * IMPORTANT: the backend does NOT implement a dry-run (`MaintenanceService.generateDemands`
 * never reads a `dryRun` flag). Rather than pretend to preview, this page shows the real
 * current state of the period (how many demands already exist) and then asks for explicit
 * confirmation before writing. Requirements SRS §4, §23. */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PermissionGate } from '@/app/PermissionGate';
import { useDemandGeneration } from '../hooks/useDemands';
import { usePeriods } from '../hooks/usePeriods';

export default function GenerateDemandsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { periods, loading: periodsLoading } = usePeriods();
  const { existingCount, inspecting, result, generating, error, inspect, generate, reset } =
    useDemandGeneration();

  const now = new Date();
  const currentPeriodKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  const [periodKey, setPeriodKey] = useState(
    searchParams.get('periodKey') ?? currentPeriodKey,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selected = periods.find((p) => p.periodKey === periodKey) ?? null;

  const periodOptions = periods.map((p) => ({
    value: p.periodKey,
    label: `${p.periodKey}${p.isLocked ? ' (locked)' : ''}`,
  }));

  const handleInspect = () => {
    reset();
    void inspect(periodKey);
  };

  const handleConfirm = async () => {
    setConfirmOpen(false);
    await generate(periodKey);
  };

  const locked = selected?.isLocked === true;

  return (
    <div>
      <PageHeader
        title="Generate Demands"
        subtitle="Raise maintenance demands for every flat in a billing period"
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Demands', route: '/maintenance/demands', onClick: () => navigate('/maintenance/demands') },
              { label: 'Generate' },
            ]}
          />
        }
        actions={
          <Button variant="ghost" icon={<Icon name="back" size={16} />} onClick={() => navigate('/maintenance/demands')}>
            Back
          </Button>
        }
      />

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Alert variant="warning">
          Demand generation writes to the ledger. This build has no dry-run mode, so the figures
          below describe what already exists — they are not a prediction of what will be created.
        </Alert>
      </div>

      <div className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2" style={{ gap: 'var(--space-4)' }}>
        <Card>
          <CardHeader title="Select Period" />
          <CardBody>
            {periodsLoading ? (
              <Spinner />
            ) : periods.length === 0 ? (
              <Alert variant="info">
                No billing periods exist yet. Create one first on the Billing Periods page.
              </Alert>
            ) : (
              <>
                <FormField
                  label="Billing Period"
                  required
                  hint="Only periods that already exist can be generated against."
                >
                  <Select
                    options={periodOptions}
                    value={periodKey}
                    onChange={(e) => {
                      setPeriodKey(e.target.value);
                      reset();
                    }}
                  />
                </FormField>

                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--space-2)',
                    marginTop: 'var(--space-4)',
                    flexWrap: 'wrap',
                  }}
                >
                  <Button
                    variant="secondary"
                    onClick={handleInspect}
                    loading={inspecting}
                    icon={<Icon name="search" size={16} />}
                    disabled={!periodKey}
                  >
                    Check Current State
                  </Button>
                  <PermissionGate permission="maintenance.generate">
                    <Button
                      onClick={() => setConfirmOpen(true)}
                      loading={generating}
                      disabled={locked || !periodKey}
                      icon={<Icon name="maintenance" size={16} />}
                    >
                      Generate Demands
                    </Button>
                  </PermissionGate>
                </div>

                {locked && (
                  <p
                    style={{
                      marginTop: 'var(--space-2)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-danger)',
                    }}
                  >
                    This period is locked. Unlock it before generating demands.
                  </p>
                )}
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Current State" />
          <CardBody>
            {error && (
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <Alert variant="danger">{error}</Alert>
              </div>
            )}

            {inspecting ? (
              <Spinner />
            ) : (
              <DescriptionList
                items={[
                  { label: 'Selected Period', value: periodKey || '—' },
                  {
                    label: 'Demands Already Present',
                    value:
                      existingCount === null ? (
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          Not checked yet
                        </span>
                      ) : (
                        <Badge variant={existingCount > 0 ? 'warning' : 'success'}>
                          {existingCount}
                        </Badge>
                      ),
                  },
                  {
                    label: 'Period Status',
                    value: selected ? <Badge variant="info">{selected.statusKey}</Badge> : '—',
                  },
                  {
                    label: 'Lock State',
                    value: selected
                      ? selected.isLocked
                        ? 'Locked'
                        : 'Open'
                      : '—',
                  },
                ]}
              />
            )}

            <p
              style={{
                marginTop: 'var(--space-4)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-muted)',
              }}
            >
              Running generation again is safe: flats that already have a demand for this period
              and charge type are skipped and reported back as a skipped count.
            </p>
          </CardBody>
        </Card>
      </div>

      {result && (
        <Card style={{ marginTop: 'var(--space-4)' }}>
          <CardHeader title="Generation Complete" />
          <CardBody>
            <div className="hs-grid hs-grid-cols-3" style={{ gap: 'var(--space-4)' }}>
              <div>
                <div className="hs-kpi__label">Created</div>
                <div className="hs-kpi__value">{result.created}</div>
              </div>
              <div>
                <div className="hs-kpi__label">Skipped</div>
                <div className="hs-kpi__value">{result.skipped}</div>
              </div>
              <div>
                <div className="hs-kpi__label">Total Considered</div>
                <div className="hs-kpi__value">{result.total}</div>
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
              <Button
                onClick={() => navigate(`/maintenance/demands?periodKey=${result.periodKey}`)}
              >
                View Demands
              </Button>
              <Button variant="ghost" onClick={() => navigate('/maintenance')}>
                Back to Maintenance
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void handleConfirm()}
        title={`Generate demands for ${periodKey}?`}
        message={
          existingCount !== null && existingCount > 0
            ? `${existingCount} demand(s) already exist for ${periodKey}. Flats already covered will be skipped; the rest will be raised now.`
            : `This will raise maintenance demands for every flat in ${periodKey}. The action is recorded in the audit log.`
        }
        confirmLabel="Generate"
        variant="primary"
        loading={generating}
      />
    </div>
  );
}
