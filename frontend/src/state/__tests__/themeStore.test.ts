/* themeStore.test.ts — Tests for theme state store */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('themeStore', () => {
  let localStorageStore: Record<string, string>;

  beforeEach(() => {
    localStorageStore = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageStore[key];
      }),
      clear: vi.fn(() => {
        localStorageStore = {};
      }),
      get length() {
        return Object.keys(localStorageStore).length;
      },
      key: vi.fn(),
    });

    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('initializes with system mode by default', async () => {
    const { themeStore } = await import('@/state/themeStore');
    expect(themeStore.mode).toBe('system');
  });

  it('initializes with stored theme from localStorage', async () => {
    localStorageStore['theme'] = 'dark';
    const { themeStore } = await import('@/state/themeStore');
    expect(themeStore.mode).toBe('dark');
    expect(themeStore.resolved).toBe('dark');
  });

  it('setMode updates mode and saves to localStorage', async () => {
    const { themeStore } = await import('@/state/themeStore');
    themeStore.setMode('light');
    expect(themeStore.mode).toBe('light');
    expect(themeStore.resolved).toBe('light');
    expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'light');
  });

  it('setMode applies theme to document', async () => {
    const { themeStore } = await import('@/state/themeStore');
    themeStore.setMode('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('resolves system theme based on matchMedia', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);

    const { themeStore } = await import('@/state/themeStore');
    expect(themeStore.resolved).toBe('dark');
  });
});
