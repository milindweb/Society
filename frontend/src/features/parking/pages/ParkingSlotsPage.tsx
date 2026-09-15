/* ParkingSlotsPage.tsx — FE-09
 * SRS §10: "parking information should be configurable" — slot number, type,
 * wing, floor and location. This screen shows that master READ-ONLY.
 *
 * ⚠️ Why there is no Add/Edit button here: the backend exposes NO parking-slot
 * write route. `ParkingService.gs` returns exactly `listAllocations`,
 * `getAllocation`, `createAllocation`, `endAllocation` and `summary` — no slot
 * CRUD. The `Parking_Slots` sheet is mastered through the configuration API
 * (`config.entity.*`, entity `parkingSlots`), which is edited in Settings. Adding
 * a write button here would promise a capability the server does not have, so
 * this page reads and explains instead.
 *
 * `statusKey` (AVAILABLE / ALLOCATED / BLOCKED / MAINTENANCE) is likewise
 * server-owned: allocating or ending an allocation flips the slot. Nothing on
 * this page writes it. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable, type Column } from '@/components/data/DataTable';
import { DataListMobile } from '@/components/data/DataListMobile';
import { FilterBar } from '@/components/data/FilterBar';
import { useParkingSlots, useParkingSlotStatusOptions, useParkingTypeOptions } from '../hooks/useParkingLookups';
import { useWingOptions } from '@/features/flats/hooks/useLookups';
import { useDebounce } from '@/lib/useDebounce';
import type { ParkingSlot } from '@/types/domain';

export default function ParkingSlotsPage() {
  const navigate = useNavigate();

  const { slots, loading, error, reload } = useParkingSlots();
  const wings = useWingOptions();
  const types = useParkingTypeOptions();
  const statuses = useParkingSlotStatusOptions();

  const [search, setSearch] = useState('');
  const [statusKey, setStatusKey] = useState('');
  const [wingId, setWingId] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const label = (options: { value: string; label: string }[], value?: string) =>
    options.find((option) => option.value === value)?.label || value || '—';

  /* The slot master is small and arrives in one page, so filtering happens
   * client-side. There is no slot query endpoint to push it to — see the header. */
  const needle = debouncedSearch.toLowerCase();
  const visible = slots.filter((slot) => {
    if (statusKey && slot.statusKey !== statusKey) return false;
    if (wingId && slot.wingId !== wingId) return false;
    if (!needle) return true;
    return (
      slot.slotNumber?.toLowerCase().includes(needle) ||
      slot.location?.toLowerCase().includes(needle) ||
      slot.floorLevel?.toLowerCase().includes(needle)
    );
  });

  const columns: Column<ParkingSlot>[] = [
    {
      key: 'slotNumber',
      header: 'Slot',
      render: (row) => (
        <div>
          <div>{row.slotNumber}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {row.parkingSlotId}
          </div>
        </div>
      ),
    },
    {
      key: 'parkingTypeId',
      header: 'Type',
      render: (row) => label(types.options, row.parkingTypeId),
    },
    {
      key: 'wingId',
      header: 'Wing',
      render: (row) => label(wings.options, row.wingId),
    },
    {
      key: 'floorLevel',
      header: 'Floor',
      render: (row) => row.floorLevel || '—',
    },
    {
      key: 'location',
      header: 'Location',
      render: (row) => row.location || '—',
    },
    {
      key: 'statusKey',
      header: 'Status',
      render: (row) => <StatusBadge statusKey={row.statusKey} />,
    },
  ];

  const renderMobile = (row: ParkingSlot) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <strong>{row.slotNumber}</strong>
        <StatusBadge statusKey={row.statusKey} />
      </div>
      <div
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          marginTop: 'var(--space-1)',
        }}
      >
        {label(types.options, row.parkingTypeId)} · {label(wings.options, row.wingId)}
        {row.floorLevel ? ` · Floor ${row.floorLevel}` : ''}
      </div>
      {row.location ? (
        <div style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>{row.location}</div>
      ) : null}
    </div>
  );

  const body = (() => {
    if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
    if (loading) return <Skeleton height={240} variant="rect" />;
    if (slots.length === 0) {
      return (
        <EmptyState
          title="No parking slots configured"
          description="Parking slots are configuration data. Add the society's slots in Settings and they will appear here."
        />
      );
    }
    if (visible.length === 0) {
      return (
        <EmptyState
          title="No slots match"
          description="No configured slot matches the current search and filters."
        />
      );
    }
    return (
      <>
        <div className="hs-only-desktop">
          <DataTable
            columns={columns}
            data={visible}
            getRowId={(row) => row.parkingSlotId}
            emptyTitle="No parking slots configured"
          />
        </div>
        <div className="hs-only-mobile">
          <DataListMobile
            data={visible}
            render={renderMobile}
            emptyTitle="No parking slots configured"
          />
        </div>
      </>
    );
  })();

  return (
    <div>
      <PageHeader
        title="Parking slots"
        subtitle="The slot master — configured in Settings, updated automatically as slots are allocated"
        actions={
          <Button
            variant="secondary"
            icon={<Icon name="parking" size={16} />}
            onClick={() => navigate('/parking/allocations')}
          >
            Allocations
          </Button>
        }
      />

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Alert variant="info">
          Slots are configuration data and the backend exposes no parking-slot write API, so this
          list is read-only. A slot's status changes on its own: allocating it to a flat marks it
          occupied, and ending that allocation frees it again. Add or edit slots in Settings.
        </Alert>
      </div>

      <Card>
        <CardBody>
          <FilterBar>
            <Input
              value={search}
              placeholder="Search slot number, floor or location..."
              aria-label="Search parking slots"
              className="hs-input--filter"
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              aria-label="Filter by status"
              value={statusKey}
              options={[{ value: '', label: 'All statuses' }, ...statuses.options]}
              onChange={(e) => setStatusKey(e.target.value)}
            />
            <Select
              aria-label="Filter by wing"
              value={wingId}
              options={[{ value: '', label: 'All wings' }, ...wings.options]}
              onChange={(e) => setWingId(e.target.value)}
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
    </div>
  );
}
