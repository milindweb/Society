/* DataTable.tsx — design.md §6: list page pattern (desktop table)
 *
 * FE-15 hardening:
 *  - sorting was an `onClick` on `<th>`, which no keyboard user could reach and
 *    which announced nothing to a screen reader. It is now a real `<button>`
 *    inside the header cell, with `aria-sort` on the cell (design.md §7).
 *  - a clickable row was a bare `<tr onClick>` — likewise unreachable. Rows now
 *    take focus and activate on Enter/Space. The `<tr>` keeps its native row
 *    role rather than becoming `role="button"`, so table semantics survive for
 *    screen readers; `getRowLabel` lets a page supply the action name.
 *  - a row click no longer fires when the click landed on a control inside the
 *    row (action buttons in the last column were both acting *and* navigating).
 *  - the loading state was a bare `Spinner`; frontend-architecture.md §7 asks
 *    for a skeleton that matches the final layout. */

import { type KeyboardEvent, type ReactNode } from 'react';
import { Skeleton } from '../ui/Skeleton';
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
  /** Accessible name for a clickable row, e.g. `(r) => \`Open ${r.flatNumber}\``.
   *  Falls back to the row's own cell text when omitted. */
  getRowLabel?: (row: T, index: number) => string;
  /** Skeleton rows shown while `loading` (default 5). */
  skeletonRows?: number;
  className?: string;
}

/** Interactive elements inside a row must not also trigger row navigation. */
const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, label, [role="button"]';

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;
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
  getRowLabel,
  skeletonRows = 5,
  className = '',
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className={`hs-card hs-table-wrap ${className}`} role="status" aria-busy="true">
        <span className="hs-sr-only">Loading records</span>
        <table className="hs-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={{ textAlign: col.align }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: skeletonRows }, (_, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((col) => (
                  <td key={col.key}>
                    <Skeleton variant="text" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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

  const handleRowKeyDown = (row: T) => (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (!onRowClick) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    /* Space would otherwise scroll the page. */
    event.preventDefault();
    onRowClick(row);
  };

  return (
    <div className={`hs-overflow-x-auto ${className}`}>
      <table className="hs-table">
        <thead>
          <tr>
            {columns.map((col) => {
              const isSorted = sort?.key === col.key;
              const ariaSort = col.sortable
                ? isSorted
                  ? sort?.dir === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
                : undefined;

              return (
                <th key={col.key} aria-sort={ariaSort} style={{ textAlign: col.align }}>
                  {col.sortable ? (
                    <button
                      type="button"
                      className="hs-table__sort"
                      onClick={() => onSort?.(col.key)}
                    >
                      {col.header}
                      {isSorted && (
                        <Icon name={sort?.dir === 'asc' ? 'chevron-up' : 'chevron-down'} size={14} />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={getRowId?.(row) ?? i}
              className={onRowClick ? 'hs-table__row--clickable' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              aria-label={onRowClick ? getRowLabel?.(row, i) : undefined}
              onClick={
                onRowClick
                  ? (event) => {
                      if (isInteractiveTarget(event.target)) return;
                      onRowClick(row);
                    }
                  : undefined
              }
              onKeyDown={handleRowKeyDown(row)}
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
