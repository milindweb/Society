/* ProtectedRoute.tsx — frontend-architecture.md §3: route guard */

import { Navigate, Outlet } from 'react-router-dom';
import { authStore } from '@/state/authStore';
import { hasPermission } from '@/lib/permission';

interface ProtectedRouteProps {
  permission?: string;
}

export function ProtectedRoute({ permission }: ProtectedRouteProps) {
  const { token, user } = authStore;

  if (!token || !user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (permission && !hasPermission(user.permissions, permission)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}
