/* NoticeFormPage.tsx — FE-08
 * Serves `/notices/new` and `/notices/:noticeId/edit`.
 *
 * Why a route as well as the create modal: SRS §6 wants notices editable, and
 * `notices.update` is DRAFT-ONLY. The list page's modal is the quick path for
 * raising one; this page is where a longer description is written or a draft
 * corrected. Both write through the same service, so the rules live in one place.
 *
 * design.md §44: FormField label → control → hint/error.
 * SRS §15: notice types and audiences come from config. */

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
import { Checkbox } from '@/components/ui/Checkbox';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { LookupSelect } from '@/components/data/LookupSelect';
import { useNotice, useCreateNotice } from '../hooks/useNotices';
import { useNoticeTypeOptions, useAudienceTypeOptions } from '../hooks/useNoticeLookups';
import { required, validate, mapServerErrors, type FormErrors } from '@/lib/validation';
import { todayISO } from '@/lib/dates';
import { isTrueFlag, canEditNotice } from '@/services/noticeService';

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

const EMPTY_FORM: NoticeFormState = {
  title: '',
  noticeTypeId: '',
  noticeDate: todayISO(),
  description: '',
  audienceType: 'ALL',
  audienceRef: '',
  expiryDate: '',
  isPinned: false,
};

export default function NoticeFormPage() {
  const navigate = useNavigate();
  const { noticeId } = useParams<{ noticeId: string }>();
  const isEdit = Boolean(noticeId);

  const types = useNoticeTypeOptions();
  const audiences = useAudienceTypeOptions();
  const { notice, loading: loadingNotice, error: loadError } = useNotice(noticeId);
  const { create, creating, error: createError } = useCreateNotice();
  const { update, busy } = useNotice(noticeId);

  const [form, setForm] = useState<NoticeFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [hydrated, setHydrated] = useState(false);

  /* Hydrate once the notice arrives. Guarded by `hydrated` because setState
   * during render must happen exactly once (same pattern as FlatFormPage). */
  if (isEdit && notice && !hydrated) {
    setForm({
      title: notice.title ?? '',
      noticeTypeId: notice.noticeTypeId ?? '',
      noticeDate: notice.noticeDate ?? todayISO(),
      description: notice.description ?? '',
      audienceType: notice.audienceType ?? 'ALL',
      audienceRef: notice.audienceRef ?? '',
      expiryDate: notice.expiryDate ?? '',
      isPinned: isTrueFlag(notice.isPinned),
    });
    setHydrated(true);
  }

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
    if (audienceNeedsRef && !form.audienceRef.trim()) {
      nextErrors.audienceRef = 'Select who this notice should reach.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload = {
      title: form.title.trim(),
      noticeTypeId: form.noticeTypeId,
      noticeDate: form.noticeDate,
      description: form.description.trim(),
      audienceType: form.audienceType,
      audienceRef: form.audienceRef.trim() || undefined,
      expiryDate: form.expiryDate || undefined,
      isPinned: form.isPinned,
    };

    if (isEdit && noticeId) {
      await update(payload);
      navigate(`/notices/${noticeId}`);
      return;
    }

    const created = await create(payload);
    if (created) {
      navigate(`/notices/${created.noticeId}`);
    } else {
      const details = (createError as unknown as { details?: { field: string; message: string }[] })
        ?.details;
      if (Array.isArray(details) && details.length > 0) setErrors(mapServerErrors(details));
    }
  };

  if (isEdit && loadingNotice) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner />
      </div>
    );
  }

  if (isEdit && !loadingNotice && !notice) {
    return (
      <div>
        <PageHeader title="Edit notice" />
        <ErrorState
          title="Notice not found"
          message={loadError ?? 'This notice may have been removed.'}
        />
      </div>
    );
  }

  /* `notices.update` refuses anything that is not a draft. Explain rather than
   * render a form the server will reject. */
  if (isEdit && notice && !canEditNotice(notice.statusKey)) {
    return (
      <div>
        <PageHeader
          title="Edit notice"
          breadcrumbs={
            <Breadcrumb
              items={[
                { label: 'Notices', route: '/notices', onClick: () => navigate('/notices') },
                { label: notice.noticeNumber, onClick: () => navigate(`/notices/${notice.noticeId}`) },
                { label: 'Edit' },
              ]}
            />
          }
        />
        <Alert variant="warning">
          Only draft notices can be edited. This notice is {notice.statusKey} — unpublish it first if
          it needs to change.
        </Alert>
      </div>
    );
  }

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

  const title = isEdit ? 'Edit notice' : 'New notice';
  const saving = isEdit ? busy : creating;
  const submitError = isEdit ? null : createError;

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={
          isEdit
            ? `${notice?.noticeNumber ?? ''} — only drafts are editable`
            : 'Saved as a draft; publish it when it is ready'
        }
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Notices', route: '/notices', onClick: () => navigate('/notices') },
              ...(isEdit && notice
                ? [
                    {
                      label: notice.noticeNumber,
                      route: `/notices/${notice.noticeId}`,
                      onClick: () => navigate(`/notices/${notice.noticeId}`),
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

              <FormField label="Audience reference" error={errors.audienceRef} hint={audienceHint}>
                <Input
                  value={form.audienceRef}
                  onChange={(e) => setField('audienceRef', e.target.value)}
                  placeholder={audienceNeedsRef ? 'Required for this audience' : 'Not needed for ALL'}
                  disabled={!audienceNeedsRef}
                  error={errors.audienceRef}
                />
              </FormField>

              <FormField
                label="Description"
                required
                error={errors.description}
                className="hs-col-span-2"
              >
                <Textarea
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  rows={6}
                  placeholder="What members need to know"
                  error={errors.description}
                />
              </FormField>

              <FormField label="Expiry date" hint="Optional. After this date the notice stops applying.">
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setField('expiryDate', e.target.value)}
                />
              </FormField>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox
                  label="Pin this notice to the top of the list"
                  checked={form.isPinned}
                  onChange={(e) => setField('isPinned', e.target.checked)}
                />
              </div>
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
                  navigate(isEdit && notice ? `/notices/${notice.noticeId}` : '/notices')
                }
              >
                Cancel
              </Button>
              <Button type="submit" loading={saving} icon={<Icon name="check" size={16} />}>
                {isEdit ? 'Save changes' : 'Save as draft'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
