/* EmployeeDetailPage.tsx — FE-10
 * SRS §11: the employee record with type, contact, bank and ID details, plus the
 * recent attendance and salary history the server attaches.
 *
 * Contract notes (verified against HRService.gs:111-130, 205-223):
 * - `employees.get` returns a COMPOSITE `{ employee, recentAttendance, salaryHistory }`
 *   — the last 30 attendance rows and the last 12 salary rows, already sorted
 *   newest-first by the server. Nothing extra is fetched for the tabs.
 * - `employees.archive` requires a `reason`, sets statusKey ARCHIVED and stamps
 *   `exitDate` with today. There is NO un-archive route, so the action is offered
 *   once and the warning says so plainly.
 *
 * No optimistic UI (SRS §23): every action reloads the employee from the server. */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Textarea } from '@/components/ui/Textarea';
import { EmptyState } from '@/components/ui/EmptyState';
import { PermissionGate } from '@/app/PermissionGate';
import { DataTable, type Column } from '@/components/data/DataTable';
import { AmountText } from '@/components/data/AmountText';
import { useEmployee } from '../hooks/useEmployees';
import { useEmployeeTypeOptions } from '../hooks/useEmployeeLookups';
import { formatDate } from '@/lib/dates';
import type { EmployeeAttendance, EmployeeSalary } from '@/types/domain';

export default function EmployeeDetailPage() {
  const navigate = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();

  const types = useEmployeeTypeOptions();
  const { detail, loading, error, busy, reload, archive } = useEmployee(employeeId);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>();

  if (loading && !detail) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div>
        <PageHeader title="Employee" />
        <ErrorState message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  if (!detail) {
    return (
      <div>
        <PageHeader title="Employee" />
        <Alert variant="warning">This employee could not be found.</Alert>
      </div>
    );
  }

  const { employee, recentAttendance, salaryHistory } = detail;

  const typeLabel =
    types.options.find((option) => option.value === employee.employeeTypeId)?.label ||
    employee.employeeTypeName ||
    '—';

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
      key: 'inTime',
      header: 'In',
      render: (row) => row.inTime || '—',
    },
    {
      key: 'outTime',
      header: 'Out',
      render: (row) => row.outTime || '—',
    },
    {
      key: 'overtimeHours',
      header: 'Overtime',
      align: 'right',
      render: (row) => (row.overtimeHours ? `${row.overtimeHours} h` : '—'),
    },
    {
      key: 'remarks',
      header: 'Remarks',
      render: (row) => row.remarks || '—',
    },
  ];

  const salaryColumns: Column<EmployeeSalary>[] = [
    {
      key: 'periodKey',
      header: 'Period',
      render: (row) => row.periodKey,
    },
    {
      key: 'presentDays',
      header: 'Present',
      align: 'right',
      render: (row) => row.presentDays || '0',
    },
    {
      key: 'baseSalary',
      header: 'Base',
      align: 'right',
      render: (row) => <AmountText amount={Number(row.baseSalary) || 0} />,
    },
    {
      key: 'netSalary',
      header: 'Net (server-computed)',
      align: 'right',
      render: (row) => <AmountText amount={Number(row.netSalary) || 0} />,
    },
    {
      key: 'statusKey',
      header: 'Status',
      render: (row) => <StatusBadge statusKey={row.statusKey} />,
    },
  ];

  const overview = (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      {error ? <Alert variant="danger">{error}</Alert> : null}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <PermissionGate permission="employees.write">
          <Button
            variant="ghost"
            icon={<Icon name="edit" size={16} />}
            onClick={() => navigate(`/employees/${employee.employeeId}/edit`)}
            disabled={busy}
          >
            Edit
          </Button>
        </PermissionGate>
      </div>

      <DescriptionList
        columns={2}
        items={[
          { label: 'Employee code', value: employee.employeeCode },
          { label: 'Type', value: typeLabel },
          { label: 'Status', value: <StatusBadge statusKey={employee.statusKey} /> },
          { label: 'Joined', value: employee.joinDate ? formatDate(employee.joinDate) : '—' },
          {
            label: 'Monthly salary',
            value: <AmountText amount={Number(employee.monthlySalary) || 0} />,
          },
          { label: 'Exit date', value: employee.exitDate ? formatDate(employee.exitDate) : '—' },
          { label: 'Mobile', value: employee.mobile || '—' },
          { label: 'Alternate mobile', value: employee.altMobile || '—' },
          { label: 'Email', value: employee.email || '—' },
          {
            label: 'Emergency contact',
            value:
              employee.emergencyName || employee.emergencyMobile
                ? `${employee.emergencyName || '—'} · ${employee.emergencyMobile || '—'}`
                : '—',
          },
          { label: 'Bank', value: employee.bankName || '—' },
          { label: 'Account number', value: employee.bankAccount || '—' },
          { label: 'IFSC', value: employee.ifsc || '—' },
          {
            label: 'ID proof',
            value:
              employee.idProofType || employee.idProofNumber
                ? `${employee.idProofType || '—'} · ${employee.idProofNumber || '—'}`
                : '—',
          },
          { label: 'Address', value: employee.address || '—', span: 2 },
          { label: 'Notes', value: employee.notes || '—', span: 2 },
        ]}
      />
    </div>
  );

  const attendanceTab = (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      {recentAttendance.length === 0 ? (
        <EmptyState
          title="No attendance recorded"
          description="Attendance for this employee will appear here once it is marked."
        />
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            The 30 most recent days. Mark attendance for the whole staff from the Attendance screen.
          </p>
          <DataTable
            columns={attendanceColumns}
            data={recentAttendance}
            getRowId={(row) => row.attendanceId}
            emptyTitle="No attendance recorded"
          />
        </>
      )}
    </div>
  );

  const salaryTab = (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      {salaryHistory.length === 0 ? (
        <EmptyState
          title="No salary records"
          description="This employee has no salary run yet. Prepare one from the Salary screen."
        />
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            The 12 most recent months. The net amount is computed by the server from the stored
            components — it is never recalculated here.
          </p>
          <DataTable
            columns={salaryColumns}
            data={salaryHistory}
            getRowId={(row) => row.salaryId}
            emptyTitle="No salary records"
          />
        </>
      )}
    </div>
  );

  const record = (
    <DescriptionList
      columns={2}
      items={[
        { label: 'Employee id', value: employee.employeeId },
        { label: 'Employee code', value: employee.employeeCode },
        { label: 'Type id', value: employee.employeeTypeId },
        { label: 'Status', value: <StatusBadge statusKey={employee.statusKey} /> },
        { label: 'Join date', value: employee.joinDate || '—' },
        { label: 'Exit date', value: employee.exitDate || '—' },
        { label: 'Attendance rows shown', value: String(recentAttendance.length) },
        { label: 'Salary rows shown', value: String(salaryHistory.length) },
      ]}
    />
  );

  const handleArchive = async () => {
    if (!reason.trim()) {
      setReasonError('A reason is required to archive.');
      return;
    }
    const ok = await archive(reason.trim());
    if (ok) {
      setArchiveOpen(false);
      setReason('');
      setReasonError(undefined);
    }
  };

  return (
    <div>
      <PageHeader
        title={employee.fullName}
        subtitle={`${employee.employeeCode} · ${typeLabel}`}
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Employees', route: '/employees', onClick: () => navigate('/employees') },
              { label: employee.employeeCode || employee.fullName },
            ]}
          />
        }
        actions={
          <PermissionGate permission="employees.write">
            {employee.statusKey !== 'ARCHIVED' ? (
              <Button
                variant="danger"
                icon={<Icon name="trash" size={16} />}
                onClick={() => setArchiveOpen(true)}
                disabled={busy}
              >
                Archive
              </Button>
            ) : null}
          </PermissionGate>
        }
      />

      {employee.statusKey === 'ARCHIVED' ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="warning">
            This employee is archived and exited
            {employee.exitDate ? ` on ${formatDate(employee.exitDate)}` : ''}. Their attendance and
            salary records are kept, and there is no un-archive action.
          </Alert>
        </div>
      ) : null}

      <Card>
        <CardBody>
          <Tabs
            tabs={[
              { key: 'overview', label: 'Overview', content: overview },
              {
                key: 'attendance',
                label: `Attendance${recentAttendance.length ? ` (${recentAttendance.length})` : ''}`,
                content: attendanceTab,
              },
              {
                key: 'salary',
                label: `Salary${salaryHistory.length ? ` (${salaryHistory.length})` : ''}`,
                content: salaryTab,
              },
              { key: 'record', label: 'Record', content: record },
            ]}
          />
        </CardBody>
      </Card>

      {/* ── Archive — the reason is mandatory (route validator). ── */}
      <Modal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archive employee"
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiveOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void handleArchive()} loading={busy}>
              Archive
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
            Archiving marks the employee as exited and stamps today as the exit date. The record,
            their attendance and their salary history are all kept. There is no un-archive action.
          </p>
          <FormField label="Reason" required error={reasonError} hint="Recorded in the audit trail.">
            <Textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError) setReasonError(undefined);
              }}
              rows={3}
              placeholder="e.g. Resigned; replaced by new security guard"
              error={reasonError}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
