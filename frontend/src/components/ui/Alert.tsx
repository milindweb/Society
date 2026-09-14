/* Alert.tsx — design.md §87 */

import { type ReactNode } from 'react';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

interface AlertProps {
  variant?: AlertVariant;
  children: ReactNode;
  className?: string;
}

export function Alert({ variant = 'info', children, className = '' }: AlertProps) {
  return (
    <div className={`hs-alert hs-alert--${variant} ${className}`} role="alert">
      {children}
    </div>
  );
}
