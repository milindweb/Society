/* DemandListPage.tsx — FE-06
 * Monthly maintenance demands. Filters (period / status) come from the API; the period
 * filter is seeded from the ?periodKey= query so the dashboard can deep-link into it.
 * Amounts are server-computed and only formatted here (SRS §23). */

import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable, type Column } from '@/components/data/DataTable';
import { AmountText } from '@/components/data/AmountText';
import { FilterBar } from '@/components/data/FilterBar';
import { LookupSelect } from '@/components/data/LookupSelect';
import { Pagination } from '@/components/ui/Pagination';
import { Alert } from '@/components/ui/Alert';
import { ErrorState } from '@/components/ui/ErrorState';
import { PermissionGate } from '@/app/PermissionGate';
import { useDemandList } from '../hooks/useDemands';
import { usePeriods } from '../hooks/usePeriods';
import { useStatusOptions } from '@/features/flats/hooks/useLookups';
import type { Demand } from '@/types/domain';

export default function DemandListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPeriod = searchParams.get('periodKey') ?? undefined;

  const { periods } = usePeriods();
  const { options: statusOptions, loading: statusesLoading } = useStatusOptions('DEMAND');

  const { demands, page, loading, error, filters, setFilters, setPage, reload } = useDemandList(
    initialPeriod ? { periodKey: initialPeriod } : undefined,
  );

  const periodOptions = periods.map((p) => ({
    value: p.periodKey,
    label: p.isLocked ? `${p.periodKey} (locked)` : p.periodKey,
  }));

  const columns: Column<Demand>[] = [
    {
      key: 'flatNumber',
      header: 'Flat',
      render: (r) => (
        <span style={{ fontWeight: 'var(--weight-medium)' }}>
          {r.wingName ? `${r.wingName} · ` : ''}
          {r.flatNumber ?? r.flatId}
        </span>
      ),
    },
    { key: 'periodKey', header: 'Period' },
    {
      key: 'chargeNameSnapshot',
      header: 'Charge',
      render: (r) => r.chargeNameSnapshot || '—',
    },
    {
      key: 'totalPayable',
      header: 'Payable',
      align: 'right',
      render: (r) => <AmountText amount={r.totalPayable} />,
    },
    {
      key: 'paidAmount',
      header: 'Paid',
      align: 'right',
      render: (r) => <AmountText amount={r.paidAmount} />,
    },
    {
      key: 'balanceAmount',
      header: 'Balance',
      align: 'right',
      render: (r) => <AmountText amount={r.balanceAmount} />,
    },
    {
      key: 'interestAmount',
      header: 'Interest',
      align: 'right',
      render: (r) => <AmountText amount={r.interestAmount} />,
    },
    {
      key: 'statusKey',
      header: 'Status',
      render: (r) => <StatusBadge statusKey={r.statusKey} />,
    },
  ];

  if (error && demands.length === 0) {
    return (
      <div>
        <PageHeader title="Demands" />
        <ErrorState message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Demands"
        subtitle="Monthly maintenance demands raised against flats"
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
                icon={<Icon name="plus" size={16} />}
                onClick={() => navigate('/maintenance/demands/generate')}
              >
                Generate Demands
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {error && demands.length > 0 && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      <FilterBar>
        <LookupSelect
          options={periodOptions}
          value={filters.periodKey ?? ''}
          onChange={(periodKey) => setFilters({ periodKey: periodKey || undefined })}
          placeholder="All Periods"
        />
        <LookupSelect
          options={statusOptions}
          value={filters.statusKey ?? ''}
          onChange={(statusKey) => setFilters({ statusKey: statusKey || undefined })}
          placeholder="All Statuses"
          loading={statusesLoading}
          className="hs-input--filter"
        />
      </FilterBar>

      <Card>
        <CardBody>
          <DataTable
            columns={columns}
            data={demands}
            loading={loading}
            onRowClick={(r) => navigate(`/maintenance/demands/${r.demandId}`)}
            getRowId={(r) => r.demandId}
            emptyTitle="No demands found"
            emptyDescription="Adjust the filters, or generate demands for a billing period."
            emptyAction={
              <PermissionGate permission="maintenance.generate">
                <Button
                  icon={<Icon name="plus" size={16} />}
                  onClick={() => navigate('/maintenance/demands/generate')}
                >
                  Generate Demands
                </Button>
              </PermissionGate>
            }
          />
          {!loading && demands.length > 0 && <Pagination page={page} onPageChange={setPage} />}
        </CardBody>
      </Card>

      {/* Allocation breakdown of a demand is shown on its detail page, not in this list. */}
      <p
        style={{
          marginTop: 'var(--space-3)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-muted)',
        }}
      >
        Amounts are computed by the server from the stored ledger. The UI formats them only
        (SRS §23).
      </p>
    </div>
  );
}
