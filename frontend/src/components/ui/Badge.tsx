/* Badge.tsx — design.md §87: variant | size */

import { type ReactNode } from 'react';

type BadgeVariant = 'info' | 'success' | 'warning' | 'danger' | 'brand' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span className={`hs-badge hs-badge--${variant} ${className}`}>
      {children}
    </span>
  );
}
