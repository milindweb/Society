/* toastStore.tsx — state/toastStore: transient notifications */

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  add: (type: ToastType, message: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

let nextId = 0;

export const toastStore: ToastState = {
  toasts: [],
  add(type, message) {
    const id = `toast-${++nextId}`;
    this.toasts = [...this.toasts, { id, type, message }];
    notify();
  },
  remove(id) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    notify();
  },
  clear() {
    this.toasts = [];
    notify();
  },
};

let listeners: (() => void)[] = [];

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeToast(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((fn) => fn !== listener);
  };
}

export function getToastSnapshot(): Toast[] {
  return toastStore.toasts;
}
