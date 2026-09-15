/* MaintenanceDashboardPage.tsx — FE-06
 * SRS §4 core module overview: demand, collection and lock state per period, plus the
 * period list. Every figure comes from the server — the page never computes a total
 * itself (SRS §23). */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/data/DataTable';
import { KpiCard } from '@/components/data/KpiCard';
import { AmountText } from '@/components/data/AmountText';
import { Pagination } from '@/components/ui/Pagination';
import { PermissionGate } from '@/app/PermissionGate';
import { usePeriods } from '../hooks/usePeriods';
import { formatDate } from '@/lib/dates';
import type { BillingPeriod } from '@/types/domain';

export default function MaintenanceDashboardPage() {
  const navigate = useNavigate();
  const { periods, page, loading, error, setPage, reload } = usePeriods();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // The current period key is derived from the clock, never hardcoded.
  const now = new Date();
  const currentPeriodKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  const active =
    periods.find((p) => p.periodKey === selectedKey) ??
    periods.find((p) => p.periodKey === currentPeriodKey) ??
    periods[0] ??
    null;

  const columns: Column<BillingPeriod>[] = [
    {
      key: 'periodKey',
      header: 'Period',
      render: (r) => (
        <Link
          to={`/maintenance/demands?periodKey=${r.periodKey}`}
          style={{ fontWeight: 'var(--weight-medium)' }}
        >
          {r.periodKey}
        </Link>
      ),
    },
    { key: 'financialYear', header: 'Financial Year' },
    {
      key: 'demandCount',
      header: 'Demands',
      align: 'right',
      render: (r) => String(r.demandCount),
    },
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
      key: 'statusKey',
      header: 'Status',
      render: (r) => <StatusBadge statusKey={r.statusKey} />,
    },
  ];

  if (error && periods.length === 0) {
    return (
      <div>
        <PageHeader title="Maintenance" />
        <ErrorState message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Maintenance & Finance"
        subtitle="Billing periods, demands and collection at a glance"
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="secondary"
              icon={<Icon name="refresh" size={16} />}
              onClick={() => void reload()}
            >
              Refresh
            </Button>
            <PermissionGate permission="maintenance.generate">
              <Button
                icon={<Icon name="maintenance" size={16} />}
                onClick={() => navigate('/maintenance/demands/generate')}
              >
                Generate Demands
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {loading && periods.length === 0 ? (
        <div className="hs-grid hs-grid-cols-2 hs-lg-grid-cols-4" style={{ gap: 'var(--space-4)' }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rect" height={88} />
          ))}
        </div>
      ) : !active ? (
        <EmptyState
          title="No billing periods yet"
          description="Create a period and generate demands to start tracking maintenance."
          icon={<Icon name="calendar" size={40} />}
          action={
            <PermissionGate permission="maintenance.generate">
              <Button onClick={() => navigate('/maintenance/demands/generate')}>
                Generate Demands
              </Button>
            </PermissionGate>
          }
        />
      ) : (
        <>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label
              htmlFor="period-select"
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'block',
                marginBottom: 'var(--space-1)',
              }}
            >
              Period
            </label>
            <select
              id="period-select"
              className="hs-input hs-select"
              style={{ maxWidth: '14rem' }}
              value={active.periodKey}
              onChange={(e) => setSelectedKey(e.target.value)}
            >
              {periods.map((p) => (
                <option key={p.periodId} value={p.periodKey}>
                  {p.periodKey}
                  {p.isLocked ? ' (locked)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="hs-grid hs-grid-cols-2 hs-lg-grid-cols-4" style={{ gap: 'var(--space-4)' }}>
            <KpiCard
              label="Total Demand"
              value={String(active.totalDemand)}
              icon={<Icon name="maintenance" size={20} />}
            />
            <KpiCard
              label="Total Collected"
              value={String(active.totalCollected)}
              icon={<Icon name="payments" size={20} />}
            />
            <KpiCard
              label="Demands Raised"
              value={String(active.demandCount)}
              icon={<Icon name="documents" size={20} />}
            />
            <KpiCard
              label="Lock State"
              value={active.isLocked ? 'Locked' : 'Open'}
              icon={<Icon name={active.isLocked ? 'lock' : 'unlock'} size={20} />}
            />
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-6)',
              margin: 'var(--space-4) 0',
              fontSize: 'var(--text-sm)',
            }}
          >
            <span>
              <span style={{ color: 'var(--color-text-muted)' }}>Demand: </span>
              <AmountText amount={active.totalDemand} />
            </span>
            <span>
              <span style={{ color: 'var(--color-text-muted)' }}>Collected: </span>
              <AmountText amount={active.totalCollected} />
            </span>
            {active.lockedAt && (
              <span>
                <span style={{ color: 'var(--color-text-muted)' }}>Locked on: </span>
                {formatDate(active.lockedAt, 'DD/MM/YYYY HH:mm')}
              </span>
            )}
          </div>
        </>
      )}

      <Card style={{ marginTop: 'var(--space-6)' }}>
        <CardHeader
          title="Billing Periods"
          action={
            <PermissionGate permission="maintenance.generate">
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="calendar" size={14} />}
                onClick={() => navigate('/maintenance/periods')}
              >
                Manage Periods
              </Button>
            </PermissionGate>
          }
        />
        <CardBody>
          <DataTable
            columns={columns}
            data={periods}
            loading={loading}
            getRowId={(r) => r.periodId}
            emptyTitle="No periods found"
            emptyDescription="Billing periods appear here once created."
          />
          {!loading && periods.length > 0 && <Pagination page={page} onPageChange={setPage} />}
        </CardBody>
      </Card>
    </div>
  );
}
