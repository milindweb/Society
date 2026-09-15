/* MemberFormPage.tsx — FE-05
 * design.md §44: FormField label → control → hint/error.
 * SRS §15: relation types come from config.enums; flats come from flatService (no literals). */

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
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { Alert } from '@/components/ui/Alert';
import { LookupSelect } from '@/components/data/LookupSelect';
import * as memberService from '@/services/memberService';
import { useMember } from '../hooks/useMembers';
import { useEnumOptions, useStatusOptions } from '@/features/flats/hooks/useLookups';
import { useFlatOptions } from '../hooks/useFlatOptions';
import { generateClientId } from '@/lib/idempotency';
import {
  required,
  isEmail,
  isMobile,
  validate,
  mapServerErrors,
  type FormErrors,
} from '@/lib/validation';

interface MemberFormState {
  flatId: string;
  fullName: string;
  relationType: string;
  mobile: string;
  email: string;
  address: string;
  emergencyContact: string;
  isPrimary: boolean;
  statusKey: string;
}

const EMPTY_FORM: MemberFormState = {
  flatId: '',
  fullName: '',
  relationType: '',
  mobile: '',
  email: '',
  address: '',
  emergencyContact: '',
  isPrimary: false,
  statusKey: '',
};

export default function MemberFormPage() {
  const navigate = useNavigate();
  const { memberId } = useParams<{ memberId: string }>();
  const isEdit = Boolean(memberId);

  const { member, loading: loadingMember } = useMember(memberId);
  const { options: relationOptions, loading: relationsLoading } = useEnumOptions('RELATION_TYPE');
  const { options: statusOptions, loading: statusesLoading } = useStatusOptions('MEMBER');
  const { options: flatOptions, loading: flatsLoading, searchFlats } = useFlatOptions();

  const [form, setForm] = useState<MemberFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  if (isEdit && member && !hydrated) {
    setForm({
      flatId: member.flatId ?? '',
      fullName: member.fullName ?? '',
      relationType: member.relationType ?? '',
      mobile: member.mobile ?? '',
      email: member.email ?? '',
      address: member.address ?? '',
      emergencyContact: member.emergencyContact ?? '',
      isPrimary: member.isPrimary ?? false,
      statusKey: member.statusKey ?? '',
    });
    setHydrated(true);
  }

  const setField = <K extends keyof MemberFormState>(key: K, value: MemberFormState[K]) => {
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
    setSubmitError(null);

    const nextErrors: FormErrors = {};
    const flatError = validate(form.flatId, [required('Flat is required')]);
    if (flatError) nextErrors.flatId = flatError;
    const nameError = validate(form.fullName.trim(), [required('Full name is required')]);
    if (nameError) nextErrors.fullName = nameError;
    const relationError = validate(form.relationType, [required('Relation type is required')]);
    if (relationError) nextErrors.relationType = relationError;

    const mobileError = validate(form.mobile.trim(), [
      required('Mobile number is required'),
      isMobile(),
    ]);
    if (mobileError) nextErrors.mobile = mobileError;

    if (form.email.trim()) {
      const emailError = validate(form.email.trim(), [isEmail()]);
      if (emailError) nextErrors.email = emailError;
    }

    if (form.emergencyContact.trim()) {
      const ecError = validate(form.emergencyContact.trim(), [isMobile('Invalid emergency number')]);
      if (ecError) nextErrors.emergencyContact = ecError;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const values = {
        flatId: form.flatId,
        fullName: form.fullName.trim(),
        relationType: form.relationType,
        mobile: form.mobile.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        emergencyContact: form.emergencyContact.trim() || undefined,
        isPrimary: form.isPrimary,
        statusKey: form.statusKey || undefined,
        clientRequestId: generateClientId(),
      };

      const saved =
        isEdit && memberId
          ? await memberService.updateMember(memberId, values)
          : await memberService.createMember(values);

      navigate(`/members/${saved.memberId}`);
    } catch (err) {
      const details = (err as { details?: { field: string; message: string }[] })?.details;
      if (Array.isArray(details) && details.length > 0) {
        setErrors(mapServerErrors(details));
      }
      setSubmitError(err instanceof Error ? err.message : 'Could not save the member.');
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && loadingMember) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner />
      </div>
    );
  }

  if (isEdit && !loadingMember && !member) {
    return (
      <div>
        <PageHeader title="Edit Member" />
        <ErrorState title="Member not found" message="This member may have been removed." />
      </div>
    );
  }

  const title = isEdit ? `Edit ${member?.fullName ?? 'Member'}` : 'Create Member';

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={isEdit ? 'Update member details' : 'Add a new member to a flat'}
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Members', route: '/members', onClick: () => navigate('/members') },
              ...(isEdit && member
                ? [
                    {
                      label: member.fullName,
                      route: `/members/${member.memberId}`,
                      onClick: () => navigate(`/members/${member.memberId}`),
                    },
                    { label: 'Edit' },
                  ]
                : [{ label: 'New' }]),
            ]}
          />
        }
      />

      {submitError && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">
            <strong>Save failed.</strong> {submitError}
          </Alert>
        </div>
      )}

      <Card>
        <CardBody>
          <form onSubmit={(e) => void handleSubmit(e)} noValidate>
            <div
              className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
              style={{ gap: 'var(--space-4)' }}
            >
              <FormField
                label="Flat"
                required
                error={errors.flatId}
                hint="Search and pick the flat this member belongs to."
              >
                <LookupSelect
                  options={flatOptions}
                  value={form.flatId}
                  onChange={(v) => setField('flatId', v)}
                  placeholder="Select flat"
                  loading={flatsLoading}
                  error={errors.flatId}
                  onSearch={searchFlats}
                />
              </FormField>

              <FormField label="Relation Type" required error={errors.relationType}>
                <LookupSelect
                  options={relationOptions}
                  value={form.relationType}
                  onChange={(v) => setField('relationType', v)}
                  placeholder="Select relation"
                  loading={relationsLoading}
                  error={errors.relationType}
                />
              </FormField>

              <FormField label="Full Name" required error={errors.fullName}>
                <Input
                  value={form.fullName}
                  onChange={(e) => setField('fullName', e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  error={errors.fullName}
                />
              </FormField>

              <FormField label="Mobile" required error={errors.mobile}>
                <Input
                  type="tel"
                  value={form.mobile}
                  onChange={(e) => setField('mobile', e.target.value)}
                  placeholder="10-digit mobile number"
                  error={errors.mobile}
                />
              </FormField>

              <FormField label="Email" error={errors.email}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  placeholder="name@example.com"
                  error={errors.email}
                />
              </FormField>

              <FormField
                label="Emergency Contact"
                error={errors.emergencyContact}
                hint="Alternate number reachable in an emergency."
              >
                <Input
                  type="tel"
                  value={form.emergencyContact}
                  onChange={(e) => setField('emergencyContact', e.target.value)}
                  error={errors.emergencyContact}
                />
              </FormField>

              <FormField label="Address" className="hs-lg-grid-col-span-2">
                <Textarea
                  rows={3}
                  value={form.address}
                  onChange={(e) => setField('address', e.target.value)}
                  placeholder="Correspondence address"
                />
              </FormField>

              <FormField
                label="Status"
                hint="Leave blank to let the backend apply the default status."
              >
                <LookupSelect
                  options={statusOptions}
                  value={form.statusKey}
                  onChange={(v) => setField('statusKey', v)}
                  placeholder="Default status"
                  loading={statusesLoading}
                />
              </FormField>
            </div>

            <div style={{ marginTop: 'var(--space-4)' }}>
              <Checkbox
                label="Primary member for this flat"
                checked={form.isPrimary}
                onChange={(e) => setField('isPrimary', e.target.checked)}
              />
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
                  navigate(isEdit && member ? `/members/${member.memberId}` : '/members')
                }
              >
                Cancel
              </Button>
              <Button type="submit" loading={saving} icon={<Icon name="check" size={16} />}>
                {isEdit ? 'Save Changes' : 'Create Member'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
