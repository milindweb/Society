/* RoleMatrixPage.tsx — FE-13 roles and the permission matrix
 *
 * SRS §1: "Admin can control which modules/actions each role can access" and
 * "No role, permission or user mapping should be hardcoded." This page is the
 * direct implementation of both sentences: roles come from `roles.list`, the
 * permission catalog from `permissions.list`, and this role's grants from
 * `roles.permissions.get`. No module name, role key or permission key appears
 * as a literal anywhere in the file.
 *
 * Why a matrix and not the `rolePermissions` master entity? The entity view is
 * one row per (role, permission) pair — hundreds of rows for a handful of
 * decisions. The matrix shows every permission for one role at once, grouped by
 * the server's own `module` column, with a module-level select-all. That is the
 * screen an administrator actually needs, and it is what makes the RBAC
 * configuration usable rather than merely present.
 *
 * Server-enforced rules the UI respects:
 * - `roles.list`, `permissions.list` and `roles.permissions.get` need
 *   `roles.read`; `roles.create/update/setStatus` and `roles.permissions.update`
 *   need `roles.manage`. `canManage` gates every write control.
 * - `roles.permissions.get` returns a **sparse** map: a key with no row is
 *   denied. Only ADMIN is seeded (`Setup.gs:268`), so a new role starts empty
 *   and this page is how it gets built up.
 * - `roles.permissions.update` requires a **non-empty `entries[]`** and rejects
 *   an empty array with VALIDATION_ERROR. `diffPermissions` therefore sends only
 *   the rows that changed, and Save is disabled when nothing has.
 * - `roles.setStatus` to INACTIVE is refused with `DEPENDENCY_EXISTS` while
 *   active users hold the role.
 * - `roles.create` upper-cases `roleKey` and rejects a duplicate with
 *   `CONFLICT_ERROR`.
 *
 * No optimistic UI (SRS §23): a successful save re-fetches the matrix, so the
 * checkboxes end up reflecting what the server actually stored. */

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';
import {
  useRoleList,
  useRoleMutations,
  usePermissionMatrix,
} from '../hooks/useUsers';
import * as userService from '@/services/userService';
import { authStore } from '@/state/authStore';
import { hasPermission } from '@/lib/permission';
import type { Role } from '@/types/domain';

/** `roles.manage` gates every role write in Routes.gs:1132-1167. */
const ROLES_MANAGE = 'roles.manage';

export default function RoleMatrixPage() {
  const { roles, loading, error, reload } = useRoleList();
  const mutations = useRoleMutations(reload);

  const canManage = useMemo(
    () => hasPermission(authStore.user?.permissions ?? [], ROLES_MANAGE),
    [],
  );

  const [selected, setSelected] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [deactivating, setDeactivating] = useState<Role | null>(null);

  /* Default to the first role once the list arrives. */
  const activeRoleKey = selected || roles[0]?.roleKey || '';
  const activeRole = roles.find((role) => role.roleKey === activeRoleKey);

  const matrix = usePermissionMatrix(activeRoleKey);

  if (error) {
    return (
      <div>
        <PageHeader title="Roles & Permissions" subtitle="Control what each role can access" />
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }

  const tabs = roles.map((role) => ({
    key: role.roleKey,
    label: role.roleName || role.roleKey,
    content: null,
  }));

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Control what each role can access"
        actions={
          canManage ? (
            <Button
              variant="primary"
              icon={<Icon name="plus" size={16} />}
              onClick={() => {
                mutations.clearError();
                setCreating(true);
              }}
            >
              Add role
            </Button>
          ) : undefined
        }
      />

      {!canManage && (
        <div className="hs-mb-4">
          <Alert variant="info">
            <span>
              You can review roles and permissions but not change them. Ask an administrator for the
              <code> roles.manage </code> permission to make changes.
            </span>
          </Alert>
        </div>
      )}

      {loading ? (
        <Card>
          <CardBody>
            <p className="hs-text-sm hs-text-muted">Loading roles…</p>
          </CardBody>
        </Card>
      ) : roles.length === 0 ? (
        <EmptyState
          title="No roles defined"
          description="A role is required before any user can be created."
          action={
            canManage ? (
              <Button variant="primary" onClick={() => setCreating(true)}>
                Add the first role
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Tabs
            tabs={tabs}
            selectedKey={activeRoleKey}
            onChange={(key) => setSelected(key)}
          />

          {activeRole && (
            <RoleDetail
              role={activeRole}
              canManage={canManage}
              onEdit={() => {
                mutations.clearError();
                setEditing(activeRole);
              }}
              onDeactivate={() => setDeactivating(activeRole)}
              onActivate={() => void mutations.setStatus(activeRole.roleKey, 'ACTIVE')}
              mutations={mutations}
            />
          )}

          {activeRole && (
            <PermissionMatrixPanel
              roleKey={activeRole.roleKey}
              canManage={canManage}
              matrix={matrix}
            />
          )}
        </>
      )}

      {creating && (
        <RoleFormModal
          busy={mutations.busy}
          error={mutations.error}
          onClose={() => setCreating(false)}
          onSubmit={async (values) => {
            const ok = await mutations.create(values);
            if (ok) { setCreating(false); }
          }}
        />
      )}

      {editing && (
        <RoleFormModal
          role={editing}
          busy={mutations.busy}
          error={mutations.error}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            const ok = await mutations.update(editing.roleKey, {
              roleName: values.roleName,
              description: values.description,
            });
            if (ok) { setEditing(null); }
          }}
        />
      )}

      <ConfirmDialog
        open={deactivating !== null}
        onClose={() => setDeactivating(null)}
        onConfirm={() => {
          if (!deactivating) { return; }
          void mutations.setStatus(deactivating.roleKey, 'INACTIVE').then((ok) => {
            if (ok) { setDeactivating(null); }
          });
        }}
        title="Deactivate role"
        message={
          deactivating
            ? `Deactivate "${deactivating.roleName}"? It will stop being assignable. If active users still hold it, the server will refuse.`
            : ''
        }
        confirmLabel="Deactivate"
        variant="danger"
        loading={mutations.busy}
      />
    </div>
  );
}

/* ── Role summary card ───────────────────────────────────────────────────── */

function RoleDetail({
  role,
  canManage,
  onEdit,
  onDeactivate,
  onActivate,
  mutations,
}: {
  role: Role;
  canManage: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
  onActivate: () => void;
  mutations: ReturnType<typeof useRoleMutations>;
}) {
  const active = (role.statusKey || 'ACTIVE') === 'ACTIVE';

  return (
    <Card>
      <CardBody>
        <div className="hs-flex hs-items-start hs-justify-between hs-gap-4 hs-flex-wrap">
          <div>
            <div className="hs-flex hs-items-center hs-gap-2 hs-flex-wrap">
              <strong>{role.roleName || role.roleKey}</strong>
              <Badge variant="neutral">{role.roleKey}</Badge>
              {role.isSystem && <Badge variant="info">System</Badge>}
              <StatusBadge statusKey={role.statusKey || 'ACTIVE'} />
            </div>
            <p className="hs-text-sm hs-text-muted hs-mt-2">
              {role.description || 'No description.'}
            </p>
          </div>

          {canManage && (
            <div className="hs-flex hs-gap-2">
              <Button variant="ghost" icon={<Icon name="edit" size={16} />} onClick={onEdit}>
                Edit
              </Button>
              {active ? (
                <Button
                  variant="ghost"
                  icon={<Icon name="x" size={16} />}
                  loading={mutations.busy}
                  onClick={onDeactivate}
                >
                  Deactivate
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  icon={<Icon name="unlock" size={16} />}
                  loading={mutations.busy}
                  onClick={onActivate}
                >
                  Activate
                </Button>
              )}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

/* ── Permission matrix ───────────────────────────────────────────────────── */

function PermissionMatrixPanel({
  roleKey,
  canManage,
  matrix,
}: {
  roleKey: string;
  canManage: boolean;
  matrix: ReturnType<typeof usePermissionMatrix>;
}) {
  if (matrix.loading) {
    return (
      <Card className="hs-mt-4">
        <CardBody>
          <p className="hs-text-sm hs-text-muted">Loading permissions…</p>
        </CardBody>
      </Card>
    );
  }

  if (matrix.error) {
    return (
      <div className="hs-mt-4">
        <ErrorState message={matrix.error} onRetry={matrix.reload} />
      </div>
    );
  }

  if (matrix.groups.length === 0) {
    return (
      <div className="hs-mt-4">
        <EmptyState
          title="No permissions defined"
          description="The Permissions sheet is empty, so there is nothing to grant."
        />
      </div>
    );
  }

  return (
    <Card className="hs-mt-4">
      <CardHeader
        title="Permissions"
        action={
          <div className="hs-flex hs-items-center hs-gap-3">
            <span className="hs-text-sm hs-text-muted">
              {matrix.grantedCount} granted
            </span>
            {canManage && (
              <>
                <Button
                  variant="ghost"
                  disabled={!matrix.dirty || matrix.saving}
                  onClick={matrix.reset}
                >
                  Discard
                </Button>
                <Button
                  variant="primary"
                  loading={matrix.saving}
                  disabled={!matrix.dirty}
                  onClick={() => void matrix.save()}
                >
                  Save{matrix.dirty ? ` (${matrix.pending.length})` : ''}
                </Button>
              </>
            )}
          </div>
        }
      />
      <CardBody>
        {!canManage && (
          <p className="hs-text-sm hs-text-muted hs-mb-4">
            Read-only view of the permissions granted to <strong>{roleKey}</strong>.
          </p>
        )}

        {matrix.groups.map((group) => {
          const grantedInModule = group.permissions.filter((permission) =>
            matrix.draft[permission.permissionKey] === true,
          ).length;

          return (
            <section key={group.module} className="hs-mb-5">
              <div className="hs-flex hs-items-center hs-justify-between hs-gap-3 hs-mb-3 hs-flex-wrap">
                <div className="hs-flex hs-items-center hs-gap-2">
                  <strong>{group.module}</strong>
                  <Badge variant={grantedInModule > 0 ? 'info' : 'neutral'}>
                    {grantedInModule}/{group.permissions.length}
                  </Badge>
                </div>
                {canManage && (
                  <div className="hs-flex hs-gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => matrix.setModule(group.module, true)}
                    >
                      Select all
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => matrix.setModule(group.module, false)}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              <div className="hs-grid hs-grid-cols-2 hs-gap-3">
                {group.permissions.map((permission) => (
                  <Checkbox
                    key={permission.permissionKey}
                    label={userService.permissionLabel(permission)}
                    checked={matrix.draft[permission.permissionKey] === true}
                    disabled={!canManage || matrix.saving}
                    onChange={(event) =>
                      matrix.toggle(permission.permissionKey, event.target.checked)
                    }
                  />
                ))}
              </div>
            </section>
          );
        })}
      </CardBody>
    </Card>
  );
}

/* ── Create / edit role ──────────────────────────────────────────────────── */

function RoleFormModal({
  role,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  /** Present in edit mode. */
  role?: Role;
  busy: boolean;
  error: string | null;
  onSubmit: (values: { roleKey: string; roleName: string; description: string }) => void | Promise<void>;
  onClose: () => void;
}) {
  const editing = Boolean(role);
  const [values, setValues] = useState({
    roleKey: role?.roleKey ?? '',
    roleName: role?.roleName ?? '',
    description: role?.description ?? '',
  });

  const incomplete = !values.roleKey.trim() || !values.roleName.trim();

  return (
    <Modal open onClose={onClose} title={editing ? `Edit ${role?.roleKey}` : 'Add role'}>
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

        <FormField
          label="Role key"
          required
          hint={
            editing
              ? 'A role key cannot be changed once the role exists.'
              : 'Short identifier, stored upper-case, e.g. SECRETARY.'
          }
        >
          <Input
            id="role-key"
            value={values.roleKey}
            disabled={busy || editing}
            onChange={(event) => setValues((prev) => ({ ...prev, roleKey: event.target.value }))}
          />
        </FormField>

        <div className="hs-mt-4">
          <FormField label="Role name" required>
            <Input
              id="role-name"
              value={values.roleName}
              disabled={busy}
              onChange={(event) => setValues((prev) => ({ ...prev, roleName: event.target.value }))}
            />
          </FormField>
        </div>

        <div className="hs-mt-4">
          <FormField label="Description">
            <Textarea
              id="role-description"
              rows={3}
              value={values.description}
              disabled={busy}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </FormField>
        </div>

        {!editing && (
          <p className="hs-field__hint hs-mt-4">
            A new role starts with no permissions. Grant them on the matrix after saving.
          </p>
        )}

        <div className="hs-flex hs-justify-end hs-gap-2 hs-mt-5">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={incomplete}>
            {editing ? 'Save changes' : 'Create role'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
