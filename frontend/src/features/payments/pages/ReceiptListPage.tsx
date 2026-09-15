/* ReceiptListPage.tsx — FE-06
 * Receipts are 1:1 with payments and are immutable on the server. This list lets a user
 * find one by flat or period and open it for printing. */

import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable, type Column } from '@/components/data/DataTable';
import { AmountText } from '@/components/data/AmountText';
import { FilterBar } from '@/components/data/FilterBar';
import { LookupSelect } from '@/components/data/LookupSelect';
import { Pagination } from '@/components/ui/Pagination';
import { ErrorState } from '@/components/ui/ErrorState';
import { useReceiptList } from '../hooks/useReceipts';
import { useFlatOptions } from '@/features/members/hooks/useFlatOptions';
import { usePeriods } from '@/features/maintenance/hooks/usePeriods';
import { formatDate } from '@/lib/dates';
import { ExportButton } from '@/components/ui/ExportButton';
import type { Receipt } from '@/types/domain';

export default function ReceiptListPage() {
  const navigate = useNavigate();
  const { options: flatOptions, loading: flatsLoading, searchFlats } = useFlatOptions();
  const { periods } = usePeriods();
  const { receipts, page, loading, error, filters, setFilters, setPage, reload } = useReceiptList();

  const periodOptions = periods.map((p) => ({ value: p.periodKey, label: p.periodKey }));

  const columns: Column<Receipt>[] = [
    {
      key: 'receiptNumber',
      header: 'Receipt No',
      render: (r) => (
        <span className="hs-mono" style={{ fontWeight: 'var(--weight-medium)' }}>
          {r.receiptNumber}
        </span>
      ),
    },
    { key: 'paymentDate', header: 'Date', render: (r) => formatDate(r.paymentDate) },
    { key: 'flatNumber', header: 'Flat', render: (r) => r.flatNumber ?? r.flatId },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (r) => <AmountText amount={r.amount} />,
    },
    {
      key: 'printCount',
      header: 'Prints',
      align: 'right',
      render: (r) => (
        <Badge variant={r.printCount > 0 ? 'warning' : 'neutral'}>{String(r.printCount ?? 0)}</Badge>
      ),
    },
    { key: 'statusKey', header: 'Status', render: (r) => <StatusBadge statusKey={r.statusKey} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <Button
          variant="ghost"
          size="sm"
          icon={<Icon name="eye" size={14} />}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/receipts/${r.receiptId}`);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  if (error && receipts.length === 0) {
    return (
      <div>
        <PageHeader title="Receipts" />
        <ErrorState message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Receipts"
        subtitle="Receipts issued for recorded payments"
        actions={
          <>
            <ExportButton columns={columns} data={receipts} filename="receipts-list" />
            <Button
              variant="secondary"
              icon={<Icon name="refresh" size={16} />}
              onClick={() => void reload()}
            >
              Refresh
            </Button>
          </>
        }
      />

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
          options={periodOptions}
          value={filters.periodKey ?? ''}
          onChange={(periodKey) => setFilters({ periodKey: periodKey || undefined })}
          placeholder="All Periods"
          className="hs-input--filter"
        />
      </FilterBar>

      <Card>
        <CardBody>
          <DataTable
            columns={columns}
            data={receipts}
            loading={loading}
            onRowClick={(r) => navigate(`/receipts/${r.receiptId}`)}
            getRowId={(r) => r.receiptId}
            emptyTitle="No receipts found"
            emptyDescription="Receipts appear here once a payment has been recorded."
          />
          {!loading && receipts.length > 0 && <Pagination page={page} onPageChange={setPage} />}
        </CardBody>
      </Card>
    </div>
  );
}
