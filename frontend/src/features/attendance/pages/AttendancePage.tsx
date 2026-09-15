/* AttendancePage.tsx — FE-10
 * SRS §12: the daily attendance register — mark every employee for a date, and
 * see what was already marked.
 *
 * Two views, because they answer two different questions:
 *   1. REGISTER — "who worked on this date?" One row per ACTIVE employee, a
 *                 status per row, submitted as ONE `attendance.mark` call.
 *   2. RECORDS  — "what has been marked recently?" The paginated history, with
 *                 employee / status / date-range filters the server really has.
 *
 * Contract notes (verified against HRService.gs:229-333 + Routes.gs:832-938):
 * - `attendance.mark` takes a `rows` ARRAY and upserts per
 *   (employeeId, attendanceDate). Unlike `meetings.attendance.mark` it is NOT
 *   destructive — submitting one employee does not clear their colleagues — so
 *   the whole register can be submitted in a single call.
 * - It answers with COUNTS (`{marked, newlyCreated}`), not rows. A row missing
 *   employeeId / attendanceDate / statusKey, or carrying a statusKey outside
 *   PRESENT/ABSENT/LEAVE/HALF_DAY/HOLIDAY, is SKIPPED SILENTLY. Every row this
 *   page builds is validated before submit and the acknowledged counts are always
 *   reported back — so "marked 8" can never hide a dropped row.
 * - `workedHours` is honoured only on CREATE. The register deliberately does not
 *   send it: on a re-mark it would be ignored, and offering an input that
 *   silently does nothing on the second save would be a lie.
 * - `attendance.list` DOES support from / to (unusual in this codebase — most
 *   list routes do not) plus employeeId / statusKey. The register reads a single
 *   day back by asking for from = to = date.
 * - `attendance.summary` returns a map keyed by employeeId and accepts
 *   `periodKey` (`YYYY-MM`). The KPI strip sums those SERVER counts; no salary or
 *   attendance arithmetic happens on the client (SRS §8/§23).
 *
 * No optimistic UI (SRS §23): after a mark, the day, the records list and the
 * summary all reload from the server. Nothing is assumed to have saved. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PermissionGate } from '@/app/PermissionGate';
import { DataTable, type Column } from '@/components/data/DataTable';
import { DataListMobile } from '@/components/data/DataListMobile';
import { FilterBar } from '@/components/data/FilterBar';
import { PaginationBar } from '@/components/data/PaginationBar';
import { KpiCard } from '@/components/data/KpiCard';
import { useEmployeeOptions } from '@/features/employees/hooks/useEmployees';
import { useAttendanceList, useAttendanceSummary, useMarkAttendance } from '../hooks/useAttendance';
import { useAttendanceStatusOptions } from '../hooks/useAttendanceLookups';
import { formatDate } from '@/lib/dates';
import { ExportButton } from '@/components/ui/ExportButton';
import type { EmployeeAttendance } from '@/types/domain';

/** Today in UTC as `YYYY-MM-DD`.
 *
 * Built from `toISOString` rather than the local clock so it matches the date
 * strings the server writes (which are UTC-based). Formatting the local date
 * here would let the register default to yesterday or tomorrow for users east or
 * west of UTC, and a mark saved against the wrong day is hard to notice. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The register's working state: employeeId -> statusKey. An empty string means
 * "not chosen" and such a row is never submitted. */
type DraftMap = Record<string, string>;

type ViewKey = 'register' | 'records';

/** One row of the register grid — an employee plus their draft status. */
interface RegisterRow {
  employeeId: string;
  label: string;
}

export default function AttendancePage() {
  const navigate = useNavigate();

  const [view, setView] = useState<ViewKey>('register');

  /* ── Register state ─────────────────────────────────────────────────────── */
  const [registerDate, setRegisterDate] = useState<string>(todayIso);
  const [draft, setDraft] = useState<DraftMap>({});
  /** The date the current `draft` belongs to. Guards against showing a draft
   * built for one date while the picker shows another. */
  const [draftDate, setDraftDate] = useState<string>('');

  /* ── Records filters ────────────────────────────────────────────────────── */
  const [filterEmployeeId, setFilterEmployeeId] = useState('');
  const [filterStatusKey, setFilterStatusKey] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const statuses = useAttendanceStatusOptions();
  const employees = useEmployeeOptions();

  /* The day currently selected in the register, read back from the server.
   * `attendance.list` honours from/to, so asking for from = to = date is the
   * cheapest honest way to know who is already marked. There is no
   * `attendance.byDate` route to call instead. */
  const day = useAttendanceList({
    from: registerDate || undefined,
    to: registerDate || undefined,
  });

  const records = useAttendanceList({
    employeeId: filterEmployeeId || undefined,
    statusKey: filterStatusKey || undefined,
    from: filterFrom || undefined,
    to: filterTo || undefined,
  });

  const { marking, error: markError, result: markResult, mark, reset: resetMark } = useMarkAttendance();

  /* The summary is scoped to the month on screen, so the KPI strip and the
   * register describe the same window and cannot disagree. */
  const summary = useAttendanceSummary({ periodKey: registerDate.slice(0, 7) });

  /* Rebuild the draft from the PERSISTED day whenever the date changes or the
   * day reloads. This is the no-optimistic-UI rule applied to a screen that is
   * both an input and a report: what you see is what the server holds. */
  useEffect(() => {
    if (day.loading) return;
    if (draftDate === registerDate && day.rows.length === 0) {
      /* Same date, nothing persisted — leave whatever the user has typed. This
       * keeps a mark-then-reload from clearing the grid the user just filled. */
      return;
    }
    const next: DraftMap = {};
    for (const row of day.rows) {
      if (row.statusKey) next[row.employeeId] = row.statusKey;
    }
    setDraft(next);
    setDraftDate(registerDate);
    resetMark();
  }, [registerDate, draftDate, day.loading, day.rows, resetMark]);

  const registerRows: RegisterRow[] = useMemo(
    () => employees.options.map((option) => ({ employeeId: option.value, label: option.label })),
    [employees.options],
  );

  const selectedCount = useMemo(
    () => Object.values(draft).filter((value) => value !== '').length,
    [draft],
  );

  const setStatus = useCallback((employeeId: string, statusKey: string) => {
    setDraft((prev) => ({ ...prev, [employeeId]: statusKey }));
  }, []);

  /** Clear one employee's choice without saving — useful when a row was set by
   * mistake. It only touches local state; the server row is untouched. */
  const clearStatus = useCallback((employeeId: string) => {
    setDraft((prev) => ({ ...prev, [employeeId]: '' }));
  }, []);

  /* ── Submit ───────────────────────────────────────────────────────────────
   * Only rows with a chosen status are sent, and only rows with a valid one.
   * Validating here is what makes the acknowledged counts trustworthy: the
   * server's silent skip has nothing left to drop. */
  const submitRegister = async () => {
    const allowed = new Set(statuses.options.map((option) => option.value));
    const rows = Object.entries(draft)
      .filter(([, statusKey]) => statusKey !== '' && allowed.has(statusKey))
      .map(([employeeId, statusKey]) => ({
        employeeId,
        attendanceDate: registerDate,
        statusKey,
      }));

    if (rows.length === 0) return;

    const acknowledged = await mark(rows);
    if (acknowledged) {
      /* Reload all three: the day grid, the records history and the month
       * summary all change with a mark. None is patched locally. */
      await Promise.all([day.reload(), records.reload(), summary.reload()]);
    }
  };

  /* ── Records table ──────────────────────────────────────────────────────── */
  const recordColumns: Column<EmployeeAttendance>[] = [
    {
      key: 'attendanceDate',
      header: 'Date',
      render: (row) => (row.attendanceDate ? formatDate(row.attendanceDate) : '—'),
    },
    {
      key: 'employeeId',
      header: 'Employee',
      render: (row) => (
        <div>
          <div>{row.employeeName || employeeLabel(employees.options, row.employeeId)}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {row.employeeId}
          </div>
        </div>
      ),
    },
    {
      key: 'statusKey',
      header: 'Status',
      render: (row) => <StatusBadge statusKey={row.statusKey} />,
    },
    {
      key: 'times',
      header: 'In / out',
      render: (row) => (
        <span>
          {row.inTime || '—'} / {row.outTime || '—'}
        </span>
      ),
    },
    {
      key: 'workedHours',
      header: 'Hours',
      align: 'right',
      render: (row) => (
        <span>
          {row.workedHours || '—'}
          {row.overtimeHours ? ` (+${row.overtimeHours} OT)` : ''}
        </span>
      ),
    },
    {
      key: 'remarks',
      header: 'Remarks',
      render: (row) => row.remarks || '—',
    },
  ];

  const renderRecordMobile = (row: EmployeeAttendance) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <strong>{row.employeeName || employeeLabel(employees.options, row.employeeId)}</strong>
        <StatusBadge statusKey={row.statusKey} />
      </div>
      <div
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          marginTop: 'var(--space-1)',
        }}
      >
        {row.attendanceDate ? formatDate(row.attendanceDate) : '—'}
        {row.inTime || row.outTime ? ` · ${row.inTime || '—'}–${row.outTime || '—'}` : ''}
      </div>
      {row.remarks ? (
        <div style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>{row.remarks}</div>
      ) : null}
    </div>
  );

  /* ── Register grid ──────────────────────────────────────────────────────── */
  const registerColumns: Column<RegisterRow>[] = [
    {
      key: 'label',
      header: 'Employee',
      render: (row) => <strong>{row.label}</strong>,
    },
    {
      key: 'recorded',
      header: 'Recorded',
      render: (row) =>
        draft[row.employeeId] ? (
          <StatusBadge statusKey={draft[row.employeeId] as string} />
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>Not marked</span>
        ),
    },
    {
      key: 'status',
      header: 'Set status',
      render: (row) => (
        <Select
          aria-label={`Attendance status for ${row.label}`}
          value={draft[row.employeeId] ?? ''}
          options={[{ value: '', label: 'Not marked' }, ...statuses.options]}
          onChange={(e) => setStatus(row.employeeId, e.target.value)}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        draft[row.employeeId] ? (
          <Button variant="ghost" onClick={() => clearStatus(row.employeeId)}>
            Clear
          </Button>
        ) : null,
    },
  ];

  const registerBody = (() => {
    if (employees.loading || day.loading) return <Skeleton height={240} variant="rect" />;
    if (employees.options.length === 0) {
      return (
        <EmptyState
          title="No active employees"
          description="The register marks the people on the employee master. Add an employee first."
        />
      );
    }
    if (day.error) return <ErrorState message={day.error} onRetry={() => void day.reload()} />;

    return (
      <>
        <div className="hs-only-desktop">
          {/* No onRowClick: each row is an input, and a click that also
              navigated away would discard a half-filled register. */}
          <DataTable
            columns={registerColumns}
            data={registerRows}
            getRowId={(row) => row.employeeId}
            emptyTitle="No active employees"
          />
        </div>
        <div className="hs-only-mobile">
          <DataListMobile
            data={registerRows}
            emptyTitle="No active employees"
            render={(row) => (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>{row.label}</div>
                <Select
                  aria-label={`Attendance status for ${row.label}`}
                  value={draft[row.employeeId] ?? ''}
                  options={[{ value: '', label: 'Not marked' }, ...statuses.options]}
                  onChange={(e) => setStatus(row.employeeId, e.target.value)}
                />
              </div>
            )}
          />
        </div>
      </>
    );
  })();

  const monthTotals = sumSummary(Object.values(summary.summary));

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Daily staff attendance — the days that feed the salary run"
        actions={
          <>
            <ExportButton columns={recordColumns} data={records.rows} filename="attendance-records" />
            <Button
              variant="secondary"
              icon={<Icon name="employees" size={16} />}
              onClick={() => navigate('/employees')}
            >
              Employees
            </Button>
          </>
        }
      />

      {/* Month totals. Every figure is a sum of the SERVER's own counts. */}
      <div
        className="hs-grid hs-grid-cols-2 hs-lg-grid-cols-5"
        style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}
      >
        <KpiCard label="Present days" value={monthTotals.present} />
        <KpiCard label="Absent days" value={monthTotals.absent} />
        <KpiCard label="Leave days" value={monthTotals.leave} />
        <KpiCard label="Half days" value={monthTotals.halfDay} />
        <KpiCard label="Holidays" value={monthTotals.holiday} />
      </div>

      <Card>
        <CardBody>
          <SegmentedControl
            options={[
              { key: 'register', label: 'Mark attendance' },
              { key: 'records', label: 'Records' },
            ]}
            value={view}
            onChange={(next) => setView(next as ViewKey)}
          />

          {view === 'register' ? (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <FilterBar>
                <Input
                  type="date"
                  aria-label="Register date"
                  value={registerDate}
                  max={todayIso()}
                  onChange={(e) => setRegisterDate(e.target.value || todayIso())}
                />
                <PermissionGate permission="attendance.write">
                  <Button
                    icon={<Icon name="check" size={16} />}
                    onClick={() => void submitRegister()}
                    loading={marking}
                    disabled={selectedCount === 0 || marking}
                  >
                    {selectedCount === 0
                      ? 'Nothing to save'
                      : `Save ${selectedCount} ${selectedCount === 1 ? 'entry' : 'entries'}`}
                  </Button>
                </PermissionGate>
                <Button
                  variant="ghost"
                  onClick={() => {
                    /* Re-read the day rather than guessing: the server is the
                     * only thing that knows what is actually persisted. */
                    void day.reload();
                    resetMark();
                  }}
                  disabled={marking || day.loading}
                >
                  Discard changes
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
                Marking is per employee and per date, and it never clears anyone else — so you can
                save the whole day at once or one person at a time. Saving again for the same person
                and date updates that entry instead of adding a second one. Hours are recorded
                server-side from the times; the register sets the status.
              </p>

              {markError ? (
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <Alert variant="danger">{markError}</Alert>
                </div>
              ) : null}

              {markResult ? (
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <Alert variant="success">
                    Saved {markResult.marked} {markResult.marked === 1 ? 'entry' : 'entries'} for{' '}
                    {registerDate ? formatDate(registerDate) : 'the selected date'}
                    {markResult.marked > markResult.newlyCreated
                      ? ` — ${markResult.marked - markResult.newlyCreated} updated an entry that already existed.`
                      : '.'}
                  </Alert>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <FilterBar>
                <Select
                  aria-label="Filter by employee"
                  value={filterEmployeeId}
                  options={[{ value: '', label: 'All employees' }, ...employees.options]}
                  onChange={(e) => {
                    setFilterEmployeeId(e.target.value);
                    records.setFilters({ employeeId: e.target.value || undefined });
                  }}
                />
                <Select
                  aria-label="Filter by status"
                  value={filterStatusKey}
                  options={[{ value: '', label: 'All statuses' }, ...statuses.options]}
                  onChange={(e) => {
                    setFilterStatusKey(e.target.value);
                    records.setFilters({ statusKey: e.target.value || undefined });
                  }}
                />
                <Input
                  type="date"
                  aria-label="From date"
                  value={filterFrom}
                  onChange={(e) => {
                    setFilterFrom(e.target.value);
                    records.setFilters({ from: e.target.value || undefined });
                  }}
                />
                <Input
                  type="date"
                  aria-label="To date"
                  value={filterTo}
                  onChange={(e) => {
                    setFilterTo(e.target.value);
                    records.setFilters({ to: e.target.value || undefined });
                  }}
                />
                <Button
                  variant="ghost"
                  onClick={() => void records.reload()}
                  disabled={records.loading}
                >
                  Refresh
                </Button>
              </FilterBar>
            </div>
          )}
        </CardBody>
      </Card>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardBody>
          {view === 'register' ? (
            registerBody
          ) : records.error ? (
            <ErrorState message={records.error} onRetry={() => void records.reload()} />
          ) : records.loading ? (
            <Skeleton height={240} variant="rect" />
          ) : records.rows.length === 0 ? (
            <EmptyState
              title="No attendance records"
              description={
                filterEmployeeId || filterStatusKey || filterFrom || filterTo
                  ? 'No record matches the current filters.'
                  : 'Nothing has been marked yet — use the register to record a day.'
              }
            />
          ) : (
            <>
              <div className="hs-only-desktop">
                <DataTable
                  columns={recordColumns}
                  data={records.rows}
                  getRowId={(row) => row.attendanceId}
                  emptyTitle="No attendance records"
                />
              </div>
              <div className="hs-only-mobile">
                <DataListMobile
                  data={records.rows}
                  render={renderRecordMobile}
                  emptyTitle="No attendance records"
                />
              </div>
              <PaginationBar page={records.page} onPageChange={records.setPage} />
            </>
          )}
        </CardBody>
      </Card>

      {summary.error ? (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Alert variant="warning">
            The month totals could not be loaded: {summary.error}
          </Alert>
        </div>
      ) : null}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

interface EmployeeOption {
  value: string;
  label: string;
}

/** Resolve a label for an employeeId, falling back to the raw id. `attendance.list`
 * returns `employeeName` on some rows and not others, so both paths are needed. */
function employeeLabel(options: EmployeeOption[], employeeId: string): string {
  return options.find((option) => option.value === employeeId)?.label || employeeId;
}

/** Fold the per-employee summary rows into one month figure.
 *
 * This adds the SERVER's own counts together — it is not salary arithmetic and
 * nothing here touches money (SRS §8/§23). Half days stay a separate column
 * rather than being folded into "present", because 0.5 of a day is not a day. */
function sumSummary(
  rows: { present: number; absent: number; leave: number; halfDay: number; holiday: number }[],
): { present: number; absent: number; leave: number; halfDay: number; holiday: number } {
  return rows.reduce(
    (totals, row) => ({
      present: totals.present + (row.present ?? 0),
      absent: totals.absent + (row.absent ?? 0),
      leave: totals.leave + (row.leave ?? 0),
      halfDay: totals.halfDay + (row.halfDay ?? 0),
      holiday: totals.holiday + (row.holiday ?? 0),
    }),
    { present: 0, absent: 0, leave: 0, halfDay: 0, holiday: 0 },
  );
}
