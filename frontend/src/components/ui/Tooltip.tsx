/* Tooltip.tsx — design.md §87 */

import { type ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className = '' }: TooltipProps) {
  return (
    <span className={`hs-tooltip ${className}`}>
      <span className="hs-tooltip__trigger">{children}</span>
      <span className="hs-tooltip__content" role="tooltip">
        {content}
      </span>
    </span>
  );
}
