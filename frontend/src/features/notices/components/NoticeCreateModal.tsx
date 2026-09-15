/* NoticeCreateModal.tsx — FE-08
 * SRS §6: the notice module stays SIMPLE — one screen covering every kind of
 * society communication. Raising a notice is therefore a modal over the list,
 * not a separate route (same reasoning as FE-07's RaiseComplaintModal).
 *
 * design.md §44: FormField label → control → hint/error.
 * SRS §15: notice types and audiences come from config; never a literal here. */

import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';
import { Alert } from '@/components/ui/Alert';
import { LookupSelect } from '@/components/data/LookupSelect';
import { useCreateNotice } from '../hooks/useNotices';
import {
  useNoticeTypeOptions,
  useAudienceTypeOptions,
} from '../hooks/useNoticeLookups';
import { required, validate, mapServerErrors, type FormErrors } from '@/lib/validation';
import { todayISO } from '@/lib/dates';
import type { Notice } from '@/types/domain';

interface NoticeFormState {
  title: string;
  noticeTypeId: string;
  noticeDate: string;
  description: string;
  audienceType: string;
  audienceRef: string;
  expiryDate: string;
  isPinned: boolean;
}

function emptyForm(defaultAudience: string): NoticeFormState {
  return {
    title: '',
    noticeTypeId: '',
    noticeDate: todayISO(),
    description: '',
    audienceType: defaultAudience,
    audienceRef: '',
    expiryDate: '',
    isPinned: false,
  };
}

interface NoticeCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (notice: Notice) => void;
}

export function NoticeCreateModal({ open, onClose, onCreated }: NoticeCreateModalProps) {
  const types = useNoticeTypeOptions();
  const audiences = useAudienceTypeOptions();
  const { create, creating, error: submitError } = useCreateNotice();

  const [form, setForm] = useState<NoticeFormState>(emptyForm('ALL'));
  const [errors, setErrors] = useState<FormErrors>({});

  /* Reset every time the modal opens so a previous draft never leaks in. */
  useEffect(() => {
    if (open) {
      setForm(emptyForm(audiences.options[0]?.value ?? 'ALL'));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setField = <K extends keyof NoticeFormState>(key: K, value: NoticeFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const audienceNeedsRef = form.audienceType !== '' && form.audienceType !== 'ALL';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    /* The route validator requires exactly these five (create always produces a
     * DRAFT; publishing is a separate, deliberate action). */
    const nextErrors: FormErrors = {};
    const titleError = validate(form.title.trim(), [required('Title is required')]);
    if (titleError) nextErrors.title = titleError;
    const typeError = validate(form.noticeTypeId, [required('Notice type is required')]);
    if (typeError) nextErrors.noticeTypeId = typeError;
    const dateError = validate(form.noticeDate, [required('Notice date is required')]);
    if (dateError) nextErrors.noticeDate = dateError;
    const descError = validate(form.description.trim(), [required('Description is required')]);
    if (descError) nextErrors.description = descError;
    const audienceError = validate(form.audienceType, [required('Audience is required')]);
    if (audienceError) nextErrors.audienceType = audienceError;

    /* A scoped audience without a reference silently reaches nobody. */
    if (audienceNeedsRef && !form.audienceRef.trim()) {
      nextErrors.audienceRef = 'Select who this notice should reach.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const created = await create({
      title: form.title.trim(),
      noticeTypeId: form.noticeTypeId,
      noticeDate: form.noticeDate,
      description: form.description.trim(),
      audienceType: form.audienceType,
      audienceRef: form.audienceRef.trim() || undefined,
      expiryDate: form.expiryDate || undefined,
      isPinned: form.isPinned,
    });

    if (created) {
      setForm(emptyForm(audiences.options[0]?.value ?? 'ALL'));
      onCreated(created);
    } else {
      const details = (submitError as unknown as { details?: { field: string; message: string }[] })
        ?.details;
      if (Array.isArray(details) && details.length > 0) setErrors(mapServerErrors(details));
    }
  };

  const audienceHint = (() => {
    switch (form.audienceType) {
      case 'ROLE':
        return 'Enter role keys, comma-separated (e.g. MEMBER, COMMITTEE).';
      case 'WING':
        return 'Enter wing ids, comma-separated.';
      case 'FLAT':
        return 'Enter flat ids, comma-separated.';
      case 'MEMBER':
        return 'Enter member ids, comma-separated.';
      default:
        return 'Visible to every member.';
    }
  })();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New notice"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button type="submit" form="notice-create-form" loading={creating}>
            Save as draft
          </Button>
        </>
      }
    >
      {submitError ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">
            <strong>Could not save the notice.</strong> {submitError}
          </Alert>
        </div>
      ) : null}

      <form id="notice-create-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <FormField label="Title" required error={errors.title}>
            <Input
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="e.g. Water supply interruption on 20 April"
              error={errors.title}
            />
          </FormField>

          <FormField label="Notice type" required error={errors.noticeTypeId}>
            <LookupSelect
              options={types.options}
              value={form.noticeTypeId}
              onChange={(value) => setField('noticeTypeId', value)}
              placeholder="Select type"
              loading={types.loading}
              error={errors.noticeTypeId}
            />
          </FormField>

          <FormField label="Notice date" required error={errors.noticeDate}>
            <Input
              type="date"
              value={form.noticeDate}
              onChange={(e) => setField('noticeDate', e.target.value)}
              error={errors.noticeDate}
            />
          </FormField>

          <FormField label="Description" required error={errors.description}>
            <Textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={4}
              placeholder="What members need to know"
              error={errors.description}
            />
          </FormField>

          <FormField label="Audience" required error={errors.audienceType}>
            <LookupSelect
              options={audiences.options}
              value={form.audienceType}
              onChange={(value) => setField('audienceType', value)}
              placeholder="Select audience"
              loading={audiences.loading}
              error={errors.audienceType}
            />
          </FormField>

          <FormField
            label="Audience reference"
            error={errors.audienceRef}
            hint={audienceHint}
          >
            <Input
              value={form.audienceRef}
              onChange={(e) => setField('audienceRef', e.target.value)}
              placeholder={audienceNeedsRef ? 'Required for this audience' : 'Not needed for ALL'}
              disabled={!audienceNeedsRef}
              error={errors.audienceRef}
            />
          </FormField>

          <FormField label="Expiry date" hint="Optional. After this date the notice stops applying.">
            <Input
              type="date"
              value={form.expiryDate}
              onChange={(e) => setField('expiryDate', e.target.value)}
            />
          </FormField>

          <Checkbox
            label="Pin this notice to the top of the list"
            checked={form.isPinned}
            onChange={(e) => setField('isPinned', e.target.checked)}
          />
        </div>
      </form>
    </Modal>
  );
}
