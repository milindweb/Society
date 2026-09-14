/* AuditDetailPage.tsx — FE-14: Audit entry detail with before/after JSON */

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuditDetail } from '../hooks/useAudit';

function JsonView({ label, data }: { label: string; data?: Record<string, unknown> }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div>
        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-2)' }}>
          {label}
        </h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No data</p>
      </div>
    );
  }

  const redacted = Object.fromEntries(
    Object.entries(data).map(([k, v]) => {
      if (typeof v === 'string' && (k.toLowerCase().includes('password') || k.toLowerCase().includes('token') || k.toLowerCase().includes('secret'))) {
        return [k, '***REDACTED***'];
      }
      return [k, v];
    }),
  );

  return (
    <div>
      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-2)' }}>
        {label}
      </h4>
      <pre
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3)',
          fontSize: 'var(--text-xs)',
          fontFamily: 'var(--font-mono)',
          overflow: 'auto',
          maxHeight: 300,
          whiteSpace: 'pre-wrap',
        }}
      >
        {JSON.stringify(redacted, null, 2)}
      </pre>
    </div>
  );
}

export default function AuditDetailPage() {
  const { auditId } = useParams<{ auditId: string }>();
  const navigate = useNavigate();
  const { entry, loading, error, fetchEntry } = useAuditDetail();

  useEffect(() => {
    if (auditId) fetchEntry(auditId);
  }, [auditId, fetchEntry]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Audit Entry" subtitle="Error loading entry" />
        <div className="hs-alert hs-alert--danger">{error}</div>
        <Button variant="ghost" onClick={() => navigate('/settings/audit')} style={{ marginTop: 'var(--space-4)' }}>
          Back to Audit
        </Button>
      </div>
    );
  }

  if (!entry) return null;

  return (
    <div>
      <PageHeader
        title={`Audit: ${entry.action}`}
        subtitle={`${entry.entity} — ${entry.entityId}`}
        actions={
          <Button variant="ghost" onClick={() => navigate('/settings/audit')}>
            Back
          </Button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <Card>
          <CardBody>
            <dl style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
              <dt style={{ color: 'var(--color-text-muted)' }}>Audit ID</dt>
              <dd style={{ fontFamily: 'var(--font-mono)', margin: '0 0 var(--space-3)' }}>{entry.auditId}</dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>Entity</dt>
              <dd style={{ margin: '0 0 var(--space-3)' }}>{entry.entity}</dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>Record ID</dt>
              <dd style={{ fontFamily: 'var(--font-mono)', margin: '0 0 var(--space-3)' }}>{entry.entityId}</dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>Action</dt>
              <dd style={{ margin: '0 0 var(--space-3)' }}>{entry.action}</dd>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <dl style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
              <dt style={{ color: 'var(--color-text-muted)' }}>Actor</dt>
              <dd style={{ margin: '0 0 var(--space-3)' }}>{entry.actorName ?? entry.actorUserId}</dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>User ID</dt>
              <dd style={{ fontFamily: 'var(--font-mono)', margin: '0 0 var(--space-3)' }}>{entry.actorUserId}</dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>Timestamp</dt>
              <dd style={{ margin: '0 0 var(--space-3)' }}>{new Date(entry.timestamp).toLocaleString()}</dd>
            </dl>
          </CardBody>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        <Card>
          <CardBody>
            <JsonView label="Before" data={entry.before} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <JsonView label="After" data={entry.after} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
