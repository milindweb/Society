/* configStore.ts — state/configStore: society config + enums */

import { useSyncExternalStore } from 'react';
import type { SocietyConfig, ConfigEnums } from '@/types/domain';

interface ConfigState {
  config: SocietyConfig | null;
  enums: ConfigEnums | null;
  loaded: boolean;
  setConfig: (config: SocietyConfig) => void;
  setEnums: (enums: ConfigEnums) => void;
  clear: () => void;
}

export const configStore: ConfigState = {
  config: null,
  enums: null,
  loaded: false,

  setConfig(config) {
    this.config = config;
    this.loaded = true;
    notify();
  },

  setEnums(enums) {
    this.enums = enums;
    notify();
  },

  clear() {
    this.config = null;
    this.enums = null;
    this.loaded = false;
    notify();
  },
};

let listeners: (() => void)[] = [];

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeConfig(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((fn) => fn !== listener);
  };
}

export interface ConfigSnapshot {
  config: SocietyConfig | null;
  enums: ConfigEnums | null;
  loaded: boolean;
}

/* `useSyncExternalStore` bails out of a re-render only when the snapshot it reads
 * is referentially equal to the previous one, so this getter must NOT allocate a
 * fresh object on every call — doing so re-renders forever. The cache is keyed on
 * the three underlying values rather than invalidated by `notify()`, so it stays
 * correct even when a caller assigns to `configStore` directly. */
let cachedSnapshot: ConfigSnapshot | null = null;

export function getConfigSnapshot(): ConfigSnapshot {
  const config = configStore.config;
  const enums = configStore.enums;
  const loaded = configStore.loaded;
  if (
    cachedSnapshot &&
    cachedSnapshot.config === config &&
    cachedSnapshot.enums === enums &&
    cachedSnapshot.loaded === loaded
  ) {
    return cachedSnapshot;
  }
  cachedSnapshot = { config, enums, loaded };
  return cachedSnapshot;
}

/* Default values for currency when config hasn't loaded.
 *
 * This SUBSCRIBES. It previously read a snapshot during render without
 * subscribing, so a component that mounted before `config.get` resolved kept the
 * default `₹` and an empty society name until some unrelated re-render happened
 * — which is why the printed receipt showed the wrong currency. */
export function useConfigStore() {
  const state = useSyncExternalStore(subscribeConfig, getConfigSnapshot, getConfigSnapshot);
  return {
    ...state,
    currencyCode: state.config?.currencyCode ?? 'INR',
    currencySymbol: state.config?.currencySymbol ?? '₹',
    societyName: state.config?.societyName ?? '',
    dateDisplayFormat: state.config?.dateDisplayFormat ?? 'DD/MM/YYYY',
    searchMinChars: state.config?.searchMinChars ?? 2,
    pageSizeDefault: state.config?.pageSizeDefault ?? 25,
  };
}
