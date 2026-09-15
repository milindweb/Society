/* PaymentListPage.tsx — FE-06
 * Payment history with flat / date-range / mode filters. Amounts are server-computed
 * and formatted here only (SRS §23). Payment modes come from config, never a literal list. */

import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable, type Column } from '@/components/data/DataTable';
import { AmountText } from '@/components/data/AmountText';
import { FilterBar } from '@/components/data/FilterBar';
import { LookupSelect } from '@/components/data/LookupSelect';
import { Pagination } from '@/components/ui/Pagination';
import { Alert } from '@/components/ui/Alert';
import { ErrorState } from '@/components/ui/ErrorState';
import { PermissionGate } from '@/app/PermissionGate';
import { usePaymentList } from '../hooks/usePayments';
import { useEnumOptions } from '@/features/flats/hooks/useLookups';
import { useFlatOptions } from '@/features/members/hooks/useFlatOptions';
import { formatDate } from '@/lib/dates';
import { formatEnumKey } from '@/lib/format';
import { ExportButton } from '@/components/ui/ExportButton';
import type { Payment } from '@/types/domain';

export default function PaymentListPage() {
  const navigate = useNavigate();
  const { options: modeOptions, loading: modesLoading } = useEnumOptions('PAYMENT_MODE');
  const { options: flatOptions, loading: flatsLoading, searchFlats } = useFlatOptions();
  const { payments, page, loading, error, filters, setFilters, setPage, reload } = usePaymentList();

  const columns: Column<Payment>[] = [
    {
      key: 'receiptNumber',
      header: 'Receipt',
      render: (r) => (
        <span className="hs-mono" style={{ fontWeight: 'var(--weight-medium)' }}>
          {r.receiptNumber}
        </span>
      ),
    },
    { key: 'paymentDate', header: 'Date', render: (r) => formatDate(r.paymentDate) },
    {
      key: 'flatNumber',
      header: 'Flat',
      render: (r) => r.flatNumber ?? r.flatId,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (r) => <AmountText amount={r.amount} />,
    },
    {
      key: 'paymentModeKey',
      header: 'Mode',
      render: (r) => formatEnumKey(r.paymentModeKey),
    },
    { key: 'referenceNumber', header: 'Reference', render: (r) => r.referenceNumber || '—' },
    { key: 'statusKey', header: 'Status', render: (r) => <StatusBadge statusKey={r.statusKey} /> },
  ];

  if (error && payments.length === 0) {
    return (
      <div>
        <PageHeader title="Payments" />
        <ErrorState message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Recorded payments and their receipts"
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <ExportButton columns={columns} data={payments} filename="payments-list" />
            <Button
              variant="secondary"
              icon={<Icon name="refresh" size={16} />}
              onClick={() => void reload()}
            >
              Refresh
            </Button>
            <PermissionGate permission="payments.write">
              <Button
                icon={<Icon name="plus" size={16} />}
                onClick={() => navigate('/payments/new')}
              >
                Record Payment
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {error && payments.length > 0 && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      <FilterBar>
        <LookupSelect
          options={flatOptions}
          value={filters.flatId ?? ''}
          onChange={(flatId) => setFilters({ flatId: flatId || undefined })}
          placeholder="All Flats"
          loading={flatsLoading}
          onSearch={searchFlats}
          searchPlaceholder="Search flats..."
        />
        <LookupSelect
          options={modeOptions}
          value={filters.modeKey ?? ''}
          onChange={(modeKey) => setFilters({ modeKey: modeKey || undefined })}
          placeholder="All Modes"
          loading={modesLoading}
          className="hs-input--filter"
        />
        <Input
          type="date"
          value={filters.from ?? ''}
          onChange={(e) => setFilters({ from: e.target.value || undefined })}
          aria-label="From date"
          style={{ maxWidth: '10rem' }}
        />
        <Input
          type="date"
          value={filters.to ?? ''}
          onChange={(e) => setFilters({ to: e.target.value || undefined })}
          aria-label="To date"
          style={{ maxWidth: '10rem' }}
        />
      </FilterBar>

      <Card>
        <CardBody>
          <DataTable
            columns={columns}
            data={payments}
            loading={loading}
            onRowClick={(r) => navigate(`/payments/${r.paymentId}`)}
            getRowId={(r) => r.paymentId}
            emptyTitle="No payments found"
            emptyDescription="Adjust the filters, or record a new payment."
            emptyAction={
              <PermissionGate permission="payments.write">
                <Button
                  icon={<Icon name="plus" size={16} />}
                  onClick={() => navigate('/payments/new')}
                >
                  Record Payment
                </Button>
              </PermissionGate>
            }
          />
          {!loading && payments.length > 0 && <Pagination page={page} onPageChange={setPage} />}
        </CardBody>
      </Card>
    </div>
  );
}
