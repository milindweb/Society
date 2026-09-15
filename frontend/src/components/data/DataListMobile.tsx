/* DataListMobile.tsx — design.md §6: mobile list view for complex tables
 *
 * FE-15 hardening:
 *  - clickable cards were `<div onClick>` with no keyboard path; they now take
 *    focus and activate on Enter/Space (design.md §7 "keyboard reachability").
 *  - the loading state was a bare `Spinner` — replaced with skeleton cards.
 *  - cards were keyed by array index, so a refetch that reordered rows reused
 *    the wrong DOM nodes; `getRowId` allows a stable identity.
 *  - a tap on a control inside the card no longer also triggers the row action. */

import { type KeyboardEvent, type ReactNode } from 'react';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';

interface DataListMobileProps<T> {
  data: T[];
  loading?: boolean;
  render: (item: T, index: number) => ReactNode;
  emptyTitle?: string;
  emptyAction?: ReactNode;
  onRowClick?: (item: T) => void;
  /** Stable identity for React keys; falls back to the array index. */
  getRowId?: (item: T) => string;
  /** Accessible name for a clickable card. */
  getRowLabel?: (item: T, index: number) => string;
  /** Skeleton cards shown while `loading` (default 4). */
  skeletonItems?: number;
  className?: string;
}

const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, label, [role="button"]';

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;
}

export function DataListMobile<T>({
  data,
  loading = false,
  render,
  emptyTitle = 'No records found',
  emptyAction,
  onRowClick,
  getRowId,
  getRowLabel,
  skeletonItems = 4,
  className = '',
}: DataListMobileProps<T>) {
  if (loading) {
    return (
      <div
        className={className}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
        role="status"
        aria-busy="true"
      >
        <span className="hs-sr-only">Loading records</span>
        {Array.from({ length: skeletonItems }, (_, index) => (
          <div key={index} className="hs-card" style={{ padding: 'var(--space-4)' }}>
            <Skeleton variant="title" />
            <div style={{ height: 'var(--space-2)' }} />
            <Skeleton variant="text" />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        icon={<Icon name="search" size={40} />}
        action={emptyAction}
        className={className}
      />
    );
  }

  const handleKeyDown = (item: T) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onRowClick) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onRowClick(item);
  };

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {data.map((item, i) => (
        <div
          key={getRowId?.(item) ?? i}
          className={onRowClick ? 'hs-card hs-card--clickable' : 'hs-card'}
          tabIndex={onRowClick ? 0 : undefined}
          aria-label={onRowClick ? getRowLabel?.(item, i) : undefined}
          onClick={
            onRowClick
              ? (event) => {
                  if (isInteractiveTarget(event.target)) return;
                  onRowClick(item);
                }
              : undefined
          }
          onKeyDown={handleKeyDown(item)}
        >
          {render(item, i)}
        </div>
      ))}
    </div>
  );
}
