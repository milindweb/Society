/* ExpenseSummaryPage.tsx — FE-11
 * SRS §13: "expense history" — monthly, category-wise and vendor-wise totals.
 * The plan (FE-11-Expenses.md) calls this out by name and asks for charts.
 *
 * Every figure on this page comes from ONE server call, `expenses.summary`
 * (`ExpenseService.gs:216-261`). The client does no aggregation at all: it renders
 * the three keyed maps the server returns. That is the whole point — the totals
 * must agree with what a report would show, and the only way to guarantee that is
 * to have exactly one implementation of the arithmetic.
 *
 * Two properties of the payload shape the UI:
 *  1. The service counts **POSTED rows only** (`ExpenseService.gs:218`), so there is
 *     no way to show cancelled totals here. The page says so rather than leaving
 *     the reader to wonder why a cancelled expense is missing.
 *  2. It inserts synthetic keys for rows without an id: `'UNCATEGORIZED'` and
 *     `'DIRECT'` (`ExpenseService.gs:236-240`). Those are mapped to readable
 *     labels and given an explicit colour; showing them raw would look like a bug.
 *
 * `periodKey` is supported by `summary` but NOT by `list`, so the month selector
 * here is the only month-scoped view in the module.
 *
 * Charts are the existing SVG components (design.md §80) — no chart library. The
 * palette is the theme's chart tokens so light/dark both work. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { KpiCard } from '@/components/data/KpiCard';
import { BarChart } from '@/components/data/BarChart';
import { DonutChart } from '@/components/data/DonutChart';
import { AmountText } from '@/components/data/AmountText';
import { useExpenseSummary } from '../hooks/useExpenses';
import {
  useExpenseCategoryOptions,
  useExpensePeriodOptions,
  useExpenseVendorOptions,
} from '../hooks/useExpenseLookups';
import { DIRECT_VENDOR_KEY, UNCATEGORIZED_KEY } from '@/services/expenseService';
import { formatMoney } from '@/lib/money';

/** Chart colours, in a fixed order so a label keeps its colour as filters change.
 * These are the shared chart tokens, not literals, so light and dark both resolve. */
const CHART_COLORS = [
  'var(--color-chart-1, var(--color-brand))',
  'var(--color-chart-2, var(--color-info))',
  'var(--color-chart-3, var(--color-success))',
  'var(--color-chart-4, var(--color-warning))',
  'var(--color-chart-5, var(--color-danger))',
];

/** The palette entry for a position, wrapping. Wrapping through a function keeps
 * `noUncheckedIndexedAccess` satisfied without a non-null assertion at each call
 * site — an index into a `string[]` is `string | undefined` under this project's
 * compiler settings. */
function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] ?? 'var(--color-brand)';
}

export default function ExpenseSummaryPage() {
  const navigate = useNavigate();

  const periods = useExpensePeriodOptions(12);
  const categories = useExpenseCategoryOptions();
  const vendors = useExpenseVendorOptions();

  /* '' means "all time" — a legitimate choice, and the default, because a society
   * usually wants the running position rather than one month. */
  const [periodKey, setPeriodKey] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [vendorId, setVendorId] = useState('');

  const { summary, loading, error, reload } = useExpenseSummary({
    periodKey: periodKey || undefined,
    categoryId: categoryId || undefined,
    vendorId: vendorId || undefined,
  });

  const categoryLabel = (key: string) =>
    key === UNCATEGORIZED_KEY
      ? 'Uncategorised'
      : categories.options.find((option) => option.value === key)?.label || key;

  const vendorLabel = (key: string) =>
    key === DIRECT_VENDOR_KEY
      ? 'Paid directly'
      : vendors.options.find((option) => option.value === key)?.label || key;

  /* The maps arrive as plain objects of key → amount. Sorting by amount descending
   * puts the biggest cost first, which is the only ordering that answers the
   * question anyone asks of this page. */
  const ranked = (map: Record<string, number>, label: (key: string) => string) =>
    Object.entries(map)
      .map(([key, value]) => ({ key, label: label(key), value: Number(value) || 0 }))
      .sort((a, b) => b.value - a.value);

  const byCategory = summary ? ranked(summary.byCategory, categoryLabel) : [];
  const byVendor = summary ? ranked(summary.byVendor, vendorLabel) : [];

  /* Months are chronological, unlike the other two — a trend read out of order is
   * not a trend. */
  const byMonth = summary
    ? Object.entries(summary.byMonth)
        .map(([key, value]) => ({ key, label: key, value: Number(value) || 0 }))
        .sort((a, b) => a.key.localeCompare(b.key))
    : [];

  const filtered = Boolean(periodKey || categoryId || vendorId);

  const body = (() => {
    if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
    if (loading) return <Skeleton height={320} variant="rect" />;
    if (!summary || summary.total === 0) {
      return (
        <EmptyState
          title="Nothing to summarise"
          description={
            filtered
              ? 'No posted expense matches the current filters.'
              : 'No posted expense has been recorded yet.'
          }
        />
      );
    }

    return (
      <>
        <div
          className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
          style={{ gap: 'var(--space-4)' }}
        >
          {/* Category split */}
          <Card>
            <CardHeader title="By category" />
            <CardBody>
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--space-5)',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <DonutChart
                  segments={byCategory.map((row, index) => ({
                    label: row.label,
                    value: row.value,
                    color: chartColor(index),
                  }))}
                  size={140}
                />
                <div style={{ flex: 1, minWidth: 200 }}>
                  {byCategory.map((row, index) => (
                    <div
                      key={row.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-1) 0',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          flexShrink: 0,
                          background: chartColor(index),
                        }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>{row.label}</span>
                      <AmountText amount={row.value} />
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Vendor split */}
          <Card>
            <CardHeader title="By vendor" />
            <CardBody>
              <BarChart
                data={byVendor.slice(0, 8).map((row, index) => ({
                  label: truncate(row.label, 8),
                  value: row.value,
                  color: chartColor(index),
                }))}
                height={140}
              />
              <div style={{ marginTop: 'var(--space-4)' }}>
                {byVendor.slice(0, 6).map((row) => (
                  <div
                    key={row.key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-1) 0',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    <span style={{ minWidth: 0 }}>{row.label}</span>
                    <AmountText amount={row.value} />
                  </div>
                ))}
                {byVendor.length > 6 ? (
                  <p
                    style={{
                      margin: 'var(--space-2) 0 0',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    Showing the 6 largest of {byVendor.length} payees. The chart shows the top 8.
                  </p>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Monthly trend */}
        <Card style={{ marginTop: 'var(--space-4)' }}>
          <CardHeader title="By month" />
          <CardBody>
            <BarChart
              data={byMonth.map((row) => ({ label: shortMonth(row.label), value: row.value }))}
              height={160}
            />
            <p
              style={{
                marginTop: 'var(--space-3)',
                marginBottom: 0,
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-muted)',
              }}
            >
              Months in order. The bar height is the posted spend for that month.
            </p>
          </CardBody>
        </Card>
      </>
    );
  })();

  return (
    <div>
      <PageHeader
        title="Expense summary"
        subtitle="Where the society's money went — by category, payee and month"
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Expenses', onClick: () => navigate('/expenses') },
              { label: 'Summary' },
            ]}
          />
        }
        actions={
          <Button
            variant="secondary"
            icon={<Icon name="expenses" size={16} />}
            onClick={() => navigate('/expenses')}
          >
            Expense list
          </Button>
        }
      />

      {summary ? (
        <div
          className="hs-grid hs-grid-cols-2 hs-lg-grid-cols-3"
          style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}
        >
          <KpiCard
            label="Total posted"
            value={formatMoney(summary.totalAmount, { compact: true })}
          />
          <KpiCard label="Expenses counted" value={summary.total} />
          <KpiCard label="Months covered" value={byMonth.length} />
        </div>
      ) : null}

      <Card>
        <CardBody>
          <div
            className="hs-toolbar"
            style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}
          >
            <Select
              aria-label="Filter by period"
              value={periodKey}
              options={[{ value: '', label: 'All time' }, ...periods.options]}
              onChange={(e) => setPeriodKey(e.target.value)}
            />
            <Select
              aria-label="Filter by category"
              value={categoryId}
              options={[{ value: '', label: 'All categories' }, ...categories.options]}
              onChange={(e) => setCategoryId(e.target.value)}
            />
            <Select
              aria-label="Filter by vendor"
              value={vendorId}
              options={[{ value: '', label: 'All vendors' }, ...vendors.options]}
              onChange={(e) => setVendorId(e.target.value)}
            />
            <Button variant="ghost" onClick={() => void reload()} disabled={loading}>
              Refresh
            </Button>
          </div>

          <p
            style={{
              marginTop: 'var(--space-3)',
              marginBottom: 0,
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
            }}
          >
            Cancelled expenses are excluded everywhere on this page — the totals count posted records
            only. All figures are calculated by the server from the same source the reports use, so
            they cannot drift from a report.
          </p>
        </CardBody>
      </Card>

      <div style={{ marginTop: 'var(--space-4)' }}>{body}</div>

      {summary && summary.total > 0 && Object.keys(summary.byCategory).includes(UNCATEGORIZED_KEY) ? (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Alert variant="info">
            Some expenses carry no category. The server groups them under “Uncategorised”, which is
            shown above with the others rather than hidden.
          </Alert>
        </div>
      ) : null}
    </div>
  );
}

/** Shorten a label for a chart axis, where space is fixed. The full label is
 * always available in the list beneath the chart. */
function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** `2026-09` → `Sep 26`, for a month axis. */
function shortMonth(periodKey: string): string {
  const [year, month] = periodKey.split('-');
  if (!year || !month) return periodKey;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}
