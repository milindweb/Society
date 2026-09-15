/* ExpenseListPage.tsx — FE-11
 * design.md §6 list-page pattern: PageHeader → FilterBar → DataTable → Pagination.
 * frontend-architecture.md §1: no fetching in pages — useExpenseList owns it.
 *
 * SRS §13: society expenses — what was spent, on what, with whom, and how.
 *
 * Contract notes (verified against ExpenseService.gs:77-101):
 * - `expenses.list` filters on categoryId / vendorId / statusKey, and applies
 *   `from` / `to` against `expenseDate` in memory. There is **NO search**, so no
 *   search box is offered (the same decision as FE-07 visitors, FE-09 documents
 *   and FE-10 employees).
 * - It returns **raw rows with no join** — there is no `categoryName` or
 *   `vendorName` on the row, so both labels are resolved here from the config
 *   lookups. Those columns are therefore defensive.
 * - `amount` is a **STRING** on the sheet, parsed for display only.
 *
 * The KPI strip is driven by `expenses.summary`, NOT by summing the loaded page.
 * The two disagree by design: the summary counts every POSTED expense matching the
 * filter (ignoring pagination AND ignoring cancelled rows), while the table shows
 * one page of ALL statuses. Summing the table would give a number that is both
 * page-limited and inflated by cancellations. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Alert } from '@/components/ui/Alert';
import { PermissionGate } from '@/app/PermissionGate';
import { DataTable, type Column } from '@/components/data/DataTable';
import { DataListMobile } from '@/components/data/DataListMobile';
import { FilterBar } from '@/components/data/FilterBar';
import { PaginationBar } from '@/components/data/PaginationBar';
import { KpiCard } from '@/components/data/KpiCard';
import { AmountText } from '@/components/data/AmountText';
import { RecordExpenseModal } from '../components/RecordExpenseModal';
import { useExpenseList, useExpenseSummary } from '../hooks/useExpenses';
import {
  useExpenseCategoryOptions,
  useExpensePaymentModeOptions,
  useExpenseStatusOptions,
  useExpenseVendorOptions,
} from '../hooks/useExpenseLookups';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import type { Expense } from '@/types/domain';

export default function ExpenseListPage() {
  const navigate = useNavigate();

  const [categoryId, setCategoryId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [statusKey, setStatusKey] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [recording, setRecording] = useState(false);

  const categories = useExpenseCategoryOptions();
  const vendors = useExpenseVendorOptions();
  const statuses = useExpenseStatusOptions();
  const paymentModes = useExpensePaymentModeOptions();

  /* The summary deliberately does NOT receive `statusKey`: it counts POSTED only,
   * by construction (`ExpenseService.gs:218`), so passing a status filter would
   * imply it could show cancelled totals — it cannot. */
  const summary = useExpenseSummary({
    categoryId: categoryId || undefined,
    vendorId: vendorId || undefined,
    from: from || undefined,
    to: to || undefined,
  });

  const { expenses, page, loading, error, setFilters, setPage, reload } = useExpenseList({
    categoryId: categoryId || undefined,
    vendorId: vendorId || undefined,
    statusKey: statusKey || undefined,
    from: from || undefined,
    to: to || undefined,
  });

  const categoryLabel = (row: Expense) =>
    categories.options.find((option) => option.value === row.categoryId)?.label ||
    row.categoryId ||
    'Uncategorised';

  const vendorLabel = (row: Expense) =>
    row.payeeName ||
    vendors.options.find((option) => option.value === row.vendorId)?.label ||
    row.vendorId ||
    'Direct';

  const paymentLabel = (row: Expense) =>
    paymentModes.options.find((option) => option.value === row.paymentModeKey)?.label ||
    row.paymentModeKey ||
    '—';

  const columns: Column<Expense>[] = [
    {
      key: 'expenseNumber',
      header: 'Expense',
      render: (row) => (
        <div>
          <div>{row.expenseNumber}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {row.expenseDate ? formatDate(row.expenseDate) : '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'categoryId',
      header: 'Category',
      render: (row) => categoryLabel(row),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => row.description || '—',
    },
    {
      key: 'vendorId',
      header: 'Paid to',
      render: (row) => (
        <div>
          <div>{vendorLabel(row)}</div>
          {row.paymentModeKey ? (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {paymentLabel(row)}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (row) => <AmountText amount={Number(row.amount) || 0} />,
    },
    {
      key: 'statusKey',
      header: 'Status',
      render: (row) => <StatusBadge statusKey={row.statusKey} />,
    },
  ];

  const renderMobile = (row: Expense) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <strong>{vendorLabel(row)}</strong>
        <StatusBadge statusKey={row.statusKey} />
      </div>
      <div
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          marginTop: 'var(--space-1)',
        }}
      >
        {categoryLabel(row)} · {row.expenseDate ? formatDate(row.expenseDate) : '—'}
      </div>
      {row.description ? (
        <div style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
          {row.description}
        </div>
      ) : null}
      <div style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-1)' }}>
        <AmountText amount={Number(row.amount) || 0} />
        {row.expenseNumber ? (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {' '}
            · {row.expenseNumber}
          </span>
        ) : null}
      </div>
    </div>
  );

  const body = (() => {
    if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
    if (loading) return <Skeleton height={240} variant="rect" />;
    if (expenses.length === 0) {
      return (
        <EmptyState
          title="No expenses found"
          description={
            categoryId || vendorId || statusKey || from || to
              ? 'No expense matches the current filters.'
              : 'No expense has been recorded yet.'
          }
        />
      );
    }
    return (
      <>
        <div className="hs-only-desktop">
          <DataTable
            columns={columns}
            data={expenses}
            getRowId={(row) => row.expenseId}
            onRowClick={(row) => navigate(`/expenses/${row.expenseId}`)}
            emptyTitle="No expenses found"
          />
        </div>
        <div className="hs-only-mobile">
          <DataListMobile
            data={expenses}
            render={renderMobile}
            onRowClick={(row) => navigate(`/expenses/${row.expenseId}`)}
            emptyTitle="No expenses found"
          />
        </div>
        <PaginationBar page={page} onPageChange={setPage} />
      </>
    );
  })();

  /* After a write, refresh BOTH: a new expense changes the POSTED totals and may
   * belong on the current page of the list. */
  const afterWrite = async () => {
    await Promise.all([reload(), summary.reload()]);
  };

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="What the society spent — recorded against a category and a payment mode"
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              icon={<Icon name="reports" size={16} />}
              onClick={() => navigate('/expenses/summary')}
            >
              Summary
            </Button>
            <PermissionGate permission="expenses.write">
              <Button icon={<Icon name="plus" size={16} />} onClick={() => setRecording(true)}>
                Record expense
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {/* Server-computed POSTED totals. `total` is a COUNT and `totalAmount` is the
       * money — they are different quantities and are labelled as such. */}
      {summary.summary ? (
        <div
          className="hs-grid hs-grid-cols-2 hs-lg-grid-cols-3"
          style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}
        >
          <KpiCard
            label="Total spent (posted)"
            value={formatMoney(summary.summary.totalAmount, { compact: true })}
          />
          <KpiCard label="Expenses counted" value={summary.summary.total} />
          <KpiCard label="Categories used" value={Object.keys(summary.summary.byCategory).length} />
        </div>
      ) : null}

      <Card>
        <CardBody>
          <FilterBar>
            <Select
              aria-label="Filter by category"
              value={categoryId}
              options={[{ value: '', label: 'All categories' }, ...categories.options]}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setFilters({ categoryId: e.target.value || undefined });
              }}
            />
            <Select
              aria-label="Filter by vendor"
              value={vendorId}
              options={[{ value: '', label: 'All vendors' }, ...vendors.options]}
              onChange={(e) => {
                setVendorId(e.target.value);
                setFilters({ vendorId: e.target.value || undefined });
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
            <Input
              type="date"
              aria-label="From date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setFilters({ from: e.target.value || undefined });
              }}
            />
            <Input
              type="date"
              aria-label="To date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setFilters({ to: e.target.value || undefined });
              }}
            />
            <Button variant="ghost" onClick={() => void afterWrite()} disabled={loading}>
              Refresh
            </Button>
          </FilterBar>

          <p
            style={{
              marginTop: 'var(--space-3)',
              marginBottom: 0,
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
            }}
          >
            The server filters by category, vendor and status; the date range narrows on the expense
            date. The totals above count posted expenses only, so a cancelled expense is excluded from
            every figure there while still appearing in the table below.
          </p>
        </CardBody>
      </Card>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardBody>{body}</CardBody>
      </Card>

      {summary.error ? (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Alert variant="warning">
            The totals could not be loaded: {summary.error}
          </Alert>
        </div>
      ) : null}

      <RecordExpenseModal
        open={recording}
        onClose={() => setRecording(false)}
        onCreated={(created) => {
          setRecording(false);
          void afterWrite();
          /* Land on the new record: the server generates the expense number and
           * coerces the amount, so the user should see the persisted values. */
          navigate(`/expenses/${created.expenseId}`);
        }}
      />
    </div>
  );
}
