/* DescriptionList.tsx — design.md §37: label/value pairs for detail pages */

import { type ReactNode } from 'react';

export interface DescriptionItem {
  label: string;
  value: ReactNode;
  span?: 1 | 2;
}

interface DescriptionListProps {
  items: DescriptionItem[];
  columns?: 1 | 2;
  className?: string;
}

export function DescriptionList({ items, columns = 1, className = '' }: DescriptionListProps) {
  return (
    <dl
      className={`hs-desc-list ${columns === 2 ? 'hs-desc-list--two' : ''} ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: columns === 2 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
        gap: 'var(--space-3) var(--space-6)',
        margin: 0,
      }}
    >
      {items.map((item, i) => (
        <div
          key={`${item.label}-${i}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
            gridColumn: item.span === 2 ? '1 / -1' : undefined,
            minWidth: 0,
          }}
        >
          <dt
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {item.label}
          </dt>
          <dd
            style={{
              margin: 0,
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text)',
              overflowWrap: 'anywhere',
            }}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
