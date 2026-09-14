/* Pagination.tsx — design.md §87: pagination controls */

import { IconButton } from './IconButton';
import { Icon } from './Icon';
import type { PageMeta } from '@/types/api';

interface PaginationProps {
  page: PageMeta;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page: { page, total, totalPages, hasNext, hasPrev }, onPageChange, className = '' }: PaginationProps) {
  return (
    <div className={`hs-pagination ${className}`}>
      <span className="hs-pagination__info">
        {total === 0 ? 'No records' : `Showing ${(page - 1) * total + 1}–${Math.min(page * total, total)} of ${total}`}
      </span>
      <div className="hs-pagination__controls">
        <IconButton
          icon={<Icon name="chevron-left" size={16} />}
          label="Previous page"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          variant="ghost"
          size="sm"
        />
        <span style={{ fontSize: 'var(--text-sm)', padding: '0 var(--space-2)' }}>
          {page} / {totalPages}
        </span>
        <IconButton
          icon={<Icon name="chevron-right" size={16} />}
          label="Next page"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          variant="ghost"
          size="sm"
        />
      </div>
    </div>
  );
}
