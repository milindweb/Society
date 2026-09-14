/* ErrorState.tsx — design.md §6: error state with retry */

import { type ReactNode } from 'react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message: string;
  requestId?: string;
  onRetry?: () => void;
  icon?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  requestId,
  onRetry,
  icon,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`hs-error-state ${className}`}>
      {icon && <div className="hs-error-state__icon">{icon}</div>}
      <h3 className="hs-empty-state__title">{title}</h3>
      <p className="hs-empty-state__description">{message}</p>
      {requestId && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
          Request ID: {requestId}
        </p>
      )}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
