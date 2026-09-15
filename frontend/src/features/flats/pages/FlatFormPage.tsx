/* FlatFormPage.tsx — FE-05
 * design.md §44: FormField label → control → hint/error.
 * SRS §15: wing / flat-type / status options all come from config, never literals.
 * api-contract.md §9: writes carry a clientRequestId for idempotency. */

import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { Alert } from '@/components/ui/Alert';
import { LookupSelect } from '@/components/data/LookupSelect';
import * as flatService from '@/services/flatService';
import { useFlat } from '../hooks/useFlats';
import { useWingOptions, useFlatTypeOptions, useStatusOptions } from '../hooks/useLookups';
import { generateClientId } from '@/lib/idempotency';
import { required, minNumber, validate, mapServerErrors, type FormErrors } from '@/lib/validation';

interface FlatFormState {
  wingId: string;
  flatNumber: string;
  floor: string;
  flatTypeId: string;
  carpetArea: string;
  statusKey: string;
  isActive: boolean;
}

const EMPTY_FORM: FlatFormState = {
  wingId: '',
  flatNumber: '',
  floor: '',
  flatTypeId: '',
  carpetArea: '',
  statusKey: '',
  isActive: true,
};

export default function FlatFormPage() {
  const navigate = useNavigate();
  const { flatId } = useParams<{ flatId: string }>();
  const isEdit = Boolean(flatId);

  const { flat, loading: loadingFlat } = useFlat(flatId);
  const { options: wingOptions, loading: wingsLoading } = useWingOptions();
  const { options: typeOptions, loading: typesLoading } = useFlatTypeOptions();
  const { options: statusOptions, loading: statusesLoading } = useStatusOptions('FLAT');

  const [form, setForm] = useState<FlatFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate the form once the flat arrives (edit mode).
  if (isEdit && flat && !hydrated) {
    setForm({
      wingId: flat.wingId ?? '',
      flatNumber: flat.flatNumber ?? '',
      floor: String(flat.floor ?? ''),
      flatTypeId: flat.flatTypeId ?? '',
      carpetArea: flat.carpetArea != null ? String(flat.carpetArea) : '',
      statusKey: flat.statusKey ?? '',
      isActive: flat.isActive ?? true,
    });
    setHydrated(true);
  }

  const setField = <K extends keyof FlatFormState>(key: K, value: FlatFormState[K]) => {
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
    const wingError = validate(form.wingId, [required('Wing is required')]);
    if (wingError) nextErrors.wingId = wingError;
    const numberError = validate(form.flatNumber.trim(), [required('Flat number is required')]);
    if (numberError) nextErrors.flatNumber = numberError;
    const typeError = validate(form.flatTypeId, [required('Flat type is required')]);
    if (typeError) nextErrors.flatTypeId = typeError;
    if (form.floor === '') {
      nextErrors.floor = 'Floor is required';
    } else {
      const floorError = validate(Number(form.floor), [minNumber(0, 'Floor cannot be negative')]);
      if (floorError) nextErrors.floor = floorError;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const values = {
        wingId: form.wingId,
        flatNumber: form.flatNumber.trim(),
        floor: Number(form.floor),
        flatTypeId: form.flatTypeId,
        carpetArea: form.carpetArea === '' ? undefined : Number(form.carpetArea),
        statusKey: form.statusKey || undefined,
        isActive: form.isActive,
        clientRequestId: generateClientId(),
      };

      const saved = isEdit && flatId
        ? await flatService.updateFlat(flatId, values)
        : await flatService.createFlat(values);

      navigate(`/flats/${saved.flatId}`);
    } catch (err) {
      const details = (err as { details?: { field: string; message: string }[] })?.details;
      if (Array.isArray(details) && details.length > 0) {
        setErrors(mapServerErrors(details));
      }
      setSubmitError(err instanceof Error ? err.message : 'Could not save the flat.');
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && loadingFlat) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner />
      </div>
    );
  }

  if (isEdit && !loadingFlat && !flat) {
    return (
      <div>
        <PageHeader title="Edit Flat" />
        <ErrorState title="Flat not found" message="This flat may have been removed." />
      </div>
    );
  }

  const title = isEdit ? `Edit Flat ${flat?.flatNumber ?? ''}`.trim() : 'Create Flat';

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={isEdit ? 'Update flat/unit master data' : 'Add a new flat/unit to the society'}
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Flats', route: '/flats', onClick: () => navigate('/flats') },
              ...(isEdit && flat
                ? [
                    { label: flat.flatNumber, route: `/flats/${flat.flatId}`, onClick: () => navigate(`/flats/${flat.flatId}`) },
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
              <FormField label="Wing" required error={errors.wingId}>
                <LookupSelect
                  options={wingOptions}
                  value={form.wingId}
                  onChange={(v) => setField('wingId', v)}
                  placeholder="Select wing"
                  loading={wingsLoading}
                  error={errors.wingId}
                />
              </FormField>

              <FormField
                label="Flat Number"
                required
                error={errors.flatNumber}
                hint="Must be unique within the selected wing."
              >
                <Input
                  value={form.flatNumber}
                  onChange={(e) => setField('flatNumber', e.target.value)}
                  placeholder="e.g. A-101"
                  error={errors.flatNumber}
                />
              </FormField>

              <FormField label="Floor" required error={errors.floor}>
                <Input
                  type="number"
                  value={form.floor}
                  onChange={(e) => setField('floor', e.target.value)}
                  placeholder="0"
                  error={errors.floor}
                />
              </FormField>

              <FormField label="Flat Type" required error={errors.flatTypeId}>
                <LookupSelect
                  options={typeOptions}
                  value={form.flatTypeId}
                  onChange={(v) => setField('flatTypeId', v)}
                  placeholder="Select flat type"
                  loading={typesLoading}
                  error={errors.flatTypeId}
                />
              </FormField>

              <FormField label="Carpet Area (sq.ft)" hint="Optional. Used for area-based charges.">
                <Input
                  type="number"
                  value={form.carpetArea}
                  onChange={(e) => setField('carpetArea', e.target.value)}
                  placeholder="e.g. 850"
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
                label="Active"
                checked={form.isActive}
                onChange={(e) => setField('isActive', e.target.checked)}
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
                onClick={() => navigate(isEdit && flat ? `/flats/${flat.flatId}` : '/flats')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={saving}
                icon={<Icon name="check" size={16} />}
              >
                {isEdit ? 'Save Changes' : 'Create Flat'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
