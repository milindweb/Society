/* EmployeeListPage.tsx — FE-10
 * design.md §6 list-page pattern: PageHeader → FilterBar → DataTable → Pagination.
 * frontend-architecture.md §1: no fetching in pages — useEmployeeList owns it.
 *
 * SRS §11: the employee master — code, name, type, contact, status.
 *
 * Contract notes (verified against HRService.gs:90-109):
 * - `employees.list` filters on employeeTypeId + statusKey ONLY. There is NO
 *   server-side search, so no search box is offered rather than one that silently
 *   does nothing (the same decision as FE-07 visitors and FE-09 documents).
 * - `monthlySalary` is a STRING on the sheet; it is parsed here only for display.
 * - Archived employees are NOT hidden by the server — `employees.list` returns
 *   whatever `statusKey` filter was asked for, so the default filter explicitly
 *   asks for ACTIVE and the user can switch to All. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Select } from '@/components/ui/Select';
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
import { useEmployeeList } from '../hooks/useEmployees';
import { useEmployeeTypeOptions, useEmployeeStatusOptions } from '../hooks/useEmployeeLookups';
import { formatDate } from '@/lib/dates';
import { ExportButton } from '@/components/ui/ExportButton';
import type { Employee } from '@/types/domain';

export default function EmployeeListPage() {
  const navigate = useNavigate();

  const [employeeTypeId, setEmployeeTypeId] = useState('');
  const [statusKey, setStatusKey] = useState('ACTIVE');

  const types = useEmployeeTypeOptions();
  const statuses = useEmployeeStatusOptions();

  const { employees, page, loading, error, setFilters, setPage, reload } = useEmployeeList({
    employeeTypeId: employeeTypeId || undefined,
    statusKey: statusKey || undefined,
  });

  const typeLabel = (row: Employee) =>
    types.options.find((option) => option.value === row.employeeTypeId)?.label ||
    row.employeeTypeName ||
    '—';

  const columns: Column<Employee>[] = [
    {
      key: 'fullName',
      header: 'Employee',
      render: (row) => (
        <div>
          <div>{row.fullName}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {row.employeeCode}
            {` · ${typeLabel(row)}`}
          </div>
        </div>
      ),
    },
    {
      key: 'mobile',
      header: 'Contact',
      render: (row) => (
        <div>
          <div>{row.mobile || '—'}</div>
          {row.email ? (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {row.email}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'joinDate',
      header: 'Joined',
      render: (row) => (row.joinDate ? formatDate(row.joinDate) : '—'),
    },
    {
      key: 'monthlySalary',
      header: 'Monthly salary',
      align: 'right',
      render: (row) => <AmountText amount={Number(row.monthlySalary) || 0} />,
    },
    {
      key: 'statusKey',
      header: 'Status',
      render: (row) => <StatusBadge statusKey={row.statusKey} />,
    },
  ];

  const renderMobile = (row: Employee) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <strong>{row.fullName}</strong>
        <StatusBadge statusKey={row.statusKey} />
      </div>
      <div
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          marginTop: 'var(--space-1)',
        }}
      >
        {row.employeeCode} · {typeLabel(row)}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
        {row.mobile || 'No mobile'} · joined {row.joinDate ? formatDate(row.joinDate) : '—'}
      </div>
    </div>
  );

  const body = (() => {
    if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
    if (loading) return <Skeleton height={240} variant="rect" />;
    if (employees.length === 0) {
      return (
        <EmptyState
          title="No employees found"
          description={
            employeeTypeId || statusKey !== 'ACTIVE'
              ? 'No employee matches the current filters.'
              : 'No employees have been added yet.'
          }
        />
      );
    }
    return (
      <>
        <div className="hs-only-desktop">
          <DataTable
            columns={columns}
            data={employees}
            getRowId={(row) => row.employeeId}
            onRowClick={(row) => navigate(`/employees/${row.employeeId}`)}
            emptyTitle="No employees found"
          />
        </div>
        <div className="hs-only-mobile">
          <DataListMobile
            data={employees}
            render={renderMobile}
            onRowClick={(row) => navigate(`/employees/${row.employeeId}`)}
            emptyTitle="No employees found"
          />
        </div>
        <PaginationBar page={page} onPageChange={setPage} />
      </>
    );
  })();

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Society staff — security, housekeeping, maintenance and office"
        actions={
          <>
            <ExportButton columns={columns} data={employees} filename="employees-list" />
            <PermissionGate permission="employees.write">
              <Button icon={<Icon name="plus" size={16} />} onClick={() => navigate('/employees/new')}>
                Add employee
              </Button>
            </PermissionGate>
          </>
        }
      />

      <Card>
        <CardBody>
          <FilterBar>
            <Select
              aria-label="Filter by employee type"
              value={employeeTypeId}
              options={[{ value: '', label: 'All types' }, ...types.options]}
              onChange={(e) => {
                setEmployeeTypeId(e.target.value);
                setFilters({ employeeTypeId: e.target.value || undefined });
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
            The server filters by employee type and status. Archived employees keep their records and
            appear here when you include them.
          </p>
        </CardBody>
      </Card>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardBody>{body}</CardBody>
      </Card>
    </div>
  );
}
