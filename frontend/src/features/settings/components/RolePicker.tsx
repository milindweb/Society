/* RolePicker.tsx — FE-13 multi-select role assignment
 *
 * `roleKeys` is a CSV column in the `Users` sheet, so a user holds a set of
 * roles and the UI needs a multi-select. `LookupSelect` is single-select and
 * `Select` is a native element with no multiple mode styled for it, so this is
 * a checkbox group instead — for the handful of roles a society defines, every
 * option being visible beats a dropdown the user has to open.
 *
 * SRS §1: no role is hardcoded. The options are whatever `roles.list` returns. */

import { Checkbox } from '@/components/ui/Checkbox';
import { Badge } from '@/components/ui/Badge';
import { FormField } from '@/components/ui/FormField';
import type { Role } from '@/types/domain';

export interface RolePickerProps {
  roles: Role[];
  /** Selected role keys. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Roles the user must hold at least one of — the server rejects an empty set. */
  required?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
  /** Role keys that cannot be unticked (e.g. a system role being protected). */
  lockedKeys?: string[];
}

export function RolePicker({
  roles,
  value,
  onChange,
  required = false,
  error,
  hint,
  disabled = false,
  lockedKeys = [],
}: RolePickerProps) {
  const toggle = (roleKey: string, checked: boolean) => {
    if (checked) {
      if (!value.includes(roleKey)) { onChange([...value, roleKey]); }
      return;
    }
    if (lockedKeys.includes(roleKey)) { return; }
    onChange(value.filter((key) => key !== roleKey));
  };

  /* A role the user already holds that is not in the active list (a deactivated
   * role) must still be visible and removable, or the form would silently drop
   * it on save. `roles.list` returns every role, so this only guards against a
   * filtered list being passed in. */
  const known = new Set(roles.map((role) => role.roleKey));
  const orphans = value.filter((key) => !known.has(key));

  return (
    <FormField label="Roles" required={required} error={error} hint={hint}>
      {roles.length === 0 ? (
        <p className="hs-text-sm hs-text-muted">No roles are available.</p>
      ) : (
        <div className="hs-flex hs-flex-wrap hs-gap-4">
          {roles.map((role) => {
            const inactive = role.statusKey && role.statusKey !== 'ACTIVE';
            return (
              <Checkbox
                key={role.roleKey}
                label={inactive ? `${role.roleName} (inactive)` : role.roleName}
                checked={value.includes(role.roleKey)}
                disabled={disabled || lockedKeys.includes(role.roleKey)}
                onChange={(event) => toggle(role.roleKey, event.target.checked)}
              />
            );
          })}
          {orphans.map((key) => (
            <Checkbox
              key={key}
              label={`${key} (unknown role)`}
              checked
              disabled={disabled}
              onChange={() => toggle(key, false)}
            />
          ))}
        </div>
      )}
    </FormField>
  );
}

/** Compact read-only rendering of a user's roles, for a table cell. */
export function RoleBadges({ roleKeys, roles }: { roleKeys: string[]; roles: Role[] }) {
  if (roleKeys.length === 0) { return <span>—</span>; }

  const nameOf = new Map(roles.map((role) => [role.roleKey, role.roleName]));

  return (
    <span className="hs-flex hs-flex-wrap hs-gap-1">
      {roleKeys.map((key) => (
        <Badge key={key} variant="info">
          {nameOf.get(key) ?? key}
        </Badge>
      ))}
    </span>
  );
}
