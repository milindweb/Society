/* userService.ts — FE-13 user, role and permission administration
 * Verified against backend/src/{Routes,AuthService,Repository}.gs.
 *
 * SRS §1: "Admin can control which modules/actions each role can access" and
 * "No role, permission or user mapping should be hardcoded." The permission
 * matrix below is what satisfies the first half; this module holds no role key,
 * permission key or module name as a literal, so the second half holds too.
 *
 * Server-enforced rules the UI must respect:
 *
 * - Every `users.*` route is gated on **`users.manage`**; `roles.list`,
 *   `permissions.list` and `roles.permissions.get` need **`roles.read`**;
 *   `roles.create/update/setStatus` and `roles.permissions.update` need
 *   **`roles.manage`**.
 * - `users.create` requires `username`, `email`, `fullName`, `roleKeys` **and**
 *   `temporaryPassword`. The server validates the password and rejects a
 *   username or email that already exists with `CONFLICT_ERROR`.
 * - `users.update` accepts only `username, email, mobile, fullName, memberId,
 *   employeeId, flatId, roleKeys` (AuthService.gs:850). `roleKeys` is converted
 *   to CSV server-side, so an array is fine.
 * - `users.setStatus` accepts **`ACTIVE`, `INACTIVE` or `LOCKED`** — not the
 *   two-value set the master entities use. Any non-ACTIVE status **revokes all
 *   of that user's sessions** (AuthService.gs:912).
 * - `users.resetPassword` needs a `temporaryPassword` and forces
 *   `mustChangePassword`, then revokes sessions.
 * - `roles.create` upper-cases `roleKey` and rejects a duplicate with
 *   `CONFLICT_ERROR`.
 * - `roles.update`/`roles.setStatus` key on **`roleKey`**, not a numeric id.
 * - `roles.setStatus` to INACTIVE returns `DEPENDENCY_EXISTS` when active users
 *   still hold the role (AuthService.gs:1085).
 * - `roles.permissions.update` requires a **non-empty `entries[]`**
 *   (AuthService.gs:1176) — an empty array is a VALIDATION_ERROR, so the UI must
 *   send only the rows that actually changed.
 * - `roles.permissions.get` returns a sparse map: a permission key that is
 *   absent has no row, which is equivalent to denied.
 *
 * There is a second, older way to write roles: the `roles` master entity
 * (`config.entity.*`). Both write the same `Roles` sheet, but the entity path
 * exposes the column as `status` while `AuthService` exposes it as `statusKey`.
 * This module uses the `AuthService` routes because they also carry the
 * permission matrix and the role-in-use check. */

import { apiClient } from './apiClient';
import { generateClientId } from '@/lib/idempotency';
import { ApiClientError } from '@/types/api';
import type { Paginated, PaginationParams } from '@/types/api';
import type {
  Permission,
  Role,
  RolePermissionEntry,
  RolePermissionMatrix,
  UserDetail,
  UserRow,
} from '@/types/domain';

/* ── Users ───────────────────────────────────────────────────────────────── */

/** The three statuses `users.setStatus` accepts (AuthService.gs:892).
 * Deliberately not the two-value `EntityStatus` the master entities use. */
export const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'LOCKED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface UserListParams extends PaginationParams {
  statusKey?: string;
  /** Matched in memory against the user's CSV `roleKeys`. */
  roleKey?: string;
}

export async function listUsers(params: UserListParams = {}): Promise<Paginated<UserRow>> {
  return apiClient<Paginated<UserRow>>({ action: 'users.list', payload: params });
}

export async function getUser(userId: string): Promise<UserDetail> {
  return apiClient<UserDetail>({ action: 'users.get', payload: { userId } });
}

export interface CreateUserInput {
  username: string;
  email: string;
  fullName: string;
  roleKeys: string[];
  temporaryPassword: string;
  mobile?: string;
  memberId?: string;
  employeeId?: string;
  flatId?: string;
}

export async function createUser(input: CreateUserInput): Promise<UserRow> {
  return apiClient<UserRow>({
    action: 'users.create',
    payload: { ...input, clientRequestId: generateClientId() },
  });
}

/** Only these keys reach the sheet — the server drops anything else. */
export interface UpdateUserValues {
  username?: string;
  email?: string;
  mobile?: string;
  fullName?: string;
  memberId?: string;
  employeeId?: string;
  flatId?: string;
  roleKeys?: string[];
}

export async function updateUser(userId: string, values: UpdateUserValues): Promise<UserRow> {
  return apiClient<UserRow>({
    action: 'users.update',
    payload: { userId, values, clientRequestId: generateClientId() },
  });
}

export async function setUserStatus(userId: string, status: UserStatus): Promise<UserRow> {
  return apiClient<UserRow>({
    action: 'users.setStatus',
    payload: { userId, status, clientRequestId: generateClientId() },
  });
}

export async function resetUserPassword(
  userId: string,
  temporaryPassword: string,
): Promise<UserRow> {
  return apiClient<UserRow>({
    action: 'users.resetPassword',
    payload: { userId, temporaryPassword, clientRequestId: generateClientId() },
  });
}

/* ── Roles ───────────────────────────────────────────────────────────────── */

export interface RoleListParams extends PaginationParams {
  /** The server maps this onto the `status` column. */
  status?: string;
}

export async function listRoles(params: RoleListParams = {}): Promise<Paginated<Role>> {
  return apiClient<Paginated<Role>>({ action: 'roles.list', payload: params });
}

/** `roles.create` upper-cases `roleKey` and defaults `status` to ACTIVE. */
export async function createRole(input: {
  roleKey: string;
  roleName: string;
  description?: string;
}): Promise<Role> {
  return apiClient<Role>({
    action: 'roles.create',
    payload: { ...input, clientRequestId: generateClientId() },
  });
}

export async function updateRole(
  roleKey: string,
  values: { roleName?: string; description?: string },
): Promise<Role> {
  return apiClient<Role>({
    action: 'roles.update',
    payload: { roleKey, values, clientRequestId: generateClientId() },
  });
}

export async function setRoleStatus(
  roleKey: string,
  status: 'ACTIVE' | 'INACTIVE',
): Promise<Role> {
  return apiClient<Role>({
    action: 'roles.setStatus',
    payload: { roleKey, status, clientRequestId: generateClientId() },
  });
}

/* ── Permissions ─────────────────────────────────────────────────────────── */

/** The permission catalog, optionally narrowed to one module.
 *
 * The server pages this at 1000 rows and ignores `page`, so every seeded
 * permission always arrives in one response. */
export async function listPermissions(module?: string): Promise<Permission[]> {
  const data = await apiClient<Permission[]>({
    action: 'permissions.list',
    payload: module ? { module } : undefined,
  });
  return Array.isArray(data) ? data : [];
}

export async function getRolePermissions(roleKey: string): Promise<RolePermissionMatrix> {
  return apiClient<RolePermissionMatrix>({
    action: 'roles.permissions.get',
    payload: { roleKey },
  });
}

/** Replace part of a role's matrix. `entries` must be non-empty. */
export async function updateRolePermissions(
  roleKey: string,
  entries: RolePermissionEntry[],
): Promise<RolePermissionMatrix> {
  return apiClient<RolePermissionMatrix>({
    action: 'roles.permissions.update',
    payload: { roleKey, entries, clientRequestId: generateClientId() },
  });
}

/* ── Presentation helpers (no hardcoded keys) ────────────────────────────── */

export interface PermissionGroup {
  module: string;
  permissions: Permission[];
}

/** Group the catalog by its own `module` column.
 *
 * The module list is whatever the `Permissions` sheet contains — there is no
 * client-side module table to fall out of date. Groups are sorted by module
 * name, and permissions within a group by key, for a stable matrix. */
export function groupPermissionsByModule(catalog: Permission[]): PermissionGroup[] {
  const groups = new Map<string, Permission[]>();
  for (const permission of catalog) {
    const module = permission.module || 'other';
    const bucket = groups.get(module);
    if (bucket) {
      bucket.push(permission);
    } else {
      groups.set(module, [permission]);
    }
  }
  return Array.from(groups.entries())
    .map(([module, permissions]) => ({
      module,
      permissions: [...permissions].sort((a, b) =>
        a.permissionKey.localeCompare(b.permissionKey),
      ),
    }))
    .sort((a, b) => a.module.localeCompare(b.module));
}

/** Human label for a permission row.
 *
 * The catalog serves `description`, and a seeded row may leave it empty, so the
 * key is the fallback. `module.action` is already readable
 * (`complaints.write`, `payments.reverse`). */
export function permissionLabel(permission: Permission): string {
  return permission.description || permission.permissionKey;
}

/** The `action` half of a permission key, for a compact matrix column label. */
export function permissionAction(permission: Permission): string {
  return permission.action || permission.permissionKey.split('.')[1] || permission.permissionKey;
}

/** Whether a permission is granted, given a sparse matrix.
 *
 * An absent key means no `Role_Permissions` row exists — which denies. Only
 * ADMIN is seeded (`Setup.gs:268`), so this is the normal case for a new role. */
export function isGranted(matrix: RolePermissionMatrix | null, permissionKey: string): boolean {
  return matrix?.permissions?.[permissionKey] === true;
}

/** Diff a proposed selection against the stored matrix.
 *
 * `roles.permissions.update` rejects an empty `entries[]`, and sending
 * unchanged rows would rewrite the sheet for no reason, so only real changes
 * are returned. This is also what makes the Save button's enabled state honest. */
export function diffPermissions(
  matrix: RolePermissionMatrix | null,
  draft: Record<string, boolean>,
): RolePermissionEntry[] {
  const entries: RolePermissionEntry[] = [];
  for (const [permissionKey, isAllowed] of Object.entries(draft)) {
    if (isGranted(matrix, permissionKey) === isAllowed) { continue; }
    entries.push({ permissionKey, isAllowed });
  }
  return entries;
}

/** Count of granted permissions in a draft — used for the matrix summary. */
export function countGranted(draft: Record<string, boolean>): number {
  return Object.values(draft).filter(Boolean).length;
}

/* ── Error interpretation ────────────────────────────────────────────────── */

/** A role that still has active users, from `roles.setStatus`.
 *
 * Unlike `config.entity.setStatus`, this refusal carries only a `message` — no
 * `count` or `details` (AuthService.gs:1091). */
export function isRoleInUse(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === 'DEPENDENCY_EXISTS';
}

/** A duplicate username, email or role key. */
export function isConflict(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === 'CONFLICT_ERROR';
}
