/* navStore.tsx — design.md §5: nav items derived from permissions */

import { filterNavByPermissions, getFirstPermittedRoute } from '@/lib/permission';
import type { IconName } from '@/components/ui/Icon';

export interface NavItem {
  key: string;
  label: string;
  icon: IconName;
  route: string;
  permission: string;
}

let currentPermissions: string[] = [];
let navItems: NavItem[] = [];
let listeners: (() => void)[] = [];

function notify() {
  listeners.forEach((fn) => fn());
}

export const navStore = {
  init(permissions: string[]) {
    currentPermissions = permissions;
    navItems = filterNavByPermissions(permissions) as NavItem[];
    notify();
  },

  getItems(): NavItem[] {
    return navItems;
  },

  getFirstRoute(): string {
    return getFirstPermittedRoute(currentPermissions);
  },

  clear() {
    currentPermissions = [];
    navItems = [];
    notify();
  },
};

export function subscribeNav(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((fn) => fn !== listener);
  };
}

export function getNavSnapshot(): NavItem[] {
  return navItems;
}
