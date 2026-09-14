/* DataListMobile.tsx — design.md §6: mobile list view for complex tables */

import { type ReactNode } from 'react';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';

interface DataListMobileProps<T> {
  data: T[];
  loading?: boolean;
  render: (item: T, index: number) => ReactNode;
  emptyTitle?: string;
  emptyAction?: ReactNode;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function DataListMobile<T>({
  data,
  loading = false,
  render,
  emptyTitle = 'No records found',
  emptyAction,
  onRowClick,
  className = '',
}: DataListMobileProps<T>) {
  if (loading) {
    return (
      <div className={className} style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <Spinner />
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

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {data.map((item, i) => (
        <div
          key={i}
          className="hs-card"
          onClick={onRowClick ? () => onRowClick(item) : undefined}
          style={onRowClick ? { cursor: 'pointer' } : undefined}
        >
          {render(item, i)}
        </div>
      ))}
    </div>
  );
}
