/* useTheme.ts — subscribe React to `themeStore` (design.md §7).
 *
 * The store is external to React, so components must subscribe rather than read
 * a mutable object during render: without this, an OS-level light/dark switch
 * (mode = "system") updates `data-theme` but leaves every component rendering
 * the stale value. */

import { useSyncExternalStore } from 'react';
import { themeStore, type ThemeMode, type ThemeSnapshot } from '@/state/themeStore';

export interface UseThemeResult extends ThemeSnapshot {
  setMode: (mode: ThemeMode) => void;
}

export function useTheme(): UseThemeResult {
  const snapshot = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getSnapshot,
  );

  return { mode: snapshot.mode, resolved: snapshot.resolved, setMode: themeStore.setMode };
}

/** The next mode in the light → dark → system cycle. */
export function nextThemeMode(mode: ThemeMode): ThemeMode {
  if (mode === 'light') return 'dark';
  if (mode === 'dark') return 'system';
  return 'light';
}
