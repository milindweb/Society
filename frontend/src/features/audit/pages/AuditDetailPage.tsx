/* AuditDetailPage.tsx — FE-14: Audit entry detail with before/after JSON */

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuditDetail } from '../hooks/useAudit';
import { formatDateTime } from '@/lib/dates';

const mono = { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' } as const;

/** `beforeJson` / `afterJson` arrive as **strings** and are already redacted by
 *  `BackupService.redactAuditJson` — secrets replaced with `[REDACTED]`, long
 *  payloads cut to 5000 chars and suffixed `...[TRUNCATED]`.
 *
 *  We therefore do NOT re-redact on the client: the server owns that list
 *  (`SECRET_FIELDS`, `BackupService.gs:381`) and a second, drifting copy would
 *  only hide a server regression. We only pretty-print, and fall back to the raw
 *  string when truncation has left the payload unparseable. */
function prettyJson(raw: string): string | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (value === null) return null;
    if (typeof value === 'object' && Object.keys(value as object).length === 0) return null;
    return JSON.stringify(value, null, 2);
  } catch {
    return raw;
  }
}

function JsonBlock({ label, raw }: { label: string; raw: string }) {
  const pretty = prettyJson(raw);

  if (!pretty) {
    return (
      <Card>
        <CardHeader title={label} />
        <CardBody>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No data</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title={label} />
      <CardBody>
        <pre
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            overflow: 'auto',
            maxHeight: 320,
            whiteSpace: 'pre-wrap',
            margin: 0,
          }}
        >
          {pretty}
        </pre>
      </CardBody>
    </Card>
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
        <Alert variant="danger">{error}</Alert>
        <Button
          variant="ghost"
          onClick={() => navigate('/settings/audit')}
          style={{ marginTop: 'var(--space-4)' }}
        >
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
        subtitle={`${entry.entity}${entry.entityId ? ` — ${entry.entityId}` : ''}`}
        actions={
          <Button variant="ghost" onClick={() => navigate('/settings/audit')}>
            Back
          </Button>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <Card>
          <CardHeader title="Change" />
          <CardBody>
            <DescriptionList
              items={[
                { label: 'Audit ID', value: <span style={mono}>{entry.auditId}</span> },
                { label: 'Entity', value: entry.entity || '—' },
                { label: 'Record ID', value: <span style={mono}>{entry.entityId || '—'}</span> },
                { label: 'Label', value: entry.entityLabel || '—' },
                { label: 'Action', value: entry.action || '—' },
                {
                  label: 'Changed fields',
                  value: <span style={mono}>{entry.changedFields || '—'}</span>,
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Who & when" />
          <CardBody>
            <DescriptionList
              items={[
                { label: 'Actor', value: entry.actorName || entry.actorUserId || '—' },
                { label: 'User ID', value: <span style={mono}>{entry.actorUserId || '—'}</span> },
                { label: 'Roles', value: <span style={mono}>{entry.actorRoleKeys || '—'}</span> },
                { label: 'When', value: entry.ts ? formatDateTime(entry.ts) : '—' },
                {
                  label: 'Result',
                  value: entry.result ? <StatusBadge statusKey={entry.result} /> : '—',
                },
                { label: 'Source sheet', value: entry.sourceSheet || '—' },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      {entry.reason && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="info">
            <strong>Reason:</strong> {entry.reason}
          </Alert>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <JsonBlock label="Before" raw={entry.beforeJson} />
        <JsonBlock label="After" raw={entry.afterJson} />
      </div>

      {entry.requestId && (
        <p
          style={{
            ...mono,
            marginTop: 'var(--space-4)',
            color: 'var(--color-text-muted)',
          }}
        >
          Request ID: {entry.requestId}
        </p>
      )}
    </div>
  );
}
