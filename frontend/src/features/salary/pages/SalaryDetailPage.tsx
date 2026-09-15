/* SalaryDetailPage.tsx — FE-10
 * SRS §12: one employee's salary for one month — the breakdown, the adjustments,
 * the approval and the payment.
 *
 * The page is a state machine over `statusKey`, because the backend is one:
 *   DRAFT     -> components are editable (`salary.update`), and Approve is offered
 *   APPROVED  -> read-only, and Record payment is offered (`salary.pay`)
 *   PAID      -> read-only and terminal
 *   CANCELLED -> read-only and terminal
 *
 * Every net figure shown is the SERVER's. `netSalary` arrives from
 * `HRService.computeNetSalary` and is only ever parsed for display — the client
 * never adds up the components, never "corrects" the total, and never shows a
 * predicted net after an edit (SRS §8/§23). After a successful edit the page
 * reloads, so the number on screen is always the persisted one.
 *
 * Two server refusals are surfaced verbatim rather than pre-empted, because only
 * the server knows the answer:
 *   - `salary.approve` refuses a non-DRAFT row ("Only DRAFT salary can be
 *     approved.") and refuses SELF-approval when the signed-in user is linked to
 *     that employee (`FORBIDDEN`, "Self-approval is not allowed."). The second is
 *     rendered at the top of the page, so it reads as the reason this particular
 *     record cannot be approved by this particular person.
 *   - `salary.pay` refuses a non-APPROVED row.
 *
 * ⚠️ EVERY component on the sheet is a STRING (Schema.gs:266-274). They are sent
 * back as strings and parsed only for display.
 *
 * There is no cancel action: `CANCELLED` exists in the SALARY status domain, but
 * no `salary.cancel` route exposes it, and offering a button that cannot work
 * would be worse than offering none. */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Alert } from '@/components/ui/Alert';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { Modal } from '@/components/ui/Modal';
import { PermissionGate } from '@/app/PermissionGate';
import { DataTable, type Column } from '@/components/data/DataTable';
import { AmountText } from '@/components/data/AmountText';
import { SalaryComponentsForm } from '../components/SalaryComponentsForm';
import { PaySalaryModal } from '../components/PaySalaryModal';
import { useSalary } from '../hooks/useSalary';
import { canEditSalary, canApproveSalary, canPaySalary } from '@/services/employeeService';
import { formatDate } from '@/lib/dates';
import type { EmployeeAttendance } from '@/types/domain';

export default function SalaryDetailPage() {
  const navigate = useNavigate();
  const { salaryId } = useParams<{ salaryId: string }>();

  const { detail, loading, error, busy, reload, update, approve, pay } = useSalary(salaryId);

  const [editing, setEditing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [paying, setPaying] = useState(false);

  if (loading) {
    return (
      <div>
        <PageHeader title="Salary record" subtitle="Loading…" />
        <Skeleton height={320} variant="rect" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div>
        <PageHeader title="Salary record" subtitle="Not available" />
        <ErrorState
          message={error ?? 'This salary record could not be loaded.'}
          onRetry={() => void reload()}
        />
      </div>
    );
  }

  const { salary, employee, attendanceBreakdown } = detail;

  const editable = canEditSalary(salary.statusKey);
  const approvable = canApproveSalary(salary.statusKey);
  const payable = canPaySalary(salary.statusKey);

  const attendanceColumns: Column<EmployeeAttendance>[] = [
    {
      key: 'attendanceDate',
      header: 'Date',
      render: (row) => (row.attendanceDate ? formatDate(row.attendanceDate) : '—'),
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
      key: 'hours',
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

  /* The earning / deduction split. Both lists are the server's own figures —
   * this groups them for reading, it does not calculate either side. */
  const earnings: { label: string; value: string }[] = [
    { label: 'Base salary', value: salary.baseSalary },
    { label: 'Attendance adjustment', value: salary.attendanceAdjustment },
    { label: 'Overtime', value: salary.overtimeAmount },
    { label: 'Allowance', value: salary.allowanceAmount },
    { label: 'Bonus', value: salary.bonusAmount },
    { label: 'Other adjustment', value: salary.otherAdjustment },
  ];

  const deductions: { label: string; value: string }[] = [
    { label: 'Advance recovery', value: salary.advanceDeduction },
    { label: 'Other deduction', value: salary.otherDeduction },
  ];

  return (
    <div>
      <PageHeader
        title={employee?.fullName || salary.employeeName || 'Salary record'}
        subtitle={`${salary.periodKey}${employee?.employeeCode ? ` · ${employee.employeeCode}` : ''}`}
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Salary', onClick: () => navigate('/salary') },
              { label: salary.periodKey },
            ]}
          />
        }
        actions={
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <StatusBadge statusKey={salary.statusKey} />
            {editable ? (
              <PermissionGate permission="salary.write">
                <Button
                  variant="secondary"
                  icon={<Icon name="edit" size={16} />}
                  onClick={() => setEditing(true)}
                  disabled={busy}
                >
                  Edit components
                </Button>
              </PermissionGate>
            ) : null}
            {approvable ? (
              <PermissionGate permission="salary.approve">
                <Button
                  icon={<Icon name="check" size={16} />}
                  onClick={() => setApproving(true)}
                  disabled={busy}
                >
                  Approve
                </Button>
              </PermissionGate>
            ) : null}
            {payable ? (
              <PermissionGate permission="salary.write">
                <Button
                  icon={<Icon name="payments" size={16} />}
                  onClick={() => setPaying(true)}
                  disabled={busy}
                >
                  Record payment
                </Button>
              </PermissionGate>
            ) : null}
          </div>
        }
      />

      {/* A refusal from the server (a self-approval, a stale status, a rejected
       * component value) is shown at the top of the page in the server's own
       * words. We do not re-word it and we do not pre-empt it. */}
      {error ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">{error}</Alert>
        </div>
      ) : null}

      {salary.statusKey === 'PAID' ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="success">
            Paid{salary.paymentDate ? ` on ${formatDate(salary.paymentDate)}` : ''}
            {salary.paymentModeKey ? ` · ${salary.paymentModeKey}` : ''}
            {salary.referenceNumber ? ` · reference ${salary.referenceNumber}` : ''}
          </Alert>
        </div>
      ) : null}

      {salary.statusKey === 'CANCELLED' ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="warning">
            This record was cancelled and is kept for the record. Nothing further can be done with it.
          </Alert>
        </div>
      ) : null}

      <Card>
        <CardBody>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 'var(--space-1)',
            }}
          >
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Net payable — computed by the server from attendance
            </span>
            <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>
              <AmountText amount={Number(salary.netSalary) || 0} />
            </span>
          </div>
        </CardBody>
      </Card>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardHeader title="Breakdown" />
        <CardBody>
          <div
            className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
            style={{ gap: 'var(--space-6)' }}
          >
            <div>
              <h4
                style={{
                  margin: '0 0 var(--space-3)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Earnings
              </h4>
              <AmountRows items={earnings} />
            </div>
            <div>
              <h4
                style={{
                  margin: '0 0 var(--space-3)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Deductions
              </h4>
              <AmountRows items={deductions} />
            </div>
          </div>

          <p
            style={{
              marginTop: 'var(--space-4)',
              marginBottom: 0,
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
            }}
          >
            These are the figures the server stored. The net above is its own calculation — this page
            does not add them up, so what you see is what will be paid.
          </p>
        </CardBody>
      </Card>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardHeader title="Attendance this period" />
        <CardBody>
          <DescriptionList
            columns={2}
            items={[
              { label: 'Working days', value: salary.workingDays || '—' },
              { label: 'Present days', value: salary.presentDays || '—' },
              { label: 'Absent days', value: salary.absentDays || '—' },
              { label: 'Leave days', value: salary.leaveDays || '—' },
              { label: 'Half days', value: salary.halfDays || '—' },
              { label: 'Holidays', value: salary.holidayDays || '—' },
              {
                label: 'Per-day amount',
                value: <AmountText amount={Number(salary.perDayAmount) || 0} />,
              },
              { label: 'Overtime hours', value: salary.overtimeHours || '0' },
            ]}
          />

          {attendanceBreakdown.length > 0 ? (
            <div style={{ marginTop: 'var(--space-5)' }}>
              <DataTable
                columns={attendanceColumns}
                data={attendanceBreakdown}
                getRowId={(row) => row.attendanceId}
                emptyTitle="No attendance rows in this period"
              />
            </div>
          ) : (
            <p
              style={{
                marginTop: 'var(--space-4)',
                marginBottom: 0,
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-muted)',
              }}
            >
              No attendance rows were found for this period. If the amount above looks wrong, check
              the attendance register for {salary.periodKey} first — this record was built from it.
            </p>
          )}
        </CardBody>
      </Card>

      {salary.remarks ? (
        <Card style={{ marginTop: 'var(--space-4)' }}>
          <CardHeader title="Remarks" />
          <CardBody>
            <p style={{ margin: 0 }}>{salary.remarks}</p>
          </CardBody>
        </Card>
      ) : null}

      {/* Edit components — DRAFT only, enforced by the server regardless. */}
      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit salary components"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="salary-components-form" loading={busy}>
              Save
            </Button>
          </>
        }
      >
        <SalaryComponentsForm
          formId="salary-components-form"
          salary={salary}
          onSubmit={async (input) => {
            const ok = await update(input);
            if (ok) setEditing(false);
            return ok;
          }}
        />
      </Modal>

      {/* Approve — expect the server to refuse when the approver is the employee. */}
      <Modal
        open={approving}
        onClose={() => setApproving(false)}
        title="Approve this salary record?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setApproving(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                void (async () => {
                  const ok = await approve();
                  if (ok) setApproving(false);
                })();
              }}
              loading={busy}
            >
              Approve
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <p style={{ margin: 0 }}>
            Approving locks the components. The amount is not recalculated by this action — it
            confirms the figure the server already computed.
          </p>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            {employee?.fullName || salary.employeeName || 'This employee'} · {salary.periodKey} ·{' '}
            <AmountText amount={Number(salary.netSalary) || 0} />
          </p>
          {error ? <Alert variant="danger">{error}</Alert> : null}
        </div>
      </Modal>

      {/* Record payment — APPROVED only, and requires a date and a mode. */}
      <PaySalaryModal
        open={paying}
        salary={salary}
        busy={busy}
        error={error}
        onClose={() => setPaying(false)}
        onConfirm={async (input) => {
          const ok = await pay(input);
          if (ok) setPaying(false);
          return ok;
        }}
      />

      <div style={{ marginTop: 'var(--space-4)' }}>
        <Button
          variant="ghost"
          icon={<Icon name="back" size={16} />}
          onClick={() => navigate('/salary')}
        >
          Back to salary
        </Button>
      </div>
    </div>
  );
}

/** A small label/amount list used for the earnings and deductions columns.
 * Renders an em dash for an empty string rather than a misleading 0. */
function AmountRows({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl style={{ margin: 0, display: 'grid', gap: 'var(--space-2)' }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <dt style={{ color: 'var(--color-text-muted)' }}>{item.label}</dt>
          <dd style={{ margin: 0 }}>
            {item.value === '' || item.value === undefined ? (
              '—'
            ) : (
              <AmountText amount={Number(item.value) || 0} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
