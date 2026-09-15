/* DocumentFormPage.tsx — FE-09
 * Serves `/documents/new` and `/documents/:documentId/edit`.
 *
 * Why this route exists alongside the upload modal: SRS §9 lists "Document title,
 * Date, Description, Related module" as first-class fields of a document, and
 * `documents.create` writes metadata WITHOUT a file. Some documents are catalogued
 * before their scan arrives, and an existing record's metadata is corrected here.
 * Both paths write through the same service, so the rules live in one place.
 *
 * Note: `documents.archive` is the only status transition the service offers, so
 * there is no status field on this form — status is server-owned.
 *
 * design.md §44: FormField label → control → hint/error.
 * SRS §15: categories and the related-module list come from config. */

import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { LookupSelect } from '@/components/data/LookupSelect';
import { useDocument, useCreateDocument } from '../hooks/useDocuments';
import {
  useDocumentCategoryOptions,
  useLinkedEntityTypeOptions,
} from '../hooks/useDocumentLookups';
import { isArchivedDocument } from '@/services/documentService';
import { required, validate, mapServerErrors, type FormErrors } from '@/lib/validation';
import { todayISO } from '@/lib/dates';

interface DocumentFormState {
  title: string;
  categoryId: string;
  description: string;
  tags: string;
  linkedEntityType: string;
  linkedEntityId: string;
  effectiveDate: string;
  expiryDate: string;
}

const EMPTY_FORM: DocumentFormState = {
  title: '',
  categoryId: '',
  description: '',
  tags: '',
  linkedEntityType: '',
  linkedEntityId: '',
  effectiveDate: todayISO(),
  expiryDate: '',
};

export default function DocumentFormPage() {
  const navigate = useNavigate();
  const { documentId } = useParams<{ documentId: string }>();
  const isEdit = Boolean(documentId);

  const categories = useDocumentCategoryOptions();
  const entities = useLinkedEntityTypeOptions();

  const { document, loading: loadingDoc, error: loadError } = useDocument(documentId);
  const { create, creating, error: createError } = useCreateDocument();
  /* A second handle on the same record gives us the metadata patch without
   * duplicating the hook that the detail page already owns. */
  const { update, busy } = useDocument(documentId);

  const [form, setForm] = useState<DocumentFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [hydrated, setHydrated] = useState(false);

  /* Hydrate once the document arrives. Guarded by `hydrated` because setState
   * during render must happen exactly once (same pattern as FlatFormPage). */
  if (isEdit && document && !hydrated) {
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
    setHydrated(true);
  }

  const setField = <K extends keyof DocumentFormState>(key: K, value: DocumentFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const nextErrors: FormErrors = {};
    const titleError = validate(form.title.trim(), [required('Title is required')]);
    if (titleError) nextErrors.title = titleError;
    const categoryError = validate(form.categoryId, [required('Category is required')]);
    if (categoryError) nextErrors.categoryId = categoryError;
    /* Both halves of the link, or neither. */
    if (form.linkedEntityType && !form.linkedEntityId.trim()) {
      nextErrors.linkedEntityId = 'Enter the id of the linked record.';
    }
    if (!form.linkedEntityType && form.linkedEntityId.trim()) {
      nextErrors.linkedEntityType = 'Choose which kind of record this id belongs to.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload = {
      title: form.title.trim(),
      categoryId: form.categoryId,
      description: form.description.trim(),
      tags: form.tags.trim(),
      linkedEntityType: form.linkedEntityType,
      linkedEntityId: form.linkedEntityId.trim(),
      effectiveDate: form.effectiveDate,
      expiryDate: form.expiryDate,
    };

    if (isEdit && documentId) {
      await update(payload);
      navigate(`/documents/${documentId}`);
      return;
    }

    const created = await create(payload);
    if (created) {
      navigate(`/documents/${created.documentId}`);
    } else {
      const details = (createError as unknown as { details?: { field: string; message: string }[] })
        ?.details;
      if (Array.isArray(details) && details.length > 0) setErrors(mapServerErrors(details));
    }
  };

  if (isEdit && loadingDoc) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner />
      </div>
    );
  }

  if (isEdit && !loadingDoc && !document) {
    return (
      <div>
        <PageHeader title="Edit document" />
        <ErrorState
          title="Document not found"
          message={loadError ?? 'This document may have been removed.'}
        />
      </div>
    );
  }

  /* An archived document is a closed record; editing its metadata would change
   * the meaning of something already filed away. */
  if (isEdit && document && isArchivedDocument(document)) {
    return (
      <div>
        <PageHeader
          title="Edit document"
          breadcrumbs={
            <Breadcrumb
              items={[
                { label: 'Documents', route: '/documents', onClick: () => navigate('/documents') },
                {
                  label: document.documentNumber,
                  onClick: () => navigate(`/documents/${document.documentId}`),
                },
                { label: 'Edit' },
              ]}
            />
          }
        />
        <Alert variant="warning">
          This document is archived and its metadata can no longer be edited.
        </Alert>
      </div>
    );
  }

  const title = isEdit ? 'Edit document metadata' : 'Add document metadata';
  const saving = isEdit ? busy : creating;
  const submitError = isEdit ? null : createError;

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={
          isEdit
            ? `${document?.documentNumber ?? ''} — the file and version are not changed here`
            : 'Catalogues a document first; upload the file itself at any time'
        }
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Documents', route: '/documents', onClick: () => navigate('/documents') },
              ...(isEdit && document
                ? [
                    {
                      label: document.documentNumber,
                      route: `/documents/${document.documentId}`,
                      onClick: () => navigate(`/documents/${document.documentId}`),
                    },
                    { label: 'Edit' },
                  ]
                : [{ label: 'New' }]),
            ]}
          />
        }
      />

      {submitError ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">
            <strong>Save failed.</strong> {submitError}
          </Alert>
        </div>
      ) : null}

      {!isEdit ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="info">
            This creates the record only — no file is uploaded. The document is saved as ACTIVE and
            you can attach the file from its page afterwards.
          </Alert>
        </div>
      ) : null}

      <Card>
        <CardBody>
          <form onSubmit={(e) => void handleSubmit(e)} noValidate>
            <div
              className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
              style={{ gap: 'var(--space-4)' }}
            >
              <FormField label="Title" required error={errors.title} className="hs-col-span-2">
                <Input
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  placeholder="e.g. Society registration certificate"
                  error={errors.title}
                />
              </FormField>

              <FormField label="Category" required error={errors.categoryId}>
                <LookupSelect
                  options={categories.options}
                  value={form.categoryId}
                  onChange={(value) => setField('categoryId', value)}
                  placeholder="Select category"
                  loading={categories.loading}
                  error={errors.categoryId}
                />
              </FormField>

              <FormField label="Effective date">
                <Input
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => setField('effectiveDate', e.target.value)}
                />
              </FormField>

              <FormField label="Description" className="hs-col-span-2">
                <Textarea
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  rows={4}
                  placeholder="What this document is and why it is kept"
                />
              </FormField>

              <FormField label="Related module" error={errors.linkedEntityType}>
                <LookupSelect
                  options={[{ value: '', label: 'Not linked' }, ...entities.options]}
                  value={form.linkedEntityType}
                  onChange={(value) => setField('linkedEntityType', value)}
                  placeholder="Not linked"
                  error={errors.linkedEntityType}
                />
              </FormField>

              <FormField label="Related record id" error={errors.linkedEntityId}>
                <Input
                  value={form.linkedEntityId}
                  onChange={(e) => setField('linkedEntityId', e.target.value)}
                  disabled={!form.linkedEntityType}
                  placeholder={form.linkedEntityType ? 'e.g. MBR-0004' : 'Choose a related module first'}
                  error={errors.linkedEntityId}
                />
              </FormField>

              <FormField label="Expiry date" hint="Optional. For agreements and AMCs.">
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setField('expiryDate', e.target.value)}
                />
              </FormField>

              <FormField label="Tags" hint="Comma-separated, for your own filing.">
                <Input value={form.tags} onChange={(e) => setField('tags', e.target.value)} />
              </FormField>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-6)',
                justifyContent: 'flex-end',
              }}
            >
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  navigate(isEdit && document ? `/documents/${document.documentId}` : '/documents')
                }
              >
                Cancel
              </Button>
              <Button type="submit" loading={saving} icon={<Icon name="check" size={16} />}>
                {isEdit ? 'Save changes' : 'Save document'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
