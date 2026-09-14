/* AppProviders.tsx — wraps app with context providers */

import { type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ErrorBoundary>
      <BrowserRouter>{children}</BrowserRouter>
    </ErrorBoundary>
  );
}
