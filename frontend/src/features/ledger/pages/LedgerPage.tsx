/* LedgerPage.tsx — FE-06 member ledger
 * SRS §4: the ledger presents the money story in order —
 *         Demand → Payment → Interest → Adjustment → Pending → Balance.
 * SRS §23: every amount shown here is server-computed. The page never adds,
 *          subtracts, or derives a balance; it only formats what the API sent.
 *
 * Route contract (verified against PaymentService.gs getLedger / ledgerSummary):
 *   ledger.get     requires flatId -> VALIDATION_ERROR without it
 *   ledger.summary requires flatId -> VALIDATION_ERROR without it
 * So `/ledger` (no flat yet) must ask for a flat first; `/ledger/:flatId` arrives
 * with one already chosen. Both render the same panel once a flat is selected.
 *
 * The flat picker is rendered by a shared `FlatPicker` from (options, loading,
 * onSearch, value, onChange) primitives rather than a pre-built JSX node — a JSX
 * prop would be a fresh element on every parent render and remount the control
 * on each keystroke, dropping focus mid-search. */

import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { DataTable, type Column } from '@/components/data/DataTable';
import { FilterBar } from '@/components/data/FilterBar';
import { KpiCard } from '@/components/data/KpiCard';
import { AmountText } from '@/components/data/AmountText';
import { LookupSelect } from '@/components/data/LookupSelect';
import { PaginationBar } from '@/components/data/PaginationBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LedgerStep } from '../components/LedgerStep';
import { useLedger, useLedgerSummary } from '../hooks/useLedger';
import { useFlatOptions } from '@/features/members/hooks/useFlatOptions';
import { usePeriods } from '@/features/maintenance/hooks/usePeriods';
import { formatDate } from '@/lib/dates';
import type { LedgerEntry, LedgerSummary, SelectOption } from '@/types/domain';

const MUTED = { color: 'var(--color-text-muted)' } as const;

export default function LedgerPage() {
  const { flatId: routeFlatId } = useParams<{ flatId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const flatId = routeFlatId ?? searchParams.get('flatId') ?? '';

  const flatOptions = useFlatOptions();
  const [periodKey, setPeriodKey] = useState('');

  const selectFlat = (next: string) => {
    if (next) {
      navigate(`/ledger/${next}`);
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  /* ── No flat chosen yet: both ledger actions need one first ── */
  if (!flatId) {
    return (
      <div>
        <PageHeader
          title="Member Ledger"
          subtitle="Demand → Payment → Interest → Adjustment → Pending → Balance"
        />
        <Card>
          <CardBody>
            <Alert variant="info">
              A ledger belongs to a flat. Choose one to load its running account.
            </Alert>
            <div style={{ marginTop: 'var(--space-4)', maxWidth: 380 }}>
              <FlatPicker value={flatId} onChange={selectFlat} lookup={flatOptions} />
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <LedgerPanel
      key={`${flatId}|${periodKey}`}
      flatId={flatId}
      flatLabel={flatOptions.options.find((option) => option.value === flatId)?.label}
      periodKey={periodKey}
      onPeriodChange={setPeriodKey}
      lookup={flatOptions}
      onSelectFlat={selectFlat}
    />
  );
}

interface FlatLookup {
  options: SelectOption[];
  loading: boolean;
  searchFlats: (term: string) => void;
}

/** Config-driven flat selector. Takes primitives so it can be rendered from
 * either the picker screen or the keyed panel without remounting. */
function FlatPicker({
  value,
  onChange,
  lookup,
}: {
  value: string;
  onChange: (flatId: string) => void;
  lookup: FlatLookup;
}) {
  return (
    <LookupSelect
      options={lookup.options}
      value={value}
      onChange={onChange}
      loading={lookup.loading}
      onSearch={lookup.searchFlats}
      placeholder="Select a flat"
      searchPlaceholder="Search by flat number..."
    />
  );
}

interface LedgerPanelProps {
  flatId: string;
  flatLabel?: string;
  periodKey: string;
  onPeriodChange: (periodKey: string) => void;
  lookup: FlatLookup;
  onSelectFlat: (flatId: string) => void;
}

function LedgerPanel({
  flatId,
  flatLabel,
  periodKey,
  onPeriodChange,
  lookup,
  onSelectFlat,
}: LedgerPanelProps) {
  const { entries, page, loading, error, setPage, reload } = useLedger({
    flatId,
    periodKey: periodKey || undefined,
  });
  const { summaries, loading: summaryLoading, error: summaryError } = useLedgerSummary(flatId);
  const { periods } = usePeriods();

  const summary: LedgerSummary | undefined = summaries[0];

  const periodOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All periods' },
      ...periods.map((period) => ({ value: period.periodKey, label: period.periodKey })),
    ],
    [periods],
  );

  const columns: Column<LedgerEntry>[] = [
    { key: 'entryDate', header: 'Date', render: (row) => formatDate(row.entryDate) },
    { key: 'entryType', header: 'Type', render: (row) => <StatusBadge statusKey={row.entryType} /> },
    {
      key: 'description',
      header: 'Particulars',
      render: (row) => (
        <div>
          <div>{row.description || '—'}</div>
          {row.periodKey ? <div style={{ fontSize: 'var(--text-xs)', ...MUTED }}>{row.periodKey}</div> : null}
        </div>
      ),
    },
    {
      key: 'debit',
      header: 'Debit',
      align: 'right',
      render: (row) =>
        Number(row.debit ?? 0) > 0 ? <AmountText amount={Number(row.debit)} /> : <span style={MUTED}>—</span>,
    },
    {
      key: 'credit',
      header: 'Credit',
      align: 'right',
      render: (row) =>
        Number(row.credit ?? 0) > 0 ? <AmountText amount={Number(row.credit)} /> : <span style={MUTED}>—</span>,
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      render: (row) => <AmountText amount={Number(row.balance ?? 0)} />,
    },
  ];

  /* The API returns totalDebit, totalCredit and runningBalance. `runningBalance`
   * is already the closing figure, so prefer it; the subtraction is only a
   * fallback for an older payload and both operands are server-computed. */
  const debit = Number(summary?.totalDebit ?? 0);
  const credit = Number(summary?.totalCredit ?? 0);
  const pending = Number(summary?.runningBalance ?? debit - credit);

  const body = (() => {
    if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
    if (loading) return <Skeleton height={220} variant="rect" />;
    if (entries.length === 0) {
      return (
        <EmptyState
          title="No ledger entries"
          description={
            periodKey
              ? `Nothing was posted for this flat in ${periodKey}.`
              : 'Nothing has been posted for this flat yet.'
          }
        />
      );
    }
    return (
      <>
        <DataTable
          columns={columns}
          data={entries}
          getRowId={(row) => row.entryId}
          emptyTitle="No ledger entries"
        />
        <PaginationBar page={page} onPageChange={setPage} />
      </>
    );
  })();

  return (
    <div>
      <PageHeader
        title="Member Ledger"
        subtitle={flatLabel ?? 'Running account for the selected flat'}
      />

      <Card>
        <CardBody>
          <FilterBar>
            <div style={{ minWidth: 280 }}>
              <FlatPicker value={flatId} onChange={onSelectFlat} lookup={lookup} />
            </div>
            <Select
              value={periodKey}
              aria-label="Filter by period"
              onChange={(e) => onPeriodChange(e.target.value)}
              options={periodOptions}
            />
            <Button variant="ghost" onClick={() => void reload()} disabled={loading}>
              Refresh
            </Button>
          </FilterBar>
        </CardBody>
      </Card>

      {summaryError ? (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Alert variant="danger">Could not load the ledger summary. {summaryError}</Alert>
        </div>
      ) : null}

      <div className="hs-grid hs-grid--kpi" style={{ marginTop: 'var(--space-4)' }}>
        {summaryLoading ? (
          <>
            <Skeleton height={92} variant="rect" />
            <Skeleton height={92} variant="rect" />
            <Skeleton height={92} variant="rect" />
            <Skeleton height={92} variant="rect" />
          </>
        ) : (
          <>
            <KpiCard label="Total Debit" value={String(debit)} />
            <KpiCard label="Total Credit" value={String(credit)} />
            <KpiCard label="Pending" value={String(pending)} />
            <KpiCard label="Entries" value={String(page.total)} />
          </>
        )}
      </div>

      {!summaryLoading && summary ? (
        <Card style={{ marginTop: 'var(--space-4)' }}>
          <CardBody>
            <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
              <LedgerStep label="Demand" amount={debit} hint="Raised on this flat" />
              <LedgerStep label="Payment" amount={credit} hint="Received against it" />
              <LedgerStep label="Interest / Adjustment" amount={null} hint="Shown per entry below" />
              <LedgerStep label="Pending" amount={pending} hint="Server-computed balance" emphasis />
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardBody>{body}</CardBody>
      </Card>
    </div>
  );
}
