/* DocumentUploadModal.tsx — FE-09
 * SRS §9: "Upload to Google Drive". This modal is the one place in the frontend
 * that reads a file's bytes; everything else in the Documents module is metadata.
 *
 * The flow mirrors `documents.upload` exactly: the server needs categoryId +
 * fileName + mimeType + base64, and takes an OPTIONAL documentId. Two modes:
 *   - attach (documentId given): push a new version onto an existing document;
 *   - create  (no documentId):    let the server raise the document from the file.
 *
 * design.md §44: FormField label → control → hint/error.
 * SRS §15: categories come from config, never a literal here. */

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { LookupSelect } from '@/components/data/LookupSelect';
import { formatFileSize } from '@/services/documentService';
import { useUploadDocument, readFileAsBase64 } from '../hooks/useDocuments';
import { useDocumentCategoryOptions, useLinkedEntityTypeOptions } from '../hooks/useDocumentLookups';
import { required, validate, type FormErrors } from '@/lib/validation';
import type { Document } from '@/types/domain';

interface DocumentUploadModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the server's document row (created or updated). */
  onUploaded: (document: Document) => void;
  /** When supplied, the file is attached to this document as a new version. */
  documentId?: string;
  /** Pre-selects the category when attaching (the server validates it anyway). */
  categoryId?: string;
  fileName?: string;
}

/** A sensible default mime type when the browser reports an empty one. */
const FALLBACK_MIME = 'application/octet-stream';

export function DocumentUploadModal({
  open,
  onClose,
  onUploaded,
  documentId,
  categoryId,
  fileName,
}: DocumentUploadModalProps) {
  const categories = useDocumentCategoryOptions();
  const entities = useLinkedEntityTypeOptions();
  const { upload, uploading, error: submitError } = useUploadDocument();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [linkedEntityType, setLinkedEntityType] = useState('');
  const [linkedEntityId, setLinkedEntityId] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  /* Reset on open so a previously chosen file never leaks into a new upload. */
  useEffect(() => {
    if (open) {
      setFile(null);
      setCategory(categoryId ?? '');
      setDescription('');
      setLinkedEntityType('');
      setLinkedEntityId('');
      setErrors({});
      /* Clearing the input's value lets the user re-pick the same file after a
       * failed attempt — otherwise the change event never fires again. */
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isAttachMode = Boolean(documentId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const nextErrors: FormErrors = {};
    const categoryError = validate(category, [required('Category is required')]);
    if (categoryError) nextErrors.categoryId = categoryError;
    const fileError = validate(file ? file.name : '', [required('Choose a file to upload')]);
    if (fileError) nextErrors.file = fileError;

    /* A linked entity with an id but no type (or vice versa) is unusable as a
     * reference, so both must be present or neither. */
    if (linkedEntityType && !linkedEntityId.trim()) {
      nextErrors.linkedEntityId = 'Enter the id of the record this document belongs to.';
    }
    if (!linkedEntityType && linkedEntityId.trim()) {
      nextErrors.linkedEntityType = 'Choose which kind of record this id belongs to.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (!file) return;

    /* Reading the file can fail (permissions, a directory, a vanished file), so
     * it is awaited separately — a read failure is not an upload failure. */
    let base64: string;
    try {
      base64 = await readFileAsBase64(file);
    } catch (readError) {
      setErrors({
        file: readError instanceof Error ? readError.message : 'That file could not be read.',
      });
      return;
    }

    const result = await upload({
      categoryId: category,
      fileName: file.name,
      mimeType: file.type || FALLBACK_MIME,
      base64,
      documentId,
      /* `description` is only read by the service on the CREATE path; on the
       * attach path the metadata already exists and is edited on the detail page.
       * Sending it is harmless, but we only offer the field when it applies. */
      description: description.trim() || undefined,
      linkedEntityType: linkedEntityType || undefined,
      linkedEntityId: linkedEntityId.trim() || undefined,
    });

    if (result) {
      onUploaded(result.document);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAttachMode ? 'Upload a new version' : 'Upload a document'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button type="submit" form="document-upload-form" loading={uploading}>
            {isAttachMode ? 'Upload version' : 'Upload'}
          </Button>
        </>
      }
    >
      {submitError ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">
            <strong>The upload failed.</strong> {submitError}
          </Alert>
        </div>
      ) : null}

      <form id="document-upload-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {isAttachMode ? (
            <Alert variant="info">
              The file is stored in Google Drive and this document's version number is incremented.
              Its metadata stays as it is.
            </Alert>
          ) : (
            <Alert variant="info">
              The file goes to Google Drive; Google Sheets keeps only the metadata and the reference.
              The document is titled from the file name — rename it afterwards if you need to.
            </Alert>
          )}

          <FormField label="File" required error={errors.file}>
            <input
              ref={fileInputRef}
              type="file"
              className="hs-input"
              aria-label="Choose a file to upload"
              disabled={uploading}
              onChange={(e) => {
                const chosen = e.target.files?.[0] ?? null;
                setFile(chosen);
                if (chosen) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.file;
                    return next;
                  });
                }
              }}
            />
            {file ? (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                {file.name} · {formatFileSize(file.size)}
                {file.type ? ` · ${file.type}` : ''}
              </span>
            ) : null}
          </FormField>

          <FormField label="Category" required error={errors.categoryId}>
            <LookupSelect
              options={categories.options}
              value={category}
              onChange={(value) => {
                setCategory(value);
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.categoryId;
                  return next;
                });
              }}
              placeholder="Select category"
              loading={categories.loading}
              error={errors.categoryId}
            />
          </FormField>

          {categories.options.length === 0 && !categories.loading ? (
            <Alert variant="warning">
              No document categories were returned by the server. Document categories are
              configuration data — add them in Settings before uploading.
            </Alert>
          ) : null}

          {/* The description/entity link are create-path fields only, so they are
              hidden when attaching a version to an existing document. */}
          {!isAttachMode ? (
            <>
              <FormField label="Description">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What this document is for"
                />
              </FormField>

              <FormField
                label="Related module"
                error={errors.linkedEntityType}
                hint="Optional. Links this document to a member, meeting, complaint and so on."
              >
                <LookupSelect
                  options={[{ value: '', label: 'Not linked' }, ...entities.options]}
                  value={linkedEntityType}
                  onChange={(value) => {
                    setLinkedEntityType(value);
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.linkedEntityType;
                      return next;
                    });
                  }}
                  placeholder="Not linked"
                  error={errors.linkedEntityType}
                />
              </FormField>

              <FormField
                label="Related record id"
                error={errors.linkedEntityId}
                hint="The id of the linked record, e.g. MBR-0004."
              >
                <Input
                  value={linkedEntityId}
                  onChange={(e) => {
                    setLinkedEntityId(e.target.value);
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.linkedEntityId;
                      return next;
                    });
                  }}
                  disabled={!linkedEntityType}
                  placeholder={linkedEntityType ? 'e.g. MBR-0004' : 'Choose a related module first'}
                  error={errors.linkedEntityId}
                />
              </FormField>
            </>
          ) : null}

          {/* Shown when a name was passed in purely as context for the user. */}
          {isAttachMode && fileName ? (
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Current file: {fileName}
            </p>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
