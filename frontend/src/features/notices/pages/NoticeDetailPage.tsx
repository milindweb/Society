/* NoticeDetailPage.tsx — FE-08
 * SRS §6: publish / unpublish, description, attachment, target audience.
 *
 * Only legal actions are rendered, mirroring the service's own guards:
 *   DRAFT     → Publish (optional publish date / expiry) and Edit
 *   PUBLISHED → Unpublish, which REQUIRES a reason (the route validator demands it)
 *   EXPIRED   → read-only
 * The backend stays the authority; a rejection surfaces its own message.
 *
 * No optimistic UI (SRS §23): every action reloads the notice from the server. */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { PermissionGate } from '@/app/PermissionGate';
import { useNotice } from '../hooks/useNotices';
import { useAudienceTypeOptions } from '../hooks/useNoticeLookups';
import { formatDate, formatDateTime } from '@/lib/dates';
import {
  canEditNotice,
  canPublishNotice,
  canUnpublishNotice,
  isTrueFlag,
} from '@/services/noticeService';

export default function NoticeDetailPage() {
  const navigate = useNavigate();
  const { noticeId } = useParams<{ noticeId: string }>();

  const audiences = useAudienceTypeOptions();
  const { notice, loading, error, busy, reload, publish, unpublish } = useNotice(noticeId);

  const [publishOpen, setPublishOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [publishDate, setPublishDate] = useState('');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner />
      </div>
    );
  }

  if (error && !notice) {
    return (
      <div>
        <PageHeader title="Notice" />
        <ErrorState message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  if (!notice) {
    return (
      <div>
        <PageHeader title="Notice" />
        <Alert variant="warning">This notice could not be found.</Alert>
      </div>
    );
  }

  const audienceLabel =
    audiences.options.find((option) => option.value === notice.audienceType)?.label ??
    notice.audienceType ??
    '—';

  const handlePublish = async () => {
    await publish({
      publishDate: publishDate || undefined,
    });
    setPublishOpen(false);
    setPublishDate('');
  };

  const handleUnpublish = async () => {
    /* The route validator rejects an empty reason, so block it here rather than
     * round-tripping to earn a VALIDATION_ERROR. */
    if (!reason.trim()) {
      setReasonError('A reason is required to unpublish.');
      return;
    }
    await unpublish(reason.trim());
    setUnpublishOpen(false);
    setReason('');
    setReasonError(undefined);
  };

  const isDraft = canEditNotice(notice.statusKey);

  const overview = (
    <DescriptionList
      columns={2}
      items={[
        { label: 'Number', value: notice.noticeNumber },
        { label: 'Status', value: <StatusBadge statusKey={notice.statusKey} /> },
        { label: 'Type', value: notice.noticeTypeName || notice.noticeTypeId || '—' },
        { label: 'Notice date', value: formatDate(notice.noticeDate) },
        { label: 'Audience', value: audienceLabel },
        {
          label: 'Audience reference',
          /* ALL needs no reference, so showing one would be noise. */
          value: notice.audienceType === 'ALL' || !notice.audienceRef ? '—' : notice.audienceRef,
        },
        {
          label: 'Published',
          value: notice.publishedAt ? formatDateTime(notice.publishedAt) : 'Not published',
        },
        { label: 'Publish date', value: notice.publishDate ? formatDate(notice.publishDate) : '—' },
        { label: 'Expires', value: notice.expiryDate ? formatDate(notice.expiryDate) : '—' },
        { label: 'Pinned', value: isTrueFlag(notice.isPinned) ? 'Yes' : 'No' },
        { label: 'Description', value: notice.description || '—', span: 2 },
      ]}
    />
  );

  const archive = (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
        Notices are never deleted. This record is the archive entry for {notice.noticeNumber}.
      </p>
      <DescriptionList
        columns={2}
        items={[
          { label: 'Created notice date', value: formatDate(notice.noticeDate) },
          {
            label: 'Unpublish reason',
            value: notice.unpublishReason || '—',
          },
          { label: 'Attachment', value: notice.attachmentRef || 'None' },
        ]}
      />
    </div>
  );

  const actions = (
    <PermissionGate permission="notices.write">
      {canPublishNotice(notice.statusKey) ? (
        <Button onClick={() => setPublishOpen(true)} disabled={busy}>
          Publish
        </Button>
      ) : null}
      {canUnpublishNotice(notice.statusKey) ? (
        <Button variant="secondary" onClick={() => setUnpublishOpen(true)} disabled={busy}>
          Unpublish
        </Button>
      ) : null}
      {isDraft ? (
        <Button variant="ghost" onClick={() => navigate(`/notices/${notice.noticeId}/edit`)} disabled={busy}>
          Edit
        </Button>
      ) : null}
    </PermissionGate>
  );

  return (
    <div>
      <PageHeader
        title={notice.title}
        subtitle={notice.noticeNumber}
        actions={actions}
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Notices', route: '/notices', onClick: () => navigate('/notices') },
              { label: notice.noticeNumber },
            ]}
          />
        }
      />

      {error ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">{error}</Alert>
        </div>
      ) : null}

      {notice.statusKey === 'DRAFT' ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="info">
            This notice is a draft. It is not visible to members until it is published.
          </Alert>
        </div>
      ) : null}

      <Card>
        <CardBody>
          <Tabs
            tabs={[
              { key: 'overview', label: 'Overview', content: overview },
              { key: 'archive', label: 'Archive', content: archive },
            ]}
          />
        </CardBody>
      </Card>

      {/* Publish — optional publish date; the server defaults it to today. */}
      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Publish notice"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPublishOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void handlePublish()} loading={busy}>
              Publish
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
            Publishing makes this notice visible to its audience ({audienceLabel}).
          </p>
          <FormField label="Publish date" hint="Optional — defaults to today.">
            <Input
              type="date"
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
            />
          </FormField>
        </div>
      </Modal>

      {/* Unpublish — the reason is mandatory (route validator). */}
      <Modal
        open={unpublishOpen}
        onClose={() => setUnpublishOpen(false)}
        title="Unpublish notice"
        footer={
          <>
            <Button variant="ghost" onClick={() => setUnpublishOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void handleUnpublish()} loading={busy}>
              Unpublish
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
            The notice returns to draft and stops being visible to members.
          </p>
          <FormField label="Reason" required error={reasonError} hint="Recorded in the audit trail.">
            <Textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError) setReasonError(undefined);
              }}
              rows={3}
              placeholder="e.g. Superseded by a revised circular"
              error={reasonError}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
