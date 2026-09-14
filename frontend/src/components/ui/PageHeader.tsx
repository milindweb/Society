/* PageHeader.tsx — design.md §36, §87 */

import { type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, breadcrumbs, className = '' }: PageHeaderProps) {
  return (
    <div className={`hs-page-header ${className}`}>
      <div className="hs-page-header__text">
        {breadcrumbs}
        <h1 className="hs-page-header__title">{title}</h1>
        {subtitle && <p className="hs-page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="hs-page-header__actions">{actions}</div>}
    </div>
  );
}
