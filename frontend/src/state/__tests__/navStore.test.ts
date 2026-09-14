/* navStore.test.ts — Tests for navigation state store */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { navStore, subscribeNav, getNavSnapshot } from '@/state/navStore';

describe('navStore', () => {
  beforeEach(() => {
    navStore.clear();
  });

  describe('init', () => {
    it('populates nav items based on permissions', () => {
      navStore.init(['dashboard.read', 'members.read']);
      const items = navStore.getItems();
      expect(items.length).toBeGreaterThan(0);
      expect(items.map((n) => n.key)).toContain('dashboard');
      expect(items.map((n) => n.key)).toContain('members');
    });

    it('only includes items user has permission for', () => {
      navStore.init(['dashboard.read']);
      const items = navStore.getItems();
      expect(items.map((n) => n.key)).toContain('dashboard');
      expect(items.map((n) => n.key)).not.toContain('members');
    });

    it('includes all items for wildcard permission', () => {
      navStore.init(['*']);
      const items = navStore.getItems();
      expect(items.length).toBeGreaterThan(5);
    });
  });

  describe('getItems', () => {
    it('returns empty array before init', () => {
      expect(navStore.getItems()).toHaveLength(0);
    });

    it('returns items after init', () => {
      navStore.init(['dashboard.read']);
      expect(navStore.getItems().length).toBeGreaterThan(0);
    });
  });

  describe('getFirstRoute', () => {
    it('returns first permitted route', () => {
      navStore.init(['dashboard.read', 'members.read']);
      expect(navStore.getFirstRoute()).toBe('/dashboard');
    });

    it('returns /forbidden when no permissions', () => {
      expect(navStore.getFirstRoute()).toBe('/forbidden');
    });
  });

  describe('clear', () => {
    it('clears all nav items', () => {
      navStore.init(['*']);
      navStore.clear();
      expect(navStore.getItems()).toHaveLength(0);
    });
  });

  describe('subscribeNav', () => {
    it('notifies on init', () => {
      const listener = vi.fn();
      subscribeNav(listener);
      navStore.init(['dashboard.read']);
      expect(listener).toHaveBeenCalled();
    });

    it('notifies on clear', () => {
      const listener = vi.fn();
      subscribeNav(listener);
      navStore.clear();
      expect(listener).toHaveBeenCalled();
    });

    it('returns unsubscribe function', () => {
      const listener = vi.fn();
      const unsub = subscribeNav(listener);
      unsub();
      navStore.init(['dashboard.read']);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getNavSnapshot', () => {
    it('returns current nav items', () => {
      navStore.init(['dashboard.read']);
      const snapshot = getNavSnapshot();
      expect(snapshot.length).toBeGreaterThan(0);
    });

    it('returns empty array before init', () => {
      expect(getNavSnapshot()).toHaveLength(0);
    });
  });
});
