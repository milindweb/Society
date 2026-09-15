/* DocumentDetailPage.tsx — FE-09
 * SRS §9: view, download and archive a document, plus its category, date,
 * description and related module.
 *
 * Contract notes (verified against backend/src/DocumentService.gs):
 * - `documents.get` returns the document row directly; `fileRef` is a JSON string
 *   that must be parsed before the Drive url can be used (SRS §9: Sheets keep the
 *   metadata/reference, Drive keeps the file).
 * - `documents.archive` requires a `reason` and REFUSES an already-archived
 *   document ("Document is already archived."). There is no un-archive route, so
 *   the action is offered once and never again.
 * - `documents.update` patches metadata only — title, description, tags,
 *   linkedEntityType, linkedEntityId, categoryId, effectiveDate, expiryDate. The
 *   file, the version and the status are server-owned.
 * - Uploading a new file against this document increments `versionNo`; the previous
 *   file stays in Drive. The page says so rather than implying a replacement.
 *
 * No optimistic UI (SRS §23): every action reloads the document from the server. */

import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
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
import { LookupSelect } from '@/components/data/LookupSelect';
import { DocumentUploadModal } from '../components/DocumentUploadModal';
import { useDocument } from '../hooks/useDocuments';
import {
  useDocumentCategoryOptions,
  useLinkedEntityTypeOptions,
} from '../hooks/useDocumentLookups';
import { parseFileRef, canArchiveDocument, formatFileSize } from '@/services/documentService';
import { required, validate, type FormErrors } from '@/lib/validation';
import { formatDate, formatDateTime } from '@/lib/dates';

interface MetadataFormState {
  title: string;
  categoryId: string;
  description: string;
  tags: string;
  linkedEntityType: string;
  linkedEntityId: string;
  effectiveDate: string;
  expiryDate: string;
}

const EMPTY_FORM: MetadataFormState = {
  title: '',
  categoryId: '',
  description: '',
  tags: '',
  linkedEntityType: '',
  linkedEntityId: '',
  effectiveDate: '',
  expiryDate: '',
};

export default function DocumentDetailPage() {
  const navigate = useNavigate();
  const { documentId } = useParams<{ documentId: string }>();

  const categories = useDocumentCategoryOptions();
  const entities = useLinkedEntityTypeOptions();

  const { document, loading, error, busy, reload, update, archive } = useDocument(documentId);

  const [editing, setEditing] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const [form, setForm] = useState<MetadataFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>();

  /* Hydrate whenever the document changes and no edit is open, so a cancelled
   * edit cannot leave stale text behind. */
  useEffect(() => {
    if (document && !editing) {
      setForm({
        title: document.title ?? '',
        categoryId: document.categoryId ?? '',
        description: document.description ?? '',
        tags: document.tags ?? '',
        linkedEntityType: document.linkedEntityType ?? '',
        linkedEntityId: document.linkedEntityId ?? '',
        effectiveDate: document.effectiveDate ?? '',
        expiryDate: document.expiryDate ?? '',
      });
    }
  }, [document, editing]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner />
      </div>
    );
  }

  if (error && !document) {
    return (
      <div>
        <PageHeader title="Document" />
        <ErrorState message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  if (!document) {
    return (
      <div>
        <PageHeader title="Document" />
        <Alert variant="warning">This document could not be found.</Alert>
      </div>
    );
  }

  const file = parseFileRef(document.fileRef);
  const categoryLabel =
    document.categoryName ||
    categories.options.find((option) => option.value === document.categoryId)?.label ||
    document.categoryId ||
    '—';

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();

    const nextErrors: FormErrors = {};
    const titleError = validate(form.title.trim(), [required('Title is required')]);
    if (titleError) nextErrors.title = titleError;
    const categoryError = validate(form.categoryId, [required('Category is required')]);
    if (categoryError) nextErrors.categoryId = categoryError;
    /* The service stores the two link halves independently, but a half-link is
     * useless as a reference, so require both or neither. */
    if (form.linkedEntityType && !form.linkedEntityId.trim()) {
      nextErrors.linkedEntityId = 'Enter the id of the linked record.';
    }
    if (!form.linkedEntityType && form.linkedEntityId.trim()) {
      nextErrors.linkedEntityType = 'Choose which kind of record this id belongs to.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    await update({
      title: form.title.trim(),
      categoryId: form.categoryId,
      description: form.description.trim(),
      tags: form.tags.trim(),
      linkedEntityType: form.linkedEntityType,
      linkedEntityId: form.linkedEntityId.trim(),
      effectiveDate: form.effectiveDate,
      expiryDate: form.expiryDate,
    });
    setFormErrors({});
    setEditing(false);
  };

  const handleArchive = async () => {
    if (!reason.trim()) {
      setReasonError('A reason is required to archive.');
      return;
    }
    await archive(reason.trim());
    setArchiveOpen(false);
    setReason('');
    setReasonError(undefined);
  };

  const overview = (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      {error ? <Alert variant="danger">{error}</Alert> : null}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <PermissionGate permission="documents.write">
          <Button
            variant="ghost"
            icon={<Icon name="edit" size={16} />}
            onClick={() => setEditing(true)}
            disabled={busy}
          >
            Edit metadata
          </Button>
        </PermissionGate>
      </div>

      <DescriptionList
        columns={2}
        items={[
          { label: 'Number', value: document.documentNumber },
          { label: 'Status', value: <StatusBadge statusKey={document.statusKey} /> },
          { label: 'Category', value: categoryLabel },
          { label: 'Version', value: document.versionNo || '—' },
          {
            label: 'Effective date',
            value: document.effectiveDate ? formatDate(document.effectiveDate) : '—',
          },
          {
            label: 'Expiry date',
            value: document.expiryDate ? formatDate(document.expiryDate) : '—',
          },
          {
            label: 'Related module',
            value: document.linkedEntityType || 'Not linked',
          },
          {
            label: 'Related record',
            value: document.linkedEntityId || '—',
          },
          {
            label: 'Uploaded',
            value: document.uploadedAt ? formatDateTime(document.uploadedAt) : 'No file uploaded yet',
          },
          { label: 'Uploaded by', value: document.uploadedBy || '—' },
          { label: 'Tags', value: document.tags || '—' },
          { label: 'Description', value: document.description || '—', span: 2 },
        ]}
      />

      <Card>
        <CardHeader
          title="File"
          action={
            <PermissionGate permission="documents.write">
              <Button
                variant="ghost"
                icon={<Icon name="upload" size={16} />}
                onClick={() => setUploadOpen(true)}
                disabled={busy}
              >
                {file ? 'Upload new version' : 'Upload file'}
              </Button>
            </PermissionGate>
          }
        />
        <CardBody>
          {file ? (
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <DescriptionList
                columns={2}
                items={[
                  { label: 'File name', value: file.name },
                  { label: 'Size', value: formatFileSize(file.size) },
                  { label: 'Type', value: file.mimeType || '—' },
                  { label: 'Drive file id', value: file.fileId },
                ]}
              />
              {/* SRS §9 "View / Download": both are the Drive file itself. Opening
                  it in a new tab is the browser's own viewer, so a Document with a
                  PDF or image needs no bespoke preview here. */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <Button
                  variant="secondary"
                  icon={<Icon name="eye" size={16} />}
                  onClick={() => window.open(file.url, '_blank', 'noopener,noreferrer')}
                >
                  View
                </Button>
                <Button
                  variant="ghost"
                  icon={<Icon name="download" size={16} />}
                  onClick={() => window.open(file.url, '_blank', 'noopener,noreferrer')}
                >
                  Download
                </Button>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                The file itself lives in Google Drive; this record holds only its reference.
                Uploading a new version increments the version number and leaves the previous file in
                Drive.
              </p>
            </div>
          ) : (
            <Alert variant="info">
              This document is metadata only — no file has been uploaded yet. Use “Upload file” to
              store the actual document in Google Drive.
            </Alert>
          )}
        </CardBody>
      </Card>
    </div>
  );

  const record = (
    <DescriptionList
      columns={2}
      items={[
        { label: 'Document id', value: document.documentId },
        { label: 'Document number', value: document.documentNumber },
        { label: 'Category id', value: document.categoryId },
        { label: 'Status', value: <StatusBadge statusKey={document.statusKey} /> },
        { label: 'Archived', value: document.isArchived === 'TRUE' ? 'Yes' : 'No' },
        { label: 'Version', value: document.versionNo || '—' },
        { label: 'Uploaded at', value: document.uploadedAt ? formatDateTime(document.uploadedAt) : '—' },
        { label: 'Uploaded by', value: document.uploadedBy || '—' },
        { label: 'Linked entity type', value: document.linkedEntityType || '—' },
        { label: 'Linked entity id', value: document.linkedEntityId || '—' },
      ]}
    />
  );

  return (
    <div>
      <PageHeader
        title={document.title}
        subtitle={`${document.documentNumber} · ${categoryLabel}`}
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Documents', route: '/documents', onClick: () => navigate('/documents') },
              { label: document.documentNumber },
            ]}
          />
        }
        actions={
          <PermissionGate permission="documents.write">
            {canArchiveDocument(document.statusKey) ? (
              <Button
                variant="danger"
                icon={<Icon name="trash" size={16} />}
                onClick={() => setArchiveOpen(true)}
                disabled={busy}
              >
                Archive
              </Button>
            ) : null}
          </PermissionGate>
        }
      />

      {document.statusKey === 'ARCHIVED' ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="warning">
            This document is archived. It stays in the record and is hidden from the default list, but
            there is no un-archive action.
          </Alert>
        </div>
      ) : null}

      <Card>
        <CardBody>
          <Tabs
            tabs={[
              { key: 'overview', label: 'Overview', content: overview },
              { key: 'record', label: 'Record', content: record },
            ]}
          />
        </CardBody>
      </Card>

      {/* ── Edit metadata ── */}
      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit document metadata"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="document-meta-form" loading={busy}>
              Save changes
            </Button>
          </>
        }
      >
        <form id="document-meta-form" onSubmit={(e) => void handleSave(e)} noValidate>
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <FormField label="Title" required error={formErrors.title}>
              <Input
                value={form.title}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, title: e.target.value }));
                  setFormErrors((prev) => {
                    const next = { ...prev };
                    delete next.title;
                    return next;
                  });
                }}
                error={formErrors.title}
              />
            </FormField>

            <FormField label="Category" required error={formErrors.categoryId}>
              <LookupSelect
                options={categories.options}
                value={form.categoryId}
                onChange={(value) => {
                  setForm((prev) => ({ ...prev, categoryId: value }));
                  setFormErrors((prev) => {
                    const next = { ...prev };
                    delete next.categoryId;
                    return next;
                  });
                }}
                placeholder="Select category"
                loading={categories.loading}
                error={formErrors.categoryId}
              />
            </FormField>

            <FormField label="Description">
              <Textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
            </FormField>

            <FormField label="Tags" hint="Comma-separated, for your own filing.">
              <Input
                value={form.tags}
                onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
              />
            </FormField>

            <FormField label="Related module" error={formErrors.linkedEntityType}>
              <LookupSelect
                options={[{ value: '', label: 'Not linked' }, ...entities.options]}
                value={form.linkedEntityType}
                onChange={(value) => {
                  setForm((prev) => ({ ...prev, linkedEntityType: value }));
                  setFormErrors((prev) => {
                    const next = { ...prev };
                    delete next.linkedEntityType;
                    return next;
                  });
                }}
                placeholder="Not linked"
                error={formErrors.linkedEntityType}
              />
            </FormField>

            <FormField label="Related record id" error={formErrors.linkedEntityId}>
              <Input
                value={form.linkedEntityId}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, linkedEntityId: e.target.value }));
                  setFormErrors((prev) => {
                    const next = { ...prev };
                    delete next.linkedEntityId;
                    return next;
                  });
                }}
                disabled={!form.linkedEntityType}
                placeholder={form.linkedEntityType ? 'e.g. MBR-0004' : 'Choose a related module first'}
                error={formErrors.linkedEntityId}
              />
            </FormField>

            <div
              className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
              style={{ gap: 'var(--space-4)' }}
            >
              <FormField label="Effective date">
                <Input
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, effectiveDate: e.target.value }))}
                />
              </FormField>
              <FormField label="Expiry date" hint="Optional.">
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                />
              </FormField>
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Archive — the reason is mandatory (route validator). ── */}
      <Modal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archive document"
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiveOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void handleArchive()} loading={busy}>
              Archive
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
            Archiving hides this document from the default list. The record and the Drive file are
            kept, and there is no un-archive action.
          </p>
          <FormField label="Reason" required error={reasonError} hint="Recorded in the audit trail.">
            <Textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError) setReasonError(undefined);
              }}
              rows={3}
              placeholder="e.g. Superseded by the revised bye-laws"
              error={reasonError}
            />
          </FormField>
        </div>
      </Modal>

      {/* ── Upload / replace the file ── */}
      <DocumentUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        documentId={document.documentId}
        categoryId={document.categoryId}
        fileName={file?.name}
        onUploaded={() => setUploadOpen(false)}
      />
    </div>
  );
}
