/* permission.test.ts — Tests for permission checking helpers */

import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  filterNavByPermissions,
  getFirstPermittedRoute,
} from '@/lib/permission';

describe('hasPermission', () => {
  it('returns true when user has the required permission', () => {
    expect(hasPermission(['members.read', 'members.write'], 'members.read')).toBe(true);
  });

  it('returns false when user lacks the required permission', () => {
    expect(hasPermission(['members.read'], 'members.write')).toBe(false);
  });

  it('returns true for wildcard permission', () => {
    expect(hasPermission(['*'], 'anything')).toBe(true);
  });

  it('returns false for empty permissions array', () => {
    expect(hasPermission([], 'members.read')).toBe(false);
  });
});

describe('hasAnyPermission', () => {
  it('returns true if user has at least one of the required permissions', () => {
    expect(hasAnyPermission(['members.read'], ['members.write', 'members.read'])).toBe(true);
  });

  it('returns false if user has none of the required permissions', () => {
    expect(hasAnyPermission(['members.read'], ['members.write', 'flats.read'])).toBe(false);
  });

  it('returns true for wildcard', () => {
    expect(hasAnyPermission(['*'], ['anything'])).toBe(true);
  });

  it('returns false for empty required array', () => {
    expect(hasAnyPermission(['members.read'], [])).toBe(false);
  });
});

describe('hasAllPermissions', () => {
  it('returns true if user has all required permissions', () => {
    expect(hasAllPermissions(['a', 'b'], ['a', 'b'])).toBe(true);
  });

  it('returns false if user lacks any required permission', () => {
    expect(hasAllPermissions(['a'], ['a', 'b'])).toBe(false);
  });

  it('returns true for wildcard', () => {
    expect(hasAllPermissions(['*'], ['a', 'b'])).toBe(true);
  });

  it('returns true for empty required array', () => {
    expect(hasAllPermissions(['a'], [])).toBe(true);
  });
});

describe('filterNavByPermissions', () => {
  it('returns only permitted nav items', () => {
    const nav = filterNavByPermissions(['dashboard.read', 'members.read']);
    expect(nav).toHaveLength(2);
    expect(nav.map((n) => n.key)).toContain('dashboard');
    expect(nav.map((n) => n.key)).toContain('members');
  });

  it('returns empty array for no permissions', () => {
    expect(filterNavByPermissions([])).toHaveLength(0);
  });

  it('returns all items for wildcard permission', () => {
    const nav = filterNavByPermissions(['*']);
    expect(nav.length).toBeGreaterThan(0);
  });

  it('does not include items user lacks permission for', () => {
    const nav = filterNavByPermissions(['dashboard.read']);
    expect(nav.map((n) => n.key)).not.toContain('members');
  });
});

describe('getFirstPermittedRoute', () => {
  it('returns the route of the first permitted nav item', () => {
    const route = getFirstPermittedRoute(['dashboard.read', 'members.read']);
    expect(route).toBe('/dashboard');
  });

  it('returns /forbidden when no permissions', () => {
    expect(getFirstPermittedRoute([])).toBe('/forbidden');
  });

  it('returns /forbidden for empty array', () => {
    expect(getFirstPermittedRoute([])).toBe('/forbidden');
  });
});
