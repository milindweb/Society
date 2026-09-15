/* RecentTable.tsx — Compact recent-activity table (FE-04)
 * SRS §2: "Recent notices and complaints should be displayed in compact tables, not large cards."
 * design.md §6: compact activity tables on the dashboard.
 * Permission-gated via PermissionGate so a section renders only when the caller may read it. */

import { type ReactNode } from 'react';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/data/DataTable';
import { PermissionGate } from '@/app/PermissionGate';
import { Skeleton } from '@/components/ui/Skeleton';

interface RecentTableProps<T> {
  title: string;
  permission: string;
  columns: Column<T>[];
  data: T[];
  loading: boolean;
  getRowId: (row: T) => string;
  emptyTitle: string;
  onRowClick?: (row: T) => void;
  action?: ReactNode;
}

export function RecentTable<T>({
  title,
  permission,
  columns,
  data,
  loading,
  getRowId,
  emptyTitle,
  onRowClick,
  action,
}: RecentTableProps<T>) {
  return (
    <PermissionGate permission={permission}>
      <Card>
        <CardHeader title={title} action={action} />
        <CardBody>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Skeleton height={16} />
              <Skeleton height={16} />
              <Skeleton height={16} />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={data}
              getRowId={getRowId}
              emptyTitle={emptyTitle}
              onRowClick={onRowClick}
            />
          )}
        </CardBody>
      </Card>
    </PermissionGate>
  );
}
