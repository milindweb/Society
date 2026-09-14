/* PaginationBar.tsx — wrapper for pagination + list controls */

import { type ReactNode } from 'react';
import { Pagination } from '../ui/Pagination';
import type { PageMeta } from '@/types/api';

interface PaginationBarProps {
  page: PageMeta;
  onPageChange: (page: number) => void;
  left?: ReactNode;
  className?: string;
}

export function PaginationBar({ page, onPageChange, left, className = '' }: PaginationBarProps) {
  return (
    <div className={`hs-pagination ${className}`} style={{ justifyContent: 'space-between' }}>
      {left ?? <span />}
      <Pagination page={page} onPageChange={onPageChange} />
    </div>
  );
}
