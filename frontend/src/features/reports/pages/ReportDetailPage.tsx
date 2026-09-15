/* ReportDetailPage.tsx — FE-12
 * design.md §6 list-page pattern: PageHeader → FilterBar → DataTable → Pagination.
 *
 * SRS §14: run a standard report and export it.
 *
 * This page is deliberately GENERIC. The report's title, the filters it accepts
 * and the columns it returns all come from `reports.catalog` (`ReportService.gs:316`),
 * and the rows come from `reports.run` (`ReportService.gs:334`). The only
 * per-report knowledge here is which INPUT TYPE each filter key needs, since the
 * backend serves filter keys as bare strings with no type metadata.
 *
 * Contract notes (verified against ReportService.gs):
 * - `run` projects ONLY the columns declared in the catalog entry, as STRINGS.
 *   A column is therefore never missing, but it is always a string — money is
 *   parsed for display and never re-totalled client-side.
 * - `totals` is computed server-side over ALL filtered rows, NOT the page
 *   (`computeTotals` receives the unpaginated rows, `ReportService.gs:388`).
 *   Recomputing from `rows` here would silently show page-only sums, so the
 *   server's figures are rendered as-is.
 * - `complaint-summary` and `visitor-log` return `totals = {}` — no numeric
 *   totals exist for them, so the totals strip is omitted rather than showing
 *   zeros.
 * - Export writes a CSV to Drive and returns `fileUrl`; the browser is sent
 *   there. No bytes flow through this app. */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Alert } from '@/components/ui/Alert';
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
import { labelFromKey, isMoneyColumn, isStatusColumn, isDateColumn, hasNoTotals, describeTotals } from '@/services/reportService';
import type { ReportFilters } from '@/services/reportService';
import { useReportCatalog, useReport } from '../hooks/useReports';
import { useEntityOptions, useEnumList } from '@/lib/useConfigOptions';
import { formatMoney } from '@/lib/money';
import type { ReportRow } from '@/types/domain';

type FilterKind = 'date' | 'flat' | 'period' | 'paymentMode' | 'category' | 'text';

/** Which input to render per filter key.
 *
 * The backend declares filters as bare keys, so the mapping lives here. Unknown
 * keys fall back to a free-text input rather than being dropped, so a filter
 * added server-side is still usable without a code change. */
const FILTER_KINDS: Record<string, FilterKind> = {
  from: 'date',
  to: 'date',
  flatId: 'flat',
  periodKey: 'period',
  paymentModeKey: 'paymentMode',
  categoryId: 'category',
  financialYear: 'text',
};

export default function ReportDetailPage() {
  const { reportKey = '' } = useParams();
  const navigate = useNavigate();
  const { catalog, loading: catalogLoading, error: catalogError } = useReportCatalog();

  const definition = catalog[reportKey];
  const known = Boolean(definition);

  /* Draft filters are what the user is editing; applied filters are what the
   * report actually ran with, so typing does not fire a request per keystroke. */
  const [draft, setDraft] = useState<ReportFilters>({});
  const [applied, setApplied] = useState<ReportFilters>({});

  useEffect(() => {
    setDraft({});
    setApplied({});
  }, [reportKey]);

  const { result, page, loading, error, exporting, exportError, setPage, setFilters, reload, exportCsv } =
    useReport({ reportKey, filters: applied });

  /* Column definitions are derived from the catalog declaration, with a per-key
   * renderer chosen by naming convention. This is why no per-report column table
   * is needed: `amount` columns right-align as money, `statusKey` columns become
   * a StatusBadge, `*Date`/`*At` columns are printed as-is. */
  const columns = useMemo<Column<ReportRow>[]>(() => {
    if (!definition) return [];
    return definition.columns.map((key) => ({
      key,
      header: labelFromKey(key),
      align: isMoneyColumn(key) ? 'right' : 'left',
      render: (row: ReportRow) => renderCell(key, row[key] ?? ''),
    }));
  }, [definition]);

  const onApply = () => {
    const cleaned: ReportFilters = {};
    Object.keys(draft).forEach((key) => {
      const value = draft[key];
      if (value !== undefined && String(value).trim() !== '') cleaned[key] = value;
    });
    setFilters(cleaned);
    setApplied(cleaned);
  };

  const onClear = () => {
    setDraft({});
    setApplied({});
    setFilters({});
  };

  if (catalogLoading) {
    return (
      <div>
        <PageHeader title="Report" />
        <Card>
          <CardBody>
            <Skeleton height={20} width="35%" />
            <div style={{ height: 'var(--space-4)' }} />
            <Skeleton height={14} width="100%" />
            <div style={{ height: 'var(--space-2)' }} />
            <Skeleton height={14} width="90%" />
          </CardBody>
        </Card>
      </div>
    );
  }

  if (catalogError && !known) {
    return (
      <div>
        <PageHeader title="Report" />
        <ErrorState message={catalogError} onRetry={reload} />
      </div>
    );
  }

  /* A deep link to a report the catalog does not define. `reports.run` would
   * answer NOT_FOUND, so fail with a clear message and a way back instead. */
  if (!definition) {
    return (
      <div>
        <PageHeader
          title="Unknown report"
          breadcrumbs={<Breadcrumb items={[{ label: 'Reports', onClick: () => navigate('/reports') }]} />}
        />
        <EmptyState
          title="That report does not exist"
          description={`No report is defined for "${reportKey}". It may have been removed from the catalog.`}
          icon={<Icon name="reports" size={32} />}
          action={
            <Button variant="primary" onClick={() => navigate('/reports')}>
              Back to reports
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={definition.title}
        subtitle={`Report · ${definition.columns.length} columns · ${definition.filters.length} filters`}
        breadcrumbs={<Breadcrumb items={[{ label: 'Reports', onClick: () => navigate('/reports') }]} />}
        actions={
          <>
            <Button variant="secondary" onClick={reload} disabled={loading}>
              <Icon name="refresh" size={16} />
              Refresh
            </Button>
            <PermissionGate permission="reports.export">
              <Button variant="primary" onClick={exportCsv} loading={exporting} disabled={loading}>
                <Icon name="download" size={16} />
                Export CSV
              </Button>
            </PermissionGate>
          </>
        }
      />

      {exportError && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Alert variant="warning">{exportError}</Alert>
        </div>
      )}

      {definition.filters.length > 0 && (
        <FilterBar>
          {definition.filters.map((key) => (
            <ReportFilterInput
              key={key}
              filterKey={key}
              value={draft[key] ?? ''}
              onChange={(value) => setDraft((d) => ({ ...d, [key]: value }))}
            />
          ))}
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
            <Button variant="primary" onClick={onApply} disabled={loading}>
              Apply
            </Button>
            <Button variant="ghost" onClick={onClear} disabled={loading}>
              Clear
            </Button>
          </div>
        </FilterBar>
      )}

      {/* Totals come from the server and cover every filtered row, not the page.
          Reports whose family defines no numeric totals are shown without a
          strip rather than with misleading zeros. */}
      {result && !hasNoTotals(result.totals) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-4)',
          }}
        >
          {describeTotals(result.totals).map((item) => (
            <Card key={item.label} style={{ flex: '1 1 10rem' }}>
              <CardBody>
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    marginTop: 'var(--space-1)',
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--weight-semibold)',
                    color: 'var(--color-text)',
                  }}
                >
                  {item.money ? formatMoney(item.value) : item.value}
                </div>
              </CardBody>
            </Card>
          ))}
          <Card style={{ flex: '1 1 10rem' }}>
            <CardBody>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Scope
              </div>
              <div style={{ marginTop: 'var(--space-1)' }}>
                <Badge variant="neutral">All filtered rows</Badge>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}

      {!error && (
        <>
          <div className="hs-only-desktop">
            <DataTable
              columns={columns}
              data={result?.rows ?? []}
              loading={loading}
              emptyTitle="No data for this report"
              emptyDescription="Adjust or clear the filters, then apply again."
            />
          </div>
          <div className="hs-only-mobile">
            <DataListMobile
              data={result?.rows ?? []}
              loading={loading}
              emptyTitle="No data for this report"
              render={(row) => <MobileRow row={row} columns={definition.columns} />}
            />
          </div>

          {page && (
            <PaginationBar
              page={page}
              onPageChange={setPage}
              left={
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                  {page.total} row{page.total === 1 ? '' : 's'}
                </span>
              }
            />
          )}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Cell rendering
 * ------------------------------------------------------------------------- */

/** Render one projected cell.
 *
 * The backend sends every value as a string (or `''`). Money columns are parsed
 * and formatted; status columns become a badge; everything else is printed. A
 * blank money cell shows nothing rather than "₹0", since `''` means "no value
 * on this row", not zero. */
function renderCell(key: string, raw: string) {
  if (raw === '') return <span style={{ color: 'var(--color-text-subtle)' }}>—</span>;

  if (isMoneyColumn(key)) {
    const parsed = Number(String(raw).replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(parsed)) return <span>{raw}</span>;
    return <AmountText amount={parsed} />;
  }

  if (isStatusColumn(key)) {
    return <StatusBadge statusKey={raw} />;
  }

  if (isDateColumn(key)) {
    return <span>{raw}</span>;
  }

  return <span>{raw}</span>;
}

function MobileRow({ row, columns }: { row: ReportRow; columns: string[] }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
      {columns.map((key) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            {labelFromKey(key)}
          </span>
          <span style={{ textAlign: 'right', fontSize: 'var(--text-sm)' }}>
            {renderCell(key, row[key] ?? '')}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Filter inputs
 * ------------------------------------------------------------------------- */

function ReportFilterInput({
  filterKey,
  value,
  onChange,
}: {
  filterKey: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const kind = FILTER_KINDS[filterKey] ?? 'text';
  const label = labelFromKey(filterKey);

  /* Hooks must run unconditionally, so all lookups are always created and only
   * the relevant one is rendered. These are config-driven (SRS §15) — no period,
   * mode or category list is hardcoded. */
  const flatOptions = useEntityOptions('flats', ['flatId'], ['flatNumber']);
  const paymentModes = useEnumList('paymentModes');
  const categories = useEnumList('categories', 'expense');
  const periods = usePeriodOptions();

  if (kind === 'date') {
    return (
      <div style={{ minWidth: '10rem' }}>
        <label
          htmlFor={`filter-${filterKey}`}
          style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-sm)' }}
        >
          {label}
        </label>
        <Input
          id={`filter-${filterKey}`}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (kind === 'flat') {
    return (
      <div style={{ minWidth: '12rem' }}>
        <Select
          aria-label={label}
          value={value}
          options={[{ value: '', label: 'All flats' }, ...flatOptions.options]}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (kind === 'paymentMode') {
    return (
      <div style={{ minWidth: '12rem' }}>
        <Select
          aria-label={label}
          value={value}
          options={[{ value: '', label: 'All modes' }, ...paymentModes.options]}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (kind === 'category') {
    return (
      <div style={{ minWidth: '12rem' }}>
        <Select
          aria-label={label}
          value={value}
          options={[{ value: '', label: 'All categories' }, ...categories.options]}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (kind === 'period') {
    return (
      <div style={{ minWidth: '11rem' }}>
        <Select
          aria-label={label}
          value={value}
          options={[{ value: '', label: 'All periods' }, ...periods]}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div style={{ minWidth: '10rem' }}>
      <label
        htmlFor={`filter-${filterKey}`}
        style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-sm)' }}
      >
        {label}
      </label>
      <Input
        id={`filter-${filterKey}`}
        value={value}
        placeholder={`Filter by ${label.toLowerCase()}`}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** `YYYY-MM` period options for a `periodKey` filter.
 *
 * Built from the clock in descending order — the same approach FE-11 uses for
 * its expense summary, since there is no period-list endpoint that is safe to
 * call from every role. */
function usePeriodOptions(monthsBack = 12): { value: string; label: string }[] {
  return useMemo(() => {
    const out: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < monthsBack; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const value = `${d.getFullYear()}-${month}`;
      const label = d.toLocaleString(undefined, { month: 'short', year: 'numeric' });
      out.push({ value, label });
    }
    return out;
  }, [monthsBack]);
}
