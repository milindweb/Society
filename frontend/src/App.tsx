/* App.tsx — root application component */

import { AppProviders } from './app/AppProviders';
import { AppRouter } from './app/AppRouter';
import { ToastContainer } from '@/components/ui/Toast';
import { toastStore, subscribeToast, getToastSnapshot } from '@/state/toastStore';
import { useState, useEffect } from 'react';

function Toasts() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return subscribeToast(() => setTick((t) => t + 1));
  }, []);

  const toasts = getToastSnapshot();
  return (
    <ToastContainer
      toasts={toasts}
      onDismiss={(id) => toastStore.remove(id)}
    />
  );
}

export default function App() {
  return (
    <AppProviders>
      <AppRouter />
      <Toasts />
    </AppProviders>
  );
}
