/* useUsers.ts — FE-13 user, role and permission administration
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 *
 * SRS §1: an admin controls which modules and actions each role can access, and
 * no role, permission or user mapping is hardcoded. Everything here is driven by
 * the server's `Permissions` catalog and the caller's own choice of role — this
 * module names no role key and no permission key.
 *
 * No optimistic UI (SRS §23): every write re-fetches from the server. That
 * matters more than usual for users, because `setUserStatus` and
 * `resetPassword` both revoke sessions server-side, so the row that comes back
 * is the only truthful one. */

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as userService from '@/services/userService';
import { toastStore } from '@/state/toastStore';
import type { PageMeta } from '@/types/api';
import type {
  Permission,
  Role,
  RolePermissionEntry,
  RolePermissionMatrix,
  UserRow,
} from '@/types/domain';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

const USER_PAGE_SIZE = 25;

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/* ---------------------------------------------------------------------------
 * Users
 * ------------------------------------------------------------------------- */

export interface UseUserListReturn {
  users: UserRow[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  search: string;
  setSearch: (next: string) => void;
  roleKey: string;
  setRoleKey: (next: string) => void;
  statusKey: string;
  setStatusKey: (next: string) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
}

export function useUserList(): UseUserListReturn {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearchState] = useState('');
  const [roleKey, setRoleKeyState] = useState('');
  const [statusKey, setStatusKeyState] = useState('');
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await userService.listUsers({
        page: pageNumber,
        pageSize: USER_PAGE_SIZE,
        search: search || undefined,
        roleKey: roleKey || undefined,
        statusKey: statusKey || undefined,
      });
      setUsers(result.items ?? []);
      setPageState(result.page ?? EMPTY_PAGE);
    } catch (err) {
      setUsers([]);
      setPageState(EMPTY_PAGE);
      setError(messageOf(err, 'Failed to load users'));
    } finally {
      setLoading(false);
    }
  }, [pageNumber, search, roleKey, statusKey]);

  useEffect(() => {
    void load();
  }, [load]);

  /* Every filter change resets paging — a narrowed result set would otherwise
   * leave the user stranded on a page that no longer exists. */
  const setSearch = useCallback((next: string) => {
    setSearchState(next);
    setPageNumber(1);
  }, []);

  const setRoleKey = useCallback((next: string) => {
    setRoleKeyState(next);
    setPageNumber(1);
  }, []);

  const setStatusKey = useCallback((next: string) => {
    setStatusKeyState(next);
    setPageNumber(1);
  }, []);

  return {
    users,
    page,
    loading,
    error,
    search,
    setSearch,
    roleKey,
    setRoleKey,
    statusKey,
    setStatusKey,
    setPage: setPageNumber,
    reload: load,
  };
}

export interface UseUserMutationsReturn {
  busy: boolean;
  error: string | null;
  clearError: () => void;
  create: (input: userService.CreateUserInput) => Promise<boolean>;
  update: (userId: string, values: userService.UpdateUserValues) => Promise<boolean>;
  setStatus: (userId: string, status: userService.UserStatus) => Promise<boolean>;
  resetPassword: (userId: string, temporaryPassword: string) => Promise<boolean>;
}

/** The four user writes. Each returns a boolean so the caller keeps its dialog
 * open when the server refuses — a duplicate username or a rejected password
 * must show the server's own message rather than closing on a lie. */
export function useUserMutations(reload: () => Promise<void> | void): UseUserMutationsReturn {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const run = useCallback(
    async (work: () => Promise<unknown>, successMessage: string): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        await work();
        await reload();
        toastStore.add('success', successMessage);
        return true;
      } catch (err) {
        setError(messageOf(err, 'The change could not be saved'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  const create = useCallback(
    (input: userService.CreateUserInput) =>
      run(() => userService.createUser(input), 'User created.'),
    [run],
  );

  const update = useCallback(
    (userId: string, values: userService.UpdateUserValues) =>
      run(() => userService.updateUser(userId, values), 'User updated.'),
    [run],
  );

  /** A status change is not always benign — anything but ACTIVE signs the user
   * out everywhere, so the message says so rather than reporting a bare "saved". */
  const setStatus = useCallback(
    (userId: string, status: userService.UserStatus) =>
      run(
        () => userService.setUserStatus(userId, status),
        status === 'ACTIVE'
          ? 'User activated.'
          : `User set to ${status.toLowerCase()} and signed out of all sessions.`,
      ),
    [run],
  );

  const resetPassword = useCallback(
    (userId: string, temporaryPassword: string) =>
      run(
        () => userService.resetUserPassword(userId, temporaryPassword),
        'Temporary password set. The user must change it at next sign-in.',
      ),
    [run],
  );

  return { busy, error, clearError, create, update, setStatus, resetPassword };
}

/* ---------------------------------------------------------------------------
 * Roles
 * ------------------------------------------------------------------------- */

export interface UseRoleListReturn {
  roles: Role[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Every role, loaded in one request.
 *
 * Roles are a handful of rows by nature, and both the user filters and the
 * permission matrix need the full list, so this pages generously rather than
 * exposing paging controls nobody would use. */
export function useRoleList(): UseRoleListReturn {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    userService
      /* Backend caps `pageSize` at 100 (Routes.gs:70). */
      .listRoles({ page: 1, pageSize: 100 })
      .then((result) => {
        if (cancelled) return;
        setRoles(result.items ?? []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRoles([]);
        setError(messageOf(err, 'Failed to load roles'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  const reload = useCallback(async () => {
    setTick((n) => n + 1);
  }, []);

  return { roles, loading, error, reload };
}

export interface UseRoleMutationsReturn {
  busy: boolean;
  error: string | null;
  clearError: () => void;
  create: (input: { roleKey: string; roleName: string; description?: string }) => Promise<boolean>;
  update: (
    roleKey: string,
    values: { roleName?: string; description?: string },
  ) => Promise<boolean>;
  setStatus: (roleKey: string, status: 'ACTIVE' | 'INACTIVE') => Promise<boolean>;
}

export function useRoleMutations(reload: () => Promise<void> | void): UseRoleMutationsReturn {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const create = useCallback(
    async (input: { roleKey: string; roleName: string; description?: string }) => {
      setBusy(true);
      setError(null);
      try {
        await userService.createRole(input);
        await reload();
        toastStore.add('success', 'Role created.');
        return true;
      } catch (err) {
        setError(messageOf(err, 'Could not create the role'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  const update = useCallback(
    async (roleKey: string, values: { roleName?: string; description?: string }) => {
      setBusy(true);
      setError(null);
      try {
        await userService.updateRole(roleKey, values);
        await reload();
        toastStore.add('success', 'Role updated.');
        return true;
      } catch (err) {
        setError(messageOf(err, 'Could not update the role'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  /** Deactivating a role that active users still hold is refused with
   * `DEPENDENCY_EXISTS`. That is a legitimate business refusal, so it is a
   * warning toast rather than an error banner, and the dialog stays open. */
  const setStatus = useCallback(
    async (roleKey: string, status: 'ACTIVE' | 'INACTIVE') => {
      setBusy(true);
      setError(null);
      try {
        await userService.setRoleStatus(roleKey, status);
        await reload();
        toastStore.add('success', status === 'ACTIVE' ? 'Role activated.' : 'Role deactivated.');
        return true;
      } catch (err) {
        if (userService.isRoleInUse(err)) {
          toastStore.add(
            'warning',
            'Cannot deactivate this role — active users still hold it. Move them to another role first.',
          );
          return false;
        }
        setError(messageOf(err, 'Could not change the role status'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  return { busy, error, clearError, create, update, setStatus };
}

/* ---------------------------------------------------------------------------
 * Permission matrix
 * ------------------------------------------------------------------------- */

export interface UsePermissionMatrixReturn {
  /** The full catalog, grouped by the server's own `module` column. */
  groups: userService.PermissionGroup[];
  catalog: Permission[];
  /** The stored matrix for the selected role. */
  matrix: RolePermissionMatrix | null;
  /** The working copy the checkboxes edit. */
  draft: Record<string, boolean>;
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Entries that differ from the stored matrix. Empty means nothing to save. */
  pending: RolePermissionEntry[];
  dirty: boolean;
  grantedCount: number;
  toggle: (permissionKey: string, isAllowed: boolean) => void;
  /** Grant or revoke every permission in one module at once. */
  setModule: (module: string, isAllowed: boolean) => void;
  reset: () => void;
  save: () => Promise<boolean>;
  reload: () => Promise<void>;
}

/** The permission matrix for one role.
 *
 * The catalog is loaded once and shared across roles; only the per-role matrix
 * is re-fetched when the selected role changes.
 *
 * The draft starts from the stored matrix, where an **absent key means denied**
 * (`Role_Permissions` has no row). Only real differences are submitted, because
 * `roles.permissions.update` rejects an empty `entries[]` and would otherwise
 * rewrite unchanged rows. */
export function usePermissionMatrix(roleKey: string): UsePermissionMatrixReturn {
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [matrix, setMatrix] = useState<RolePermissionMatrix | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  /* Catalog: independent of the selected role, so it loads once. */
  useEffect(() => {
    let cancelled = false;
    userService
      .listPermissions()
      .then((list) => {
        if (!cancelled) setCatalog(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(messageOf(err, 'Failed to load the permission catalog'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* Matrix: re-fetched whenever the role changes or a save forces a reload. */
  useEffect(() => {
    let cancelled = false;

    if (!roleKey) {
      setMatrix(null);
      setDraft({});
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError(null);

    userService
      .getRolePermissions(roleKey)
      .then((result) => {
        if (cancelled) return;
        setMatrix(result);
        setDraft({ ...(result.permissions ?? {}) });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setMatrix(null);
        setDraft({});
        setError(messageOf(err, 'Failed to load this role’s permissions'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [roleKey, tick]);

  const groups = useMemo(() => userService.groupPermissionsByModule(catalog), [catalog]);

  const toggle = useCallback((permissionKey: string, isAllowed: boolean) => {
    setDraft((prev) => ({ ...prev, [permissionKey]: isAllowed }));
  }, []);

  const setModule = useCallback(
    (module: string, isAllowed: boolean) => {
      const keys = catalog
        .filter((permission) => (permission.module || 'other') === module)
        .map((permission) => permission.permissionKey);
      setDraft((prev) => {
        const next = { ...prev };
        for (const key of keys) { next[key] = isAllowed; }
        return next;
      });
    },
    [catalog],
  );

  const reset = useCallback(() => {
    setDraft({ ...(matrix?.permissions ?? {}) });
  }, [matrix]);

  const pending = useMemo(
    () => userService.diffPermissions(matrix, draft),
    [matrix, draft],
  );

  const save = useCallback(async () => {
    if (!roleKey || pending.length === 0) { return false; }
    setSaving(true);
    setError(null);
    try {
      await userService.updateRolePermissions(roleKey, pending);
      setTick((n) => n + 1);
      toastStore.add(
        'success',
        `${pending.length} permission${pending.length === 1 ? '' : 's'} updated.`,
      );
      return true;
    } catch (err) {
      setError(messageOf(err, 'Could not save the permissions'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [roleKey, pending]);

  const reload = useCallback(async () => {
    setTick((n) => n + 1);
  }, []);

  return {
    groups,
    catalog,
    matrix,
    draft,
    loading,
    saving,
    error,
    pending,
    dirty: pending.length > 0,
    grantedCount: userService.countGranted(draft),
    toggle,
    setModule,
    reset,
    save,
    reload,
  };
}
