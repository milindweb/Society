/* KpiCard.tsx — design.md §39, §80: KPI display */

import { type ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: string; direction: 'up' | 'down' };
  className?: string;
}

export function KpiCard({ label, value, icon, trend, className = '' }: KpiCardProps) {
  return (
    <div className={`hs-kpi ${className}`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="hs-kpi__label">{label}</div>
          <div className="hs-kpi__value">{value}</div>
        </div>
        {icon && <div style={{ color: 'var(--color-text-muted)' }}>{icon}</div>}
      </div>
      {trend && (
        <div className={`hs-kpi__trend hs-kpi__trend--${trend.direction}`}>
          {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
        </div>
      )}
    </div>
  );
}
