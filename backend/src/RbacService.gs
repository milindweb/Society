/**
 * RbacService.js — server-enforced role-based access control.
 *
 * Resolves permissions from Users.roleKeys -> Role_Permissions (isAllowed) -> Permissions.
 * Absence of a permission = denial.
 *
 * Rules:
 * - No hardcoded roles/permissions — all rows in the Auth spreadsheet.
 * - MEMBER_SELF: flatId/memberId come from the user row, never the payload.
 * - RBAC enforced server-side; frontend visibility is not security.
 */
var RbacService = (function () {
  'use strict';

  // --------------------------------------------------------------------------- Permission resolution

  /**
   * Resolve the full set of allowed permission keys for a set of role keys.
   *
   * @param {string|Array} roleKeys  comma-separated role keys or array
   * @return {Array<string>} allowed permission keys (unique, sorted)
   */
  function resolvePermissions(roleKeys) {
    var roles = Array.isArray(roleKeys) ? roleKeys : Utils.csvToArray(roleKeys);
    if (roles.length === 0) { return []; }

    var allowed = {};

    // Read Role_Permissions sheet
    var sheet = Repository.getSheet('Role_Permissions');
    var columns = Schema.columnsOf('Role_Permissions');
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return []; }

    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow('Role_Permissions', values[i]);
      // Check if this role is in the user's role keys
      if (roles.indexOf(rec.roleKey) !== -1) {
        // Check if allowed
        if (rec.isAllowed === 'TRUE' || rec.isAllowed === true) {
          allowed[rec.permissionKey] = true;
        } else {
          // Explicit denial overrides previous grants
          delete allowed[rec.permissionKey];
        }
      }
    }

    return Object.keys(allowed).sort();
  }

  /**
   * Check if a set of permissions includes a specific permission.
   * @param {Array<string>} permissions  resolved permissions
   * @param {string} permissionKey       e.g. 'complaints.create'
   * @return {boolean}
   */
  function hasPermission(permissions, permissionKey) {
    if (!permissions || !Array.isArray(permissions)) { return false; }
    return permissions.indexOf(permissionKey) !== -1;
  }

  // --------------------------------------------------------------------------- Enforcement

  /**
   * Check if the caller has the required permission. Returns an error response if denied.
   *
   * @param {Array<string>} permissions  caller's resolved permissions
   * @param {string} requiredPermission  e.g. 'payments.create'
   * @return {{ allowed: boolean, error?: string }}
   */
  function requirePermission(permissions, requiredPermission) {
    if (hasPermission(permissions, requiredPermission)) {
      return { allowed: true };
    }
    return { allowed: false, error: 'FORBIDDEN' };
  }

  /**
   * Enforce MEMBER_SELF scope: ensures the caller can only access their own data.
   *
   * When the permission scope is MEMBER_SELF, the flatId and memberId must come from
   * the user's own record (never from the request payload). If the caller tries to
   * access another member's data, return FORBIDDEN.
   *
   * @param {object} user        the authenticated user record from Users sheet
   * @param {object} target      the target entity to access
   * @param {object} [opts]      { scope: 'MEMBER_SELF' | 'GLOBAL' }
   * @return {{ allowed: boolean, error?: string }}
   */
  function enforceMemberScope(user, target, opts) {
    var scope = (opts && opts.scope) || 'GLOBAL';
    if (scope === 'GLOBAL') {
      return { allowed: true };
    }

    if (scope === 'MEMBER_SELF') {
      // The user must have memberId or flatId
      if (!user.memberId && !user.flatId) {
        return { allowed: false, error: 'FORBIDDEN' };
      }

      // Check if target flatId matches user's flatId
      if (target && target.flatId && user.flatId) {
        if (String(target.flatId) !== String(user.flatId)) {
          return { allowed: false, error: 'FORBIDDEN' };
        }
      }

      // Check if target memberId matches user's memberId
      if (target && target.memberId && user.memberId) {
        if (String(target.memberId) !== String(user.memberId)) {
          return { allowed: false, error: 'FORBIDDEN' };
        }
      }

      return { allowed: true };
    }

    return { allowed: false, error: 'FORBIDDEN' };
  }

  /**
   * Check if a user has a specific role.
   * @param {string|Array} roleKeys
   * @param {string} roleKey
   * @return {boolean}
   */
  function hasRole(roleKeys, roleKey) {
    var roles = Array.isArray(roleKeys) ? roleKeys : Utils.csvToArray(roleKeys);
    return roles.indexOf(roleKey) !== -1;
  }

  /**
   * Check if a user has any of the specified roles.
   * @param {string|Array} roleKeys
   * @param {Array<string>} roleKeysToCheck
   * @return {boolean}
   */
  function hasAnyRole(roleKeys, roleKeysToCheck) {
    var roles = Array.isArray(roleKeys) ? roleKeys : Utils.csvToArray(roleKeys);
    for (var i = 0; i < roleKeysToCheck.length; i++) {
      if (roles.indexOf(roleKeysToCheck[i]) !== -1) { return true; }
    }
    return false;
  }

  // --------------------------------------------------------------------------- Expose

  return {
    resolvePermissions: resolvePermissions,
    hasPermission: hasPermission,
    requirePermission: requirePermission,
    enforceMemberScope: enforceMemberScope,
    hasRole: hasRole,
    hasAnyRole: hasAnyRole
  };
})();
