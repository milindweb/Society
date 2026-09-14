/* themeStore.tsx — design.md §11: light | dark | system */

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemTheme() : mode;
}

function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', resolved);
}

let state: ThemeState;

function createStore(): ThemeState {
  const stored = (localStorage.getItem('theme') as ThemeMode) || 'system';
  const resolved = resolve(stored);

  applyTheme(resolved);

  state = {
    mode: stored,
    resolved,
    setMode: (mode: ThemeMode) => {
      state.mode = mode;
      state.resolved = resolve(mode);
      localStorage.setItem('theme', mode);
      applyTheme(state.resolved);
    },
  };

  if (stored === 'system') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      state.resolved = resolve(state.mode);
      applyTheme(state.resolved);
    });
  }

  return state;
}

export const themeStore = createStore();
