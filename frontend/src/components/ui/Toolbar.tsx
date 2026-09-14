/* Toolbar.tsx — design.md §37, §87 */

import { type ReactNode } from 'react';

interface ToolbarProps {
  children: ReactNode;
  className?: string;
}

export function Toolbar({ children, className = '' }: ToolbarProps) {
  return (
    <div className={`hs-toolbar ${className}`} role="toolbar">
      {children}
    </div>
  );
}
