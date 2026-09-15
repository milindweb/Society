/* ParkingAllocationsPage.tsx — FE-09
 * SRS §10: allocate a slot to a flat/member, tie it to a vehicle, run permanent
 * or temporary allocations, and keep the history.
 *
 * Contract notes (verified against backend/src/ParkingService.gs + Routes.gs):
 * - `parking.allocations.list` returns RAW rows: there is no server-side join, so
 *   `slotNumber` / `flatNumber` / `vehicleNumber` only exist when the row itself
 *   carries them. Slot and flat labels are therefore resolved from the config
 *   lookups here, which is why those columns are defensive.
 * - Slot labels come from config (`parkingSlots`), because there is no parking
 *   slot API — see `parkingService.ts` and `ParkingSlotsPage.tsx`.
 * - Filters the server actually supports: parkingSlotId, flatId, statusKey.
 * - A `CONFLICT_ERROR` on create means the slot or the vehicle already has an
 *   ACTIVE allocation; the modal shows the server's own message inline.
 * - Ending an allocation is only offered while it is ACTIVE (`canEndAllocation`);
 *   the backend refuses anything else.
 *
 * No optimistic UI (SRS §23): after either write the list AND the summary are
 * reloaded, because allocating or ending also changes the slot's own status. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PermissionGate } from '@/app/PermissionGate';
import { DataTable, type Column } from '@/components/data/DataTable';
import { DataListMobile } from '@/components/data/DataListMobile';
import { FilterBar } from '@/components/data/FilterBar';
import { PaginationBar } from '@/components/data/PaginationBar';
import { AmountText } from '@/components/data/AmountText';
import { AllocateParkingModal } from '../components/AllocateParkingModal';
import { EndAllocationModal } from '../components/EndAllocationModal';
import { useAllocationList, useParkingSummary, useAllocation } from '../hooks/useParking';
import { useParkingSlotOptions, useAllocationStatusOptions } from '../hooks/useParkingLookups';
import { canEndAllocation } from '@/services/parkingService';
import { formatDate } from '@/lib/dates';
import type { ParkingAllocation } from '@/types/domain';

export default function ParkingAllocationsPage() {
  const navigate = useNavigate();

  const [slotId, setSlotId] = useState('');
  const [statusKey, setStatusKey] = useState('');
  const [allocating, setAllocating] = useState(false);
  const [ending, setEnding] = useState<ParkingAllocation | null>(null);

  const slots = useParkingSlotOptions();
  const statuses = useAllocationStatusOptions();

  const { allocations, page, loading, error, setFilters, setPage, reload } = useAllocationList({
    parkingSlotId: slotId || undefined,
    statusKey: statusKey || undefined,
  });

  const summary = useParkingSummary();

  /* The end dialog is driven by its own hook instance so the server's rejection
   * message has somewhere to live without disturbing the list's own error. */
  const endTarget = useAllocation(ending?.allocationId);

  const slotLabel = (row: ParkingAllocation) =>
    row.slotNumber ||
    slots.options.find((option) => option.value === row.parkingSlotId)?.label ||
    row.parkingSlotId;

  const columns: Column<ParkingAllocation>[] = [
    {
      key: 'slotNumber',
      header: 'Slot',
      render: (row) => (
        <div>
          <div>{slotLabel(row)}</div>
          {row.allocationType ? (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {row.allocationType}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'flatId',
      header: 'Flat',
      render: (row) => row.flatNumber || row.flatId,
    },
    {
      key: 'vehicleNumber',
      header: 'Vehicle',
      render: (row) => row.vehicleNumber || row.vehicleId || '—',
    },
    {
      key: 'startDate',
      header: 'Period',
      render: (row) => (
        <span>
          {row.startDate ? formatDate(row.startDate) : '—'}
          {row.endDate ? ` → ${formatDate(row.endDate)}` : ''}
        </span>
      ),
    },
    {
      key: 'monthlyCharge',
      header: 'Monthly charge',
      align: 'right',
      render: (row) => <AmountText amount={Number(row.monthlyCharge) || 0} />,
    },
    {
      key: 'statusKey',
      header: 'Status',
      render: (row) => <StatusBadge statusKey={row.statusKey} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        canEndAllocation(row.statusKey) ? (
          <PermissionGate permission="parking.write">
            <Button
              variant="ghost"
              icon={<Icon name="x" size={16} />}
              onClick={() => setEnding(row)}
            >
              End
            </Button>
          </PermissionGate>
        ) : null,
    },
  ];

  const renderMobile = (row: ParkingAllocation) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <strong>{slotLabel(row)}</strong>
        <StatusBadge statusKey={row.statusKey} />
      </div>
      <div
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          marginTop: 'var(--space-1)',
        }}
      >
        Flat {row.flatNumber || row.flatId}
        {row.vehicleNumber || row.vehicleId ? ` · ${row.vehicleNumber || row.vehicleId}` : ''}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
        {row.startDate ? formatDate(row.startDate) : '—'} →{' '}
        {row.endDate ? formatDate(row.endDate) : 'ongoing'} · {row.allocationType}
      </div>
      {canEndAllocation(row.statusKey) ? (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <PermissionGate permission="parking.write">
            <Button variant="secondary" onClick={() => setEnding(row)}>
              End allocation
            </Button>
          </PermissionGate>
        </div>
      ) : null}
    </div>
  );

  const body = (() => {
    if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
    if (loading) return <Skeleton height={240} variant="rect" />;
    if (allocations.length === 0) {
      return (
        <EmptyState
          title="No allocations found"
          description={
            slotId || statusKey
              ? 'No allocation matches the current filters.'
              : 'No parking slot has been allocated yet.'
          }
        />
      );
    }
    return (
      <>
        <div className="hs-only-desktop">
          <DataTable
            columns={columns}
            data={allocations}
            getRowId={(row) => row.allocationId}
            emptyTitle="No allocations found"
          />
        </div>
        <div className="hs-only-mobile">
          <DataListMobile
            data={allocations}
            render={renderMobile}
            emptyTitle="No allocations found"
          />
        </div>
        <PaginationBar page={page} onPageChange={setPage} />
      </>
    );
  })();

  /* After a write, refresh BOTH the list and the summary: allocating or ending
   * also flips the slot's status, so the counts are stale by definition. */
  const afterWrite = async () => {
    await Promise.all([reload(), summary.reload()]);
  };

  return (
    <div>
      <PageHeader
        title="Parking allocations"
        subtitle="Who is parked where — permanent and temporary"
        breadcrumbs={undefined}
        actions={
          <PermissionGate permission="parking.write">
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button
                variant="secondary"
                icon={<Icon name="parking" size={16} />}
                onClick={() => navigate('/parking/slots')}
              >
                Slots
              </Button>
              <Button icon={<Icon name="plus" size={16} />} onClick={() => setAllocating(true)}>
                Allocate a slot
              </Button>
            </div>
          </PermissionGate>
        }
      />

      {summary.summary ? (
        <div
          className="hs-grid hs-grid-cols-2 hs-lg-grid-cols-4"
          style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}
        >
          <SummaryCell label="Available slots" value={summary.summary.available} />
          <SummaryCell label="Allocated slots" value={summary.summary.allocated} />
          <SummaryCell label="Temporary, active" value={summary.summary.activeTemporary} />
          <SummaryCell
            label="Monthly charge collection"
            amount={Number(summary.summary.monthlyChargeCollection) || 0}
          />
        </div>
      ) : null}

      <Card>
        <CardBody>
          <FilterBar>
            <Select
              aria-label="Filter by slot"
              value={slotId}
              options={[{ value: '', label: 'All slots' }, ...slots.options]}
              onChange={(e) => {
                setSlotId(e.target.value);
                setFilters({ parkingSlotId: e.target.value || undefined });
              }}
            />
            <Select
              aria-label="Filter by status"
              value={statusKey}
              options={[{ value: '', label: 'All statuses' }, ...statuses.options]}
              onChange={(e) => {
                setStatusKey(e.target.value);
                setFilters({ statusKey: e.target.value || undefined });
              }}
            />
            <Button variant="ghost" onClick={() => void reload()} disabled={loading}>
              Refresh
            </Button>
          </FilterBar>
        </CardBody>
      </Card>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardBody>{body}</CardBody>
      </Card>

      <AllocateParkingModal
        open={allocating}
        onClose={() => setAllocating(false)}
        onCreated={() => {
          setAllocating(false);
          void afterWrite();
        }}
      />

      <EndAllocationModal
        open={Boolean(ending)}
        allocation={ending}
        busy={endTarget.busy}
        error={endTarget.error}
        onClose={() => setEnding(null)}
        onConfirm={async (input) => {
          const ok = await endTarget.end(input);
          if (ok) {
            setEnding(null);
            void afterWrite();
          }
          return ok;
        }}
      />
    </div>
  );
}

/** Small server-backed counter used in the page's own KPI strip. Kept local
 * because the parking landing page owns the full KpiCard presentation. */
function SummaryCell({
  label,
  value,
  amount,
}: {
  label: string;
  value?: number;
  amount?: number;
}) {
  return (
    <Card>
      <CardBody>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{label}</div>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginTop: 'var(--space-1)' }}>
          {typeof amount === 'number' ? <AmountText amount={amount} /> : (value ?? 0)}
        </div>
      </CardBody>
    </Card>
  );
}
