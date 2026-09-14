/* AppShell.tsx — design.md §23: Application Shell layout */

import { type ReactNode } from 'react';

interface AppShellProps {
  header: ReactNode;
  sidebar: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function AppShell({ header, sidebar, footer, children }: AppShellProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {header}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {sidebar}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: 'var(--space-5)',
            maxWidth: 'var(--content-max)',
            overflow: 'auto',
          }}
        >
          {children}
        </main>
      </div>
      {footer}
    </div>
  );
}
