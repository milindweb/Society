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
  /** Permission required to see this entry.
   *
   * Omit it for a destination that any authenticated user may reach. Global
   * search (`/search`) is the case in point: the backend route declares
   * `permission: null` and filters the *groups* server-side by the caller's own
   * permissions instead of gating the route. Requiring a key here would have
   * hidden search from every non-admin, because only ADMIN is seeded into
   * `Role_Permissions` (`Setup.gs:268`). */
  permission?: string;
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
  /* Backup and Audit were built in FE-14 but never listed here, so both screens
   * were unreachable from the UI even for ADMIN. Gated on the same keys their
   * routes use: `backup.list`/`backup.create` need `backup.run` (Routes.gs:1033),
   * `audit.list`/`audit.get` need `audit.read` (Routes.gs:1055). The archive
   * screens hang off the Backup page (`archive.run` / `archive.read`) rather than
   * getting their own entries — the sidebar renders a flat list and ignores
   * `NavItem.children`. */
  { key: 'backup', label: 'Backup & Archive', icon: 'download', route: '/settings/backup', permission: 'backup.run' },
  { key: 'audit', label: 'Audit Trail', icon: 'eye', route: '/settings/audit', permission: 'audit.read' },
  /* Search carries no permission on purpose — see the NavItem doc comment. */
  { key: 'search', label: 'Search', icon: 'search', route: '/search' },
  { key: 'settings', label: 'Settings', icon: 'settings', route: '/settings', permission: 'config.read' },
  /* User and role administration sit beside Settings but are gated on their own
   * keys, because `config.read` is not enough to read them: every `users.*` route
   * needs `users.manage` (Routes.gs:1076) and the role/permission reads need
   * `roles.read` (Routes.gs:1125). Listing them under `config.read` would show a
   * nav entry whose page immediately fails. */
  { key: 'users', label: 'Users', icon: 'user', route: '/settings/users', permission: 'users.manage' },
  { key: 'roles', label: 'Roles & Permissions', icon: 'lock', route: '/settings/roles', permission: 'roles.read' },
];

/** Nav entries visible to a user, in sidebar order.
 *
 * An entry with no `permission` is always visible (it is reachable by any
 * authenticated user), but note that a user holding NO permissions at all would
 * still see it — which is why `getFirstPermittedRoute` below deliberately
 * ignores permission-less entries when choosing a landing page. */
export function filterNavByPermissions(permissions: string[]): NavItem[] {
  return MODULE_NAV.filter((item) => isNavItemPermitted(item, permissions));
}

function isNavItemPermitted(item: NavItem, permissions: string[]): boolean {
  return !item.permission || hasPermission(permissions, item.permission);
}

/** The page to land a user on after login.
 *
 * Only entries that require a permission are considered. Landing on a
 * permission-less entry such as Search would be wrong: a user with no
 * permissions at all must be sent to `/forbidden`, not into a search box that
 * could only ever return nothing. */
export function getFirstPermittedRoute(permissions: string[]): string {
  const nav = MODULE_NAV.filter(
    (item) => Boolean(item.permission) && isNavItemPermitted(item, permissions),
  );
  return nav.length > 0 ? nav[0]!.route : '/forbidden';
}
