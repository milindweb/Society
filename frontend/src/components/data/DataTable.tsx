/* DataTable.tsx — design.md §6: list page pattern (desktop table) */

import { type ReactNode } from 'react';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (row: T, index: number) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  sort?: { key: string; dir: 'asc' | 'desc' };
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyTitle = 'No records found',
  emptyDescription,
  emptyAction,
  sort,
  onSort,
  onRowClick,
  getRowId,
  className = '',
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className={`hs-card ${className}`} style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <Spinner />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={<Icon name="search" size={40} />}
        action={emptyAction}
        className={className}
      />
    );
  }

  return (
    <div className={`hs-overflow-x-auto ${className}`}>
      <table className="hs-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={col.sortable ? 'hs-table__th--sortable' : ''}
                style={{ textAlign: col.align }}
                onClick={col.sortable ? () => onSort?.(col.key) : undefined}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                  {col.header}
                  {col.sortable && sort?.key === col.key && (
                    <Icon name={sort.dir === 'asc' ? 'chevron-up' : 'chevron-down'} size={14} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={getRowId?.(row) ?? i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map((col) => (
                <td key={col.key} className={col.className} style={{ textAlign: col.align }}>
                  {col.render ? col.render(row, i) : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
