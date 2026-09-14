/* Toast.tsx — design.md §87: transient notifications */

import { useEffect } from 'react';
import { IconButton } from './IconButton';

interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onDismiss: (id: string) => void;
}

export function Toast({ id, type, message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), 5000);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <div className={`hs-toast hs-toast--${type}`}>
      <span style={{ flex: 1 }}>{message}</span>
      <IconButton
        icon={<span style={{ fontSize: '1rem', lineHeight: 1 }}>×</span>}
        label="Dismiss"
        onClick={() => onDismiss(id)}
        size="sm"
        variant="ghost"
      />
    </div>
  );
}

interface ToastContainerProps {
  toasts: { id: string; type: 'success' | 'error' | 'warning' | 'info'; message: string }[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="hs-toast-container">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
