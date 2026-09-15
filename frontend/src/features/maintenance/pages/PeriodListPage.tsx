/* PeriodListPage.tsx — FE-06
 * Manage billing periods: create (ensure), lock and unlock.
 * Unlock requires a reason — the server rejects a reasonless unlock (SRS §4), so the
 * dialog enforces it client-side too rather than letting the request fail.
 * The period key is always generated from the clock, never offered as a fixed list. */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/data/DataTable';
import { AmountText } from '@/components/data/AmountText';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { FilterBar } from '@/components/data/FilterBar';
import { ErrorState } from '@/components/ui/ErrorState';
import { PermissionGate } from '@/app/PermissionGate';
import { usePeriods } from '../hooks/usePeriods';
import type { BillingPeriod } from '@/types/domain';

export default function PeriodListPage() {
  const { periods, page, loading, error, busyPeriodKey, setPage, reload, ensurePeriod, lock, unlock } =
    usePeriods();

  const [createOpen, setCreateOpen] = useState(false);
  const [newPeriodKey, setNewPeriodKey] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [lockTarget, setLockTarget] = useState<BillingPeriod | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<BillingPeriod | null>(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!/^\d{4}-\d{2}$/.test(newPeriodKey)) {
      setFormError('Use the format YYYY-MM (for example 2026-09).');
      return;
    }
    setFormError(null);
    await ensurePeriod(newPeriodKey);
    setCreateOpen(false);
    setNewPeriodKey('');
  };

  const handleUnlock = async () => {
    if (!unlockTarget) return;
    if (!unlockReason.trim()) {
      setUnlockError('A reason is required to unlock a period.');
      return;
    }
    setUnlockError(null);
    await unlock(unlockTarget.periodKey, unlockReason.trim());
    setUnlockTarget(null);
    setUnlockReason('');
  };

  const columns: Column<BillingPeriod>[] = [
    {
      key: 'periodKey',
      header: 'Period',
      render: (r) => (
        <Link to={`/maintenance/demands?periodKey=${r.periodKey}`} style={{ fontWeight: 'var(--weight-medium)' }}>
          {r.periodKey}
        </Link>
      ),
    },
    { key: 'financialYear', header: 'Financial Year' },
    { key: 'demandCount', header: 'Demands', align: 'right', render: (r) => String(r.demandCount) },
    {
      key: 'totalDemand',
      header: 'Demand',
      align: 'right',
      render: (r) => <AmountText amount={r.totalDemand} />,
    },
    {
      key: 'totalCollected',
      header: 'Collected',
      align: 'right',
      render: (r) => <AmountText amount={r.totalCollected} />,
    },
    {
      key: 'statusKey',
      header: 'Status',
      render: (r) => <StatusBadge statusKey={r.statusKey} />,
    },
    {
      key: 'isLocked',
      header: 'Lock',
      render: (r) =>
        r.isLocked ? (
          <Badge variant="warning">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <Icon name="lock" size={12} /> Locked
            </span>
          </Badge>
        ) : (
          <Badge variant="success">Open</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => {
        const busy = busyPeriodKey === r.periodKey;
        return (
          <div
            style={{ display: 'inline-flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}
            onClick={(e) => e.stopPropagation()}
          >
            {r.isLocked ? (
              <PermissionGate permission="maintenance.lock">
                <Button
                  variant="ghost"
                  size="sm"
                  loading={busy}
                  icon={<Icon name="unlock" size={14} />}
                  onClick={() => {
                    setUnlockTarget(r);
                    setUnlockReason('');
                    setUnlockError(null);
                  }}
                >
                  Unlock
                </Button>
              </PermissionGate>
            ) : (
              <PermissionGate permission="maintenance.lock">
                <Button
                  variant="ghost"
                  size="sm"
                  loading={busy}
                  icon={<Icon name="lock" size={14} />}
                  onClick={() => setLockTarget(r)}
                >
                  Lock
                </Button>
              </PermissionGate>
            )}
          </div>
        );
      },
    },
  ];

  if (error && periods.length === 0) {
    return (
      <div>
        <PageHeader title="Billing Periods" />
        <ErrorState message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Billing Periods"
        subtitle="Create, lock and unlock the periods that demands are raised against"
        actions={
          <PermissionGate permission="maintenance.generate">
            <Button
              icon={<Icon name="plus" size={16} />}
              onClick={() => {
                setCreateOpen(true);
                setFormError(null);
                // Default to the current month; the user can change it.
                const now = new Date();
                setNewPeriodKey(
                  `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
                );
              }}
            >
              New Period
            </Button>
          </PermissionGate>
        }
      />

      {error && periods.length > 0 && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      <FilterBar>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          Periods are created explicitly; a period is never assumed to exist.
        </span>
      </FilterBar>

      <Card>
        <CardBody>
          <DataTable
            columns={columns}
            data={periods}
            loading={loading}
            getRowId={(r) => r.periodId}
            emptyTitle="No billing periods yet"
            emptyDescription="Create a period before generating demands."
          />
          {!loading && periods.length > 0 && <Pagination page={page} onPageChange={setPage} />}
        </CardBody>
      </Card>

      {/* Create period */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Billing Period"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} loading={busyPeriodKey === newPeriodKey}>
              Create
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
          Creating a period that already exists is safe — the server returns the existing record.
        </p>
        <FormField label="Period Key" required error={formError ?? undefined} hint="Format: YYYY-MM">
          <Input
            value={newPeriodKey}
            onChange={(e) => setNewPeriodKey(e.target.value)}
            placeholder="2026-09"
            error={formError ?? undefined}
          />
        </FormField>
      </Modal>

      {/* Lock confirmation */}
      <ConfirmDialog
        open={lockTarget !== null}
        onClose={() => setLockTarget(null)}
        onConfirm={() => {
          if (lockTarget) void lock(lockTarget.periodKey);
          setLockTarget(null);
        }}
        title="Lock this period?"
        message={
          lockTarget
            ? `Locking ${lockTarget.periodKey} prevents further demand and payment writes for that period. This is recorded in the audit log.`
            : ''
        }
        confirmLabel="Lock Period"
        loading={busyPeriodKey === lockTarget?.periodKey}
      />

      {/* Unlock requires a reason */}
      <Modal
        open={unlockTarget !== null}
        onClose={() => setUnlockTarget(null)}
        title="Unlock Period"
        footer={
          <>
            <Button variant="secondary" onClick={() => setUnlockTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleUnlock()}
              loading={busyPeriodKey === unlockTarget?.periodKey}
            >
              Unlock Period
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Unlocking {unlockTarget?.periodKey} re-opens it for writes. A reason is mandatory and is
          stored in the audit log.
        </p>
        <div style={{ marginTop: 'var(--space-3)' }}>
          <FormField label="Reason" required error={unlockError ?? undefined}>
            <Textarea
              rows={3}
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="Why does this period need to be reopened?"
              error={unlockError ?? undefined}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
