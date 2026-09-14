/* StatusBadge.tsx — design.md §8: status key → tone → badge */

import { getStatusTone, getStatusLabel } from '@/lib/statusTone';
import { Badge } from './Badge';

interface StatusBadgeProps {
  statusKey: string;
  className?: string;
}

export function StatusBadge({ statusKey, className = '' }: StatusBadgeProps) {
  const tone = getStatusTone(statusKey);
  const label = getStatusLabel(statusKey);

  return (
    <Badge variant={tone} className={className}>
      {label}
    </Badge>
  );
}
