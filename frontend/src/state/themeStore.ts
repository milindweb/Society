/* themeStore.ts — design.md §7/§11: light | dark | system
 *
 * A tiny external store (same shape as `navStore`) so React can subscribe with
 * `useSyncExternalStore` instead of reading a mutable object during render.
 *
 * FE-15 hardening:
 *  - storage access is wrapped: `localStorage` throws outright when cookies or
 *    site data are blocked, which previously crashed the module at import time;
 *  - the persisted value is validated, so a stale/garbage entry can no longer
 *    resolve to an unknown `data-theme` and leave the app with no tokens at all;
 *  - the `prefers-color-scheme` listener is attached once and gated on the
 *    *current* mode, so choosing "system" after load now actually follows the OS
 *    (previously the listener was only wired when the *initial* value was
 *    "system", and never removed once it stopped applying).
 *
 * The pre-paint bootstrap in `index.html` mirrors the resolution logic below.
 * Keep the two in sync. */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeSnapshot {
  mode: ThemeMode;
  resolved: ResolvedTheme;
}

export interface ThemeStore extends ThemeSnapshot {
  setMode: (mode: ThemeMode) => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ThemeSnapshot;
}

const STORAGE_KEY = 'theme';
const MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];
const DARK_QUERY = '(prefers-color-scheme: dark)';

function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value);
}

/** `localStorage` access is not guaranteed: it throws when storage is disabled
 *  (private mode, blocked cookies, sandboxed iframe). */
function readStoredMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isThemeMode(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

function persistMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* persistence is best-effort; the in-memory mode still applies */
  }
}

function prefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

function resolve(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return prefersDark() ? 'dark' : 'light';
  return mode;
}

function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolved);
}

function createStore(): ThemeStore {
  const initialMode = readStoredMode();
  let snapshot: ThemeSnapshot = { mode: initialMode, resolved: resolve(initialMode) };

  const listeners = new Set<() => void>();

  applyTheme(snapshot.resolved);

  /* One listener for the lifetime of the page, gated on the *current* mode, so
     switching into and out of "system" works in both directions. */
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mediaQuery = window.matchMedia(DARK_QUERY);
    const onSystemPreferenceChange = () => {
      if (snapshot.mode !== 'system') return;
      const resolved = resolve('system');
      if (resolved === snapshot.resolved) return;
      snapshot = { ...snapshot, resolved };
      applyTheme(resolved);
      listeners.forEach((listener) => listener());
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onSystemPreferenceChange);
    } else if (typeof mediaQuery.addListener === 'function') {
      /* Safari < 14 */
      mediaQuery.addListener(onSystemPreferenceChange);
    }
  }

  return {
    get mode() {
      return snapshot.mode;
    },
    get resolved() {
      return snapshot.resolved;
    },
    setMode: (next: ThemeMode) => {
      if (!isThemeMode(next) || next === snapshot.mode) return;
      snapshot = { mode: next, resolved: resolve(next) };
      persistMode(next);
      applyTheme(snapshot.resolved);
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
  };
}

export const themeStore: ThemeStore = createStore();
