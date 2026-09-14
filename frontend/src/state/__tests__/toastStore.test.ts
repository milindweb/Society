/* toastStore.test.ts — Tests for toast state store */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toastStore, subscribeToast, getToastSnapshot } from '@/state/toastStore';

describe('toastStore', () => {
  beforeEach(() => {
    toastStore.clear();
  });

  describe('add', () => {
    it('adds a toast with generated id', () => {
      toastStore.add('success', 'Operation completed');
      expect(toastStore.toasts).toHaveLength(1);
      expect(toastStore.toasts[0].message).toBe('Operation completed');
      expect(toastStore.toasts[0].type).toBe('success');
      expect(toastStore.toasts[0].id).toMatch(/^toast-\d+$/);
    });

    it('generates incrementing ids', () => {
      toastStore.add('info', 'First');
      toastStore.add('info', 'Second');
      expect(toastStore.toasts[0].id).not.toBe(toastStore.toasts[1].id);
    });

    it('supports different toast types', () => {
      toastStore.add('success', 'ok');
      toastStore.add('error', 'fail');
      toastStore.add('warning', 'careful');
      toastStore.add('info', 'fyi');
      expect(toastStore.toasts).toHaveLength(4);
      expect(toastStore.toasts.map((t) => t.type)).toEqual(['success', 'error', 'warning', 'info']);
    });
  });

  describe('remove', () => {
    it('removes a toast by id', () => {
      toastStore.add('success', 'ok');
      const id = toastStore.toasts[0].id;
      toastStore.remove(id);
      expect(toastStore.toasts).toHaveLength(0);
    });

    it('does not remove other toasts', () => {
      toastStore.add('success', 'first');
      toastStore.add('error', 'second');
      const id = toastStore.toasts[0].id;
      toastStore.remove(id);
      expect(toastStore.toasts).toHaveLength(1);
      expect(toastStore.toasts[0].message).toBe('second');
    });

    it('handles removing non-existent id gracefully', () => {
      toastStore.add('success', 'ok');
      toastStore.remove('toast-999');
      expect(toastStore.toasts).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('removes all toasts', () => {
      toastStore.add('success', 'a');
      toastStore.add('error', 'b');
      toastStore.clear();
      expect(toastStore.toasts).toHaveLength(0);
    });
  });

  describe('subscribeToast', () => {
    it('notifies on add', () => {
      const listener = vi.fn();
      subscribeToast(listener);
      toastStore.add('success', 'ok');
      expect(listener).toHaveBeenCalled();
    });

    it('notifies on remove', () => {
      const listener = vi.fn();
      subscribeToast(listener);
      toastStore.add('success', 'ok');
      toastStore.remove(toastStore.toasts[0].id);
      expect(listener).toHaveBeenCalled();
    });

    it('notifies on clear', () => {
      const listener = vi.fn();
      subscribeToast(listener);
      toastStore.clear();
      expect(listener).toHaveBeenCalled();
    });

    it('returns unsubscribe function', () => {
      const listener = vi.fn();
      const unsub = subscribeToast(listener);
      unsub();
      toastStore.add('success', 'ok');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getToastSnapshot', () => {
    it('returns current toasts', () => {
      toastStore.add('success', 'ok');
      const snapshot = getToastSnapshot();
      expect(snapshot).toHaveLength(1);
      expect(snapshot[0].message).toBe('ok');
    });

    it('returns empty array when no toasts', () => {
      expect(getToastSnapshot()).toHaveLength(0);
    });
  });
});
