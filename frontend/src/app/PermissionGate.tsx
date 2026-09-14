/* PermissionGate.tsx — design.md §5: conditional render by permission */

import { type ReactNode } from 'react';
import { authStore } from '@/state/authStore';
import { hasPermission } from '@/lib/permission';

interface PermissionGateProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const { user } = authStore;

  if (!user || !hasPermission(user.permissions, permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
