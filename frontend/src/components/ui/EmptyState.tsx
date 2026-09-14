/* EmptyState.tsx — design.md §6: empty state with icon, reason and action */

import { type ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`hs-empty-state ${className}`}>
      {icon && <div className="hs-empty-state__icon">{icon}</div>}
      <h3 className="hs-empty-state__title">{title}</h3>
      {description && <p className="hs-empty-state__description">{description}</p>}
      {action}
    </div>
  );
}
