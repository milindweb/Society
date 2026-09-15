/* UsersPage.tsx — FE-13 user administration
 *
 * SRS §1: authentication lives in a separate Auth spreadsheet, roles are
 * configurable, and "no role, permission or user mapping should be hardcoded".
 * This page therefore holds no role name and no permission key — every role
 * comes from `roles.list`.
 *
 * Server-enforced rules the UI reflects rather than re-implements:
 * - All `users.*` routes need `users.manage`. Without it the page is not
 *   reachable (the route is gated), so no read-only variant is needed here.
 * - `users.create` requires username, email, full name, at least one role and a
 *   temporary password. Uniqueness of username/email is checked **server-side**
 *   and surfaces as `CONFLICT_ERROR`, which is shown on the form rather than
 *   pre-empted with a client-side duplicate scan.
 * - `users.setStatus` accepts ACTIVE / INACTIVE / **LOCKED**, and anything other
 *   than ACTIVE revokes that user's sessions. Both facts are stated in the
 *   confirmation so the consequence is not a surprise.
 * - `users.resetPassword` forces `mustChangePassword` and revokes sessions.
 * - Passwords are never read back: the server's `sanitizeUser` excludes the
 *   hash and salt, and no response echoes a password.
 *
 * No optimistic UI (SRS §23): every write reloads the list. */

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Toolbar } from '@/components/ui/Toolbar';
import { Card, CardBody } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/data/DataTable';
import { PaginationBar } from '@/components/data/PaginationBar';
import { RoleBadges, RolePicker } from '../components/RolePicker';
import { useUserList, useUserMutations, useRoleList } from '../hooks/useUsers';
import { useDebounce } from '@/lib/useDebounce';
import { formatDateTime } from '@/lib/dates';
import { authStore } from '@/state/authStore';
import * as userService from '@/services/userService';
import type { UserRow } from '@/types/domain';
import { ExportButton } from '@/components/ui/ExportButton';

/** Mirrors `AuthService.gs:18` so the hint is honest before a round trip. The
 * server validates independently and its message always wins. */
const MIN_PASSWORD_LENGTH = 4;

const USER_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...userService.USER_STATUSES.map((status) => ({
    value: status,
    label: status.charAt(0) + status.slice(1).toLowerCase(),
  })),
];

/** What each status means, said plainly — a status change can sign a user out. */
const STATUS_CONSEQUENCE: Record<userService.UserStatus, string> = {
  ACTIVE: 'The user can sign in again.',
  INACTIVE: 'The user will be signed out of all sessions and cannot sign in.',
  LOCKED: 'The user will be signed out of all sessions and cannot sign in until unlocked.',
};

export default function UsersPage() {
  const { roles, loading: rolesLoading, error: rolesError } = useRoleList();
  const list = useUserList();
  const mutations = useUserMutations(list.reload);

  const [searchInput, setSearchInput] = useState('');
  const debounced = useDebounce(searchInput, 300);

  /* Feed the debounced term into the list hook. An effect, not a render-phase
   * assignment: `setSearch` also resets paging, so it must run after commit. */
  const { setSearch } = list;
  useEffect(() => {
    setSearch(debounced);
  }, [debounced, setSearch]);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [statusTarget, setStatusTarget] = useState<{
    user: UserRow;
    status: userService.UserStatus;
  } | null>(null);

  /* The signed-in admin cannot deactivate or lock themselves out. The server
   * would allow it, so this is a deliberate guard rail, not a mirrored rule. */
  const currentUserId = authStore.user?.userId;

  const columns: Column<UserRow>[] = [
    {
      key: 'fullName',
      header: 'Name',
      render: (row) => (
        <div>
          <div>{row.fullName || row.username}</div>
          <div className="hs-text-xs hs-text-muted">{row.username}</div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => row.email || '—',
    },
    {
      key: 'roleKeys',
      header: 'Roles',
      render: (row) => <RoleBadges roleKeys={row.roleKeys ?? []} roles={roles} />,
    },
    {
      key: 'statusKey',
      header: 'Status',
      render: (row) => <StatusBadge statusKey={row.statusKey || 'ACTIVE'} />,
    },
    {
      key: 'lastLoginAt',
      header: 'Last sign-in',
      render: (row) => (row.lastLoginAt ? formatDateTime(row.lastLoginAt) : 'Never'),
    },
    {
      key: '__actions',
      header: '',
      align: 'right',
      render: (row) => {
        const isSelf = row.userId === currentUserId;
        const active = (row.statusKey || 'ACTIVE') === 'ACTIVE';
        return (
          <div className="hs-flex hs-gap-1 hs-justify-end">
            <IconButton
              icon={<Icon name="edit" size={16} />}
              label={`Edit ${row.username}`}
              onClick={() => {
                mutations.clearError();
                setEditing(row);
              }}
            />
            <IconButton
              icon={<Icon name="lock" size={16} />}
              label={`Reset password for ${row.username}`}
              onClick={() => {
                mutations.clearError();
                setResetting(row);
              }}
            />
            {active ? (
              <IconButton
                icon={<Icon name="x" size={16} />}
                label={`Deactivate ${row.username}`}
                disabled={isSelf}
                onClick={() => setStatusTarget({ user: row, status: 'INACTIVE' })}
              />
            ) : (
              <IconButton
                icon={<Icon name="unlock" size={16} />}
                label={`Activate ${row.username}`}
                onClick={() => setStatusTarget({ user: row, status: 'ACTIVE' })}
              />
            )}
          </div>
        );
      },
    },
  ];

  if (list.error) {
    return (
      <div>
        <PageHeader title="Users" subtitle="Accounts and role assignment" />
        <ErrorState message={list.error} onRetry={list.reload} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Accounts and role assignment"
        actions={
          <>
            <ExportButton columns={columns} data={list.users} filename="users-list" />
            <Button
              variant="primary"
              icon={<Icon name="plus" size={16} />}
              disabled={rolesLoading || roles.length === 0}
              onClick={() => {
                mutations.clearError();
                setCreating(true);
              }}
            >
              Add user
            </Button>
          </>
        }
      />

      {rolesError && (
        <div className="hs-mb-4">
          <Alert variant="warning">
            <span>
              Roles could not be loaded, so role assignment is unavailable: {rolesError}
            </span>
          </Alert>
        </div>
      )}

      <Card>
        <CardBody>
          <Toolbar>
            <div className="hs-flex hs-items-center hs-gap-3 hs-flex-wrap">
              <Input
                type="search"
                value={searchInput}
                placeholder="Search name, username or email…"
                aria-label="Search users"
                onChange={(event) => setSearchInput(event.target.value)}
                style={{ minWidth: '16rem' }}
              />
              <Select
                aria-label="Filter by role"
                value={list.roleKey}
                options={[
                  { value: '', label: 'All roles' },
                  ...roles.map((role) => ({ value: role.roleKey, label: role.roleName })),
                ]}
                onChange={(event) => list.setRoleKey(event.target.value)}
              />
              <Select
                aria-label="Filter by status"
                value={list.statusKey}
                options={USER_STATUS_OPTIONS}
                onChange={(event) => list.setStatusKey(event.target.value)}
              />
              <span className="hs-text-sm hs-text-muted">
                {list.page.total} {list.page.total === 1 ? 'user' : 'users'}
              </span>
            </div>
            <Button
              variant="ghost"
              icon={<Icon name="refresh" size={16} />}
              disabled={list.loading}
              onClick={() => void list.reload()}
            >
              Refresh
            </Button>
          </Toolbar>
        </CardBody>
      </Card>

      <div className="hs-mt-4">
        <DataTable
          columns={columns}
          data={list.users}
          loading={list.loading}
          emptyTitle="No users found"
          emptyDescription={
            searchInput || list.roleKey || list.statusKey
              ? 'No account matches these filters.'
              : 'Add the first account to get started.'
          }
        />
      </div>

      {!list.loading && list.page.totalPages > 1 && (
        <PaginationBar page={list.page} onPageChange={list.setPage} />
      )}

      {creating && (
        <UserFormModal
          roles={roles}
          busy={mutations.busy}
          error={mutations.error}
          onClose={() => setCreating(false)}
          onSubmit={async (values) => {
            const ok = await mutations.create({
              username: values.username,
              email: values.email,
              fullName: values.fullName,
              mobile: values.mobile || undefined,
              roleKeys: values.roleKeys,
              temporaryPassword: values.temporaryPassword,
            });
            if (ok) { setCreating(false); }
          }}
        />
      )}

      {editing && (
        <UserFormModal
          roles={roles}
          row={editing}
          busy={mutations.busy}
          error={mutations.error}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            const ok = await mutations.update(editing.userId, {
              username: values.username,
              email: values.email,
              fullName: values.fullName,
              mobile: values.mobile,
              roleKeys: values.roleKeys,
            });
            if (ok) { setEditing(null); }
          }}
        />
      )}

      {resetting && (
        <ResetPasswordModal
          user={resetting}
          busy={mutations.busy}
          error={mutations.error}
          onClose={() => setResetting(null)}
          onSubmit={async (password) => {
            const ok = await mutations.resetPassword(resetting.userId, password);
            if (ok) { setResetting(null); }
          }}
        />
      )}

      <ConfirmDialog
        open={statusTarget !== null}
        onClose={() => setStatusTarget(null)}
        onConfirm={() => {
          if (!statusTarget) { return; }
          void mutations
            .setStatus(statusTarget.user.userId, statusTarget.status)
            .then((ok) => {
              if (ok) { setStatusTarget(null); }
            });
        }}
        title={
          statusTarget?.status === 'ACTIVE'
            ? 'Activate user'
            : statusTarget?.status === 'LOCKED'
              ? 'Lock user'
              : 'Deactivate user'
        }
        message={
          statusTarget
            ? `Set "${statusTarget.user.username}" to ${statusTarget.status.toLowerCase()}? ${STATUS_CONSEQUENCE[statusTarget.status]}`
            : ''
        }
        confirmLabel={
          statusTarget?.status === 'ACTIVE'
            ? 'Activate'
            : statusTarget?.status === 'LOCKED'
              ? 'Lock'
              : 'Deactivate'
        }
        variant={statusTarget?.status === 'ACTIVE' ? 'primary' : 'danger'}
        loading={mutations.busy}
      />
    </div>
  );
}

/* ── Create / edit form ──────────────────────────────────────────────────── */

interface UserFormValues {
  username: string;
  email: string;
  fullName: string;
  mobile: string;
  roleKeys: string[];
  temporaryPassword: string;
}

function UserFormModal({
  roles,
  row,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  roles: import('@/types/domain').Role[];
  /** Present in edit mode. */
  row?: UserRow;
  busy: boolean;
  error: string | null;
  onSubmit: (values: UserFormValues) => void | Promise<void>;
  onClose: () => void;
}) {
  const editing = Boolean(row);
  const [values, setValues] = useState<UserFormValues>({
    username: row?.username ?? '',
    email: row?.email ?? '',
    fullName: row?.fullName ?? '',
    mobile: row?.mobile ?? '',
    roleKeys: row?.roleKeys ?? [],
    temporaryPassword: '',
  });

  const set = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const passwordTooShort =
    !editing && values.temporaryPassword.length > 0 &&
    values.temporaryPassword.length < MIN_PASSWORD_LENGTH;

  const incomplete =
    !values.username.trim() ||
    !values.email.trim() ||
    !values.fullName.trim() ||
    values.roleKeys.length === 0 ||
    (!editing && values.temporaryPassword.length < MIN_PASSWORD_LENGTH);

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${row?.username}` : 'Add user'}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(values);
        }}
        noValidate
      >
        {error && (
          <div className="hs-mb-4">
            <Alert variant="danger">
              <span>{error}</span>
            </Alert>
          </div>
        )}

        <div className="hs-grid hs-grid-cols-2 hs-gap-4">
          <FormField label="Full name" required>
            <Input
              id="user-full-name"
              value={values.fullName}
              disabled={busy}
              onChange={(event) => set('fullName', event.target.value)}
            />
          </FormField>

          <FormField label="Username" required hint="Used to sign in">
            <Input
              id="user-username"
              value={values.username}
              disabled={busy}
              onChange={(event) => set('username', event.target.value)}
            />
          </FormField>

          <FormField label="Email" required>
            <Input
              id="user-email"
              type="email"
              value={values.email}
              disabled={busy}
              onChange={(event) => set('email', event.target.value)}
            />
          </FormField>

          <FormField label="Mobile">
            <Input
              id="user-mobile"
              type="tel"
              value={values.mobile}
              disabled={busy}
              onChange={(event) => set('mobile', event.target.value)}
            />
          </FormField>
        </div>

        <div className="hs-mt-4">
          <RolePicker
            roles={roles}
            value={values.roleKeys}
            onChange={(next) => set('roleKeys', next)}
            required
            disabled={busy}
            hint="At least one role is required."
          />
        </div>

        {!editing && (
          <div className="hs-mt-4">
            <FormField
              label="Temporary password"
              required
              hint={`At least ${MIN_PASSWORD_LENGTH} characters. The user must change it at first sign-in.`}
              error={passwordTooShort ? 'Too short.' : undefined}
            >
              <Input
                id="user-temp-password"
                type="password"
                autoComplete="new-password"
                value={values.temporaryPassword}
                disabled={busy}
                onChange={(event) => set('temporaryPassword', event.target.value)}
              />
            </FormField>
          </div>
        )}

        {editing && (
          <p className="hs-field__hint hs-mt-4">
            To change this user’s password, close this form and use “Reset password”.
          </p>
        )}

        <div className="hs-flex hs-justify-end hs-gap-2 hs-mt-5">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={incomplete}>
            {editing ? 'Save changes' : 'Create user'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Reset password ──────────────────────────────────────────────────────── */

function ResetPasswordModal({
  user,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  user: UserRow;
  busy: boolean;
  error: string | null;
  onSubmit: (temporaryPassword: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');

  return (
    <Modal open onClose={onClose} title={`Reset password for ${user.username}`}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(password);
        }}
        noValidate
      >
        <Alert variant="warning">
          <span>
            This signs {user.fullName || user.username} out of all sessions and forces a password
            change at their next sign-in.
          </span>
        </Alert>

        {error && (
          <div className="hs-mt-4">
            <Alert variant="danger">
              <span>{error}</span>
            </Alert>
          </div>
        )}

        <div className="hs-mt-4">
          <FormField
            label="Temporary password"
            required
            hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          >
            <Input
              id="reset-temp-password"
              type="password"
              autoComplete="new-password"
              value={password}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>
        </div>

        <div className="hs-flex hs-justify-end hs-gap-2 hs-mt-5">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            disabled={password.length < MIN_PASSWORD_LENGTH}
          >
            Reset password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
