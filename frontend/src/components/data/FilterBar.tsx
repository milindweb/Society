/* FilterBar.tsx — design.md §6: list page toolbar for filters */

import { type ReactNode } from 'react';

interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

export function FilterBar({ children, className = '' }: FilterBarProps) {
  return (
    <div className={`hs-toolbar ${className}`} role="search">
      {children}
    </div>
  );
}
