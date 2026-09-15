/* ParkingListPage.tsx — FE-09
 * SRS §10: "Parking slots, allocation to flats, vehicle details, temporary
 * parking". This is the module's landing page: the slot picture at a glance
 * (SRS §10 + design.md §39 KPI row) and the two working screens behind it.
 *
 * Every number here comes from `parking.summary` — the backend counts the slots
 * and totals the active monthly charges. Nothing is computed in the browser
 * (SRS §8/§23). The page offers no writes of its own; slot operations live on
 * the Allocations screen. */

import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { PermissionGate } from '@/app/PermissionGate';
import { KpiCard } from '@/components/data/KpiCard';
import { formatMoney } from '@/lib/money';
import { useParkingSummary } from '../hooks/useParking';

export default function ParkingListPage() {
  const navigate = useNavigate();
  const { summary, loading, error, reload } = useParkingSummary();

  const kpis = summary
    ? [
        { label: 'Total slots', value: summary.totalSlots },
        { label: 'Available', value: summary.available },
        { label: 'Allocated', value: summary.allocated },
        { label: 'Blocked / under maintenance', value: summary.blocked },
        { label: 'Active temporary', value: summary.activeTemporary },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Parking"
        subtitle="Slots, allocations, vehicles and temporary parking"
        actions={
          <PermissionGate permission="parking.write">
            <Button
              icon={<Icon name="plus" size={16} />}
              onClick={() => navigate('/parking/allocations')}
            >
              Allocate a slot
            </Button>
          </PermissionGate>
        }
      />

      {error ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">
            {error}{' '}
            <Button variant="ghost" onClick={() => void reload()}>
              Retry
            </Button>
          </Alert>
        </div>
      ) : null}

      {loading ? (
        <Skeleton height={96} variant="rect" />
      ) : summary ? (
        <>
          <div className="hs-grid hs-grid-cols-2 hs-lg-grid-cols-3" style={{ gap: 'var(--space-4)' }}>
            {kpis.map((kpi) => (
              <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
            ))}
            <KpiCard
              label="Monthly charge collection"
              value={formatMoney(Number(summary.monthlyChargeCollection) || 0)}
            />
          </div>

          <p
            style={{
              marginTop: 'var(--space-3)',
              marginBottom: 0,
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
            }}
          >
            Counts and the charge total are computed server-side from the parking records.
          </p>
        </>
      ) : null}

      <div
        className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
        style={{ gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}
      >
        <Card>
          <CardHeader title="Allocations" />
          <CardBody>
            <p style={{ marginTop: 0, fontSize: 'var(--text-sm)' }}>
              Allocate a slot to a flat, link the vehicle, choose permanent or temporary, and end the
              allocation when it is over.
            </p>
            <Button
              variant="secondary"
              icon={<Icon name="parking" size={16} />}
              onClick={() => navigate('/parking/allocations')}
            >
              Open allocations
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Slot master" />
          <CardBody>
            <p style={{ marginTop: 0, fontSize: 'var(--text-sm)' }}>
              The slot list itself is configuration data. The backend exposes no parking-slot write
              API — slots are added and edited in Settings; this screen shows them read-only with
              their live availability.
            </p>
            <Button
              variant="secondary"
              icon={<Icon name="documents" size={16} />}
              onClick={() => navigate('/parking/slots')}
            >
              View slots
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
