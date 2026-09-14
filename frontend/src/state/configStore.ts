/* configStore.ts — state/configStore: society config + enums */

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

export function getConfigSnapshot(): { config: SocietyConfig | null; enums: ConfigEnums | null; loaded: boolean } {
  return { config: configStore.config, enums: configStore.enums, loaded: configStore.loaded };
}

/* Default values for currency when config hasn't loaded */
export function useConfigStore() {
  const state = getConfigSnapshot();
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
