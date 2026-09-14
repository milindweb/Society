/* Forbidden.tsx — design.md §6: permission denied page */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function Forbidden() {
  const navigate = useNavigate();

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
        Access Denied
      </h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
        You do not have permission to access this page.
      </p>
      <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
    </div>
  );
}
