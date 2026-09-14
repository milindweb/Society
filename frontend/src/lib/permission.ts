/* permission.ts — Permission checking helpers (design.md §5 — nav derived from permissions) */

export function hasPermission(userPermissions: string[], required: string): boolean {
  if (!Array.isArray(userPermissions)) return false;
  if (userPermissions.includes('*')) return true;
  return userPermissions.includes(required);
}

export function hasAnyPermission(userPermissions: string[], required: string[]): boolean {
  return required.some((p) => hasPermission(userPermissions, p));
}

export function hasAllPermissions(userPermissions: string[], required: string[]): boolean {
  return required.every((p) => hasPermission(userPermissions, p));
}

export interface NavItem {
  key: string;
  label: string;
  icon: string;
  route: string;
  permission: string;
  children?: NavItem[];
}

const MODULE_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: '/dashboard', permission: 'dashboard.read' },
  { key: 'members', label: 'Members', icon: 'members', route: '/members', permission: 'members.read' },
  { key: 'flats', label: 'Flats', icon: 'flats', route: '/flats', permission: 'flats.read' },
  { key: 'maintenance', label: 'Maintenance', icon: 'maintenance', route: '/maintenance', permission: 'maintenance.read' },
  { key: 'payments', label: 'Payments', icon: 'payments', route: '/payments', permission: 'payments.read' },
  { key: 'complaints', label: 'Complaints', icon: 'complaints', route: '/complaints', permission: 'complaints.read' },
  { key: 'visitors', label: 'Visitors', icon: 'visitors', route: '/visitors', permission: 'visitors.read' },
  { key: 'notices', label: 'Notices', icon: 'notices', route: '/notices', permission: 'notices.read' },
  { key: 'meetings', label: 'Meetings', icon: 'meetings', route: '/meetings', permission: 'meetings.read' },
  { key: 'documents', label: 'Documents', icon: 'documents', route: '/documents', permission: 'documents.read' },
  { key: 'parking', label: 'Parking', icon: 'parking', route: '/parking', permission: 'parking.read' },
  { key: 'employees', label: 'Employees', icon: 'employees', route: '/employees', permission: 'employees.read' },
  { key: 'expenses', label: 'Expenses', icon: 'expenses', route: '/expenses', permission: 'expenses.read' },
  { key: 'reports', label: 'Reports', icon: 'reports', route: '/reports', permission: 'reports.read' },
  { key: 'settings', label: 'Settings', icon: 'settings', route: '/settings', permission: 'config.read' },
];

export function filterNavByPermissions(permissions: string[]): NavItem[] {
  return MODULE_NAV.filter((item) => hasPermission(permissions, item.permission));
}

export function getFirstPermittedRoute(permissions: string[]): string {
  const nav = filterNavByPermissions(permissions);
  return nav.length > 0 ? nav[0]!.route : '/forbidden';
}
