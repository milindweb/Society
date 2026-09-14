/* NotFound.tsx — design.md §6: 404 page */

import { Button } from '@/components/ui/Button';

export function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)' }}>
        404
      </h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
        The page you are looking for does not exist.
      </p>
      <Button onClick={() => (window.location.href = '/dashboard')}>Go to Dashboard</Button>
    </div>
  );
}
