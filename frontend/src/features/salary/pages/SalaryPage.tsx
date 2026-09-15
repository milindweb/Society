/* SalaryPage.tsx — FE-10
 * SRS §12: the monthly salary run — prepare a period, review the drafts, then
 * approve and pay each one.
 *
 * The flow the backend enforces, and the reason this page has three distinct
 * affordances rather than one "save":
 *   DRAFT     — created by `salary.prepare`, editable via `salary.update`
 *   APPROVED  — `salary.approve` (refuses a non-DRAFT row, and refuses
 *               SELF-approval when the caller is linked to that employee)
 *   PAID      — `salary.pay` (refuses a non-APPROVED row; needs paymentDate +
 *               paymentModeKey)
 *
 * Contract notes (verified against HRService.gs:356-582 + Routes.gs):
 * - `salary.prepare` requires `periodKey`, creates one DRAFT row per ACTIVE
 *   employee and SKIPS anyone who already has a row for that period. That
 *   idempotency is a FEATURE, not a failure: a second run in the same month
 *   legitimately reports a smaller `created`. The result alert says so plainly
 *   instead of implying something went wrong.
 * - Every monetary column is a STRING on the sheet (Schema.gs:266-274), and
 *   `netSalary` is computed by the server in `HRService.computeNetSalary`. The
 *   client NEVER recomputes or adjusts it (SRS §8/§23) — it parses for display
 *   through `lib/money.ts` and nothing else. If a write changes the net, the
 *   page reloads and shows the server's figure rather than predicting it.
 * - `salary.list` filters on periodKey / employeeId / statusKey.
 *
 * No optimistic UI (SRS §23): after a prepare run the list reloads; after an
 * approve or a pay the affected row reloads from the server. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Select } from '@/components/ui/Select';
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
import { KpiCard } from '@/components/data/KpiCard';
import { AmountText } from '@/components/data/AmountText';
import { formatMoney } from '@/lib/money';
import { PrepareSalaryModal } from '../components/PrepareSalaryModal';
import { useSalaryList, usePrepareSalary } from '../hooks/useSalary';
import { useSalaryStatusOptions, usePeriodOptions } from '../hooks/useSalaryLookups';
import { useEmployeeOptions } from '@/features/employees/hooks/useEmployees';
import { canEditSalary, canApproveSalary, canPaySalary } from '@/services/employeeService';
import type { EmployeeSalary } from '@/types/domain';

export default function SalaryPage() {
  const navigate = useNavigate();

  const periods = usePeriodOptions(12);
  const statuses = useSalaryStatusOptions();
  const employees = useEmployeeOptions();

  /* Default to the newest period — the month you are almost always working on. */
  const [periodKey, setPeriodKey] = useState<string>(() => periods.options[0]?.value ?? '');
  const [employeeId, setEmployeeId] = useState('');
  const [statusKey, setStatusKey] = useState('');
  const [preparing, setPreparing] = useState(false);

  const { salaries, page, loading, error, setFilters, setPage, reload } = useSalaryList({
    periodKey: periodKey || undefined,
    employeeId: employeeId || undefined,
    statusKey: statusKey || undefined,
  });

  const prepare = usePrepareSalary();

  /* Totals for the current period. These sum the SERVER's own `netSalary`
   * figures — the client does not derive them from components (SRS §8/§23). */
  const totals = salaries.reduce(
    (acc, row) => {
      const net = Number(row.netSalary) || 0;
      acc.net += net;
      if (row.statusKey === 'DRAFT') acc.draft += 1;
      if (row.statusKey === 'APPROVED') acc.approved += 1;
      if (row.statusKey === 'PAID') acc.paid += 1;
      return acc;
    },
    { net: 0, draft: 0, approved: 0, paid: 0 },
  );

  const employeeLabel = (row: EmployeeSalary) =>
    row.employeeName ||
    employees.options.find((option) => option.value === row.employeeId)?.label ||
    row.employeeId;

  const columns: Column<EmployeeSalary>[] = [
    {
      key: 'employeeName',
      header: 'Employee',
      render: (row) => (
        <div>
          <div>{employeeLabel(row)}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {row.periodKey}
          </div>
        </div>
      ),
    },
    {
      key: 'baseSalary',
      header: 'Base',
      align: 'right',
      render: (row) => <AmountText amount={Number(row.baseSalary) || 0} />,
    },
    {
      key: 'attendanceAdjustment',
      header: 'Attendance adj.',
      align: 'right',
      render: (row) => <AmountText amount={Number(row.attendanceAdjustment) || 0} showSign />,
    },
    {
      key: 'days',
      header: 'Days P / A / H',
      render: (row) => (
        <span>
          {row.presentDays} / {row.absentDays} / {row.halfDays}
        </span>
      ),
    },
    {
      key: 'netSalary',
      header: 'Net payable',
      align: 'right',
      render: (row) => <strong><AmountText amount={Number(row.netSalary) || 0} /></strong>,
    },
    {
      key: 'statusKey',
      header: 'Status',
      render: (row) => <StatusBadge statusKey={row.statusKey} />,
    },
    {
      key: 'next',
      header: 'Next step',
      render: (row) =>
        canEditSalary(row.statusKey)
          ? 'Review and approve'
          : canApproveSalary(row.statusKey)
            ? 'Approve'
            : canPaySalary(row.statusKey)
              ? 'Record payment'
              : 'Settled',
    },
  ];

  const renderMobile = (row: EmployeeSalary) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <strong>{employeeLabel(row)}</strong>
        <StatusBadge statusKey={row.statusKey} />
      </div>
      <div
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          marginTop: 'var(--space-1)',
        }}
      >
        {row.periodKey} · present {row.presentDays}, absent {row.absentDays}, half{' '}
        {row.halfDays}
      </div>
      <div style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-1)' }}>
        Net <AmountText amount={Number(row.netSalary) || 0} />
      </div>
    </div>
  );

  const body = (() => {
    if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
    if (loading) return <Skeleton height={240} variant="rect" />;
    if (salaries.length === 0) {
      return (
        <EmptyState
          title="No salary records"
          description={
            periodKey
              ? 'Nothing has been prepared for this period yet. Run a prepare to create the drafts.'
              : 'Pick a period, then run a prepare to create the drafts.'
          }
          action={
            <PermissionGate permission="salary.write">
              <Button
                icon={<Icon name="plus" size={16} />}
                onClick={() => setPreparing(true)}
                disabled={!periodKey}
              >
                Prepare salary
              </Button>
            </PermissionGate>
          }
        />
      );
    }
    return (
      <>
        <div className="hs-only-desktop">
          <DataTable
            columns={columns}
            data={salaries}
            getRowId={(row) => row.salaryId}
            onRowClick={(row) => navigate(`/salary/${row.salaryId}`)}
            emptyTitle="No salary records"
          />
        </div>
        <div className="hs-only-mobile">
          <DataListMobile
            data={salaries}
            render={renderMobile}
            onRowClick={(row) => navigate(`/salary/${row.salaryId}`)}
            emptyTitle="No salary records"
          />
        </div>
        <PaginationBar page={page} onPageChange={setPage} />
      </>
    );
  })();

  return (
    <div>
      <PageHeader
        title="Salary"
        subtitle="Monthly staff salary — prepared from attendance, then approved and paid"
        actions={
          <PermissionGate permission="salary.write">
            <Button
              icon={<Icon name="plus" size={16} />}
              onClick={() => setPreparing(true)}
              disabled={!periodKey}
            >
              Prepare salary
            </Button>
          </PermissionGate>
        }
      />

      <div
        className="hs-grid hs-grid-cols-2 hs-lg-grid-cols-4"
        style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}
      >
        <KpiCard label="Net payable this period" value={formatMoney(totals.net, { compact: true })} />
        <KpiCard label="Draft" value={totals.draft} />
        <KpiCard label="Approved" value={totals.approved} />
        <KpiCard label="Paid" value={totals.paid} />
      </div>

      <Card>
        <CardBody>
          <FilterBar>
            <Select
              aria-label="Filter by period"
              value={periodKey}
              options={periods.options}
              onChange={(e) => {
                setPeriodKey(e.target.value);
                setFilters({ periodKey: e.target.value || undefined });
              }}
            />
            <Select
              aria-label="Filter by employee"
              value={employeeId}
              options={[{ value: '', label: 'All employees' }, ...employees.options]}
              onChange={(e) => {
                setEmployeeId(e.target.value);
                setFilters({ employeeId: e.target.value || undefined });
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
            <Button variant="ghost" onClick={() => void reload()} disabled={loading}>
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
            Preparation creates one draft per active employee, with the net computed on the server
            from that month&apos;s attendance. Running it again for the same period is safe — anyone
            who already has a record for that month is skipped, not duplicated.
          </p>

          {prepare.error ? (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <Alert variant="danger">{prepare.error}</Alert>
            </div>
          ) : null}

          {prepare.result ? (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <Alert variant={prepare.result.created > 0 ? 'success' : 'info'}>
                {prepare.result.created > 0
                  ? `Created ${prepare.result.created} ${prepare.result.created === 1 ? 'record' : 'records'} for ${prepare.result.periodKey}.`
                  : `Nothing new to create for ${prepare.result.periodKey} — every active employee already has a record for that month.`}
              </Alert>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardBody>{body}</CardBody>
      </Card>

      <PrepareSalaryModal
        open={preparing}
        periodOptions={periods.options}
        defaultPeriodKey={periodKey}
        preparing={prepare.preparing}
        onClose={() => setPreparing(false)}
        onConfirm={async (input) => {
          const result = await prepare.prepare(input);
          if (result) {
            /* The period may have changed inside the modal — follow it so the
             * list shows what was actually prepared. */
            const nextPeriod = result.periodKey;
            setPeriodKey(nextPeriod);
            setFilters({ periodKey: nextPeriod });
            await reload();
          }
          return result !== null;
        }}
      />
    </div>
  );
}
