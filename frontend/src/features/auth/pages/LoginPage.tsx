/* LoginPage.tsx — FE-03 stub (will be fully implemented in FE-03) */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { authStore } from '@/state/authStore';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { login } = await import('@/services/authService');
      const result = await login(username, password);
      authStore.setAuth(result.token, result.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--color-bg)',
        padding: 'var(--space-4)',
      }}
    >
      <div className="hs-card hs-card--raised" style={{ width: '100%', maxWidth: '24rem', padding: 'var(--space-8)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--color-brand)' }}>
            Society Management
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
            Sign in to your account
          </p>
        </div>

        {error && (
          <div className="hs-alert hs-alert--danger" style={{ marginBottom: 'var(--space-4)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <FormField label="Username" required>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              required
            />
          </FormField>

          <div style={{ marginTop: 'var(--space-3)' }}>
            <FormField label="Password" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </FormField>
          </div>

          <Button
            type="submit"
            loading={loading}
            style={{ width: '100%', marginTop: 'var(--space-5)' }}
          >
            Sign In
          </Button>
        </form>
      </div>

      <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
        Designed by:{' '}
        <a href="https://mk9.in" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-brand)', fontWeight: 'var(--weight-medium)' }}>
          MAMK
        </a>
      </p>
    </div>
  );
}
