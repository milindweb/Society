/* PageContainer.tsx — design.md §30: main content wrapper */

import { type ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={className} style={{ maxWidth: 'var(--content-max)', margin: '0 auto' }}>
      {children}
    </div>
  );
}
