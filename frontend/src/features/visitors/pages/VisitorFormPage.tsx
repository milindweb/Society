/* VisitorFormPage.tsx — FE-07
 * SRS §7: visitor entry is deliberately MINIMAL for the watchman — name, mobile,
 * type, purpose, flat, vehicle — and mobile-first (the guard is standing at a
 * gate with a phone, not sitting at a desk). Layout, not decoration, is what
 * makes this work: one field per row, large controls, a big submit button.
 *
 * design.md §44: FormField label → control → hint/error.
 * SRS §15: visitor types come from config; never a literal in this file.
 * api-contract.md §9: the write carries a clientRequestId (idempotent retry).
 *
 * On success the page does NOT navigate away silently — it shows the generated
 * pass number, because the watchman has to read it out / write it on the slip. */

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { LookupSelect } from '@/components/data/LookupSelect';
import { useCreateVisitor } from '../hooks/useVisitors';
import { useVisitorTypeOptions } from '../hooks/useVisitorLookups';
import { useVisitorFlatLookup } from '../hooks/useVisitorFlatLookup';
import { required, validate, mapServerErrors, type FormErrors } from '@/lib/validation';

interface VisitorFormState {
  visitorName: string;
  mobile: string;
  visitorTypeId: string;
  purpose: string;
  flatId: string;
  vehicleNumber: string;
  personCount: string;
  entryGate: string;
  remarks: string;
}

const EMPTY_FORM: VisitorFormState = {
  visitorName: '',
  mobile: '',
  visitorTypeId: '',
  purpose: '',
  flatId: '',
  vehicleNumber: '',
  personCount: '1',
  entryGate: '',
  remarks: '',
};

export default function VisitorFormPage() {
  const navigate = useNavigate();
  const { options: typeOptions, loading: typesLoading } = useVisitorTypeOptions();
  const flats = useVisitorFlatLookup();
  const { create, creating, error: submitError, created } = useCreateVisitor();

  const [form, setForm] = useState<VisitorFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  const setField = <K extends keyof VisitorFormState>(key: K, value: VisitorFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    /* The backend requires exactly these five, so validate exactly these five.
     * Being stricter than the server only frustrates a watchman in a hurry. */
    const nextErrors: FormErrors = {};
    const nameError = validate(form.visitorName.trim(), [required('Visitor name is required')]);
    if (nameError) nextErrors.visitorName = nameError;
    const mobileError = validate(form.mobile.trim(), [required('Mobile number is required')]);
    if (mobileError) nextErrors.mobile = mobileError;
    const typeError = validate(form.visitorTypeId, [required('Visitor type is required')]);
    if (typeError) nextErrors.visitorTypeId = typeError;
    const purposeError = validate(form.purpose.trim(), [required('Purpose is required')]);
    if (purposeError) nextErrors.purpose = purposeError;
    const flatError = validate(form.flatId, [required('Flat is required')]);
    if (flatError) nextErrors.flatId = flatError;

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const result = await create({
      visitorName: form.visitorName.trim(),
      mobile: form.mobile.trim(),
      visitorTypeId: form.visitorTypeId,
      purpose: form.purpose.trim(),
      flatId: form.flatId,
      vehicleNumber: form.vehicleNumber.trim() || undefined,
      personCount: form.personCount === '' ? undefined : Number(form.personCount),
      entryGate: form.entryGate.trim() || undefined,
      remarks: form.remarks.trim() || undefined,
    });

    /* No optimistic state: the created row is the server's own answer, so the
     * pass number shown below is always the persisted one (SRS §23). */
    if (result) {
      resetForm();
      flats.search('');
    } else {
      const details = (submitError as unknown as { details?: { field: string; message: string }[] })
        ?.details;
      if (Array.isArray(details) && details.length > 0) setErrors(mapServerErrors(details));
    }
  };

  /* ---- Success state: the pass number is the whole point of the screen ---- */
  if (created) {
    return (
      <div>
        <PageHeader title="Visitor logged" subtitle="Entry recorded" />
        <Card>
          <CardBody>
            <Alert variant="success">
              <strong>{created.visitorName}</strong> is now marked INSIDE.
            </Alert>

            <dl style={{ marginTop: 'var(--space-5)', display: 'grid', gap: 'var(--space-3)' }}>
              <div>
                <dt style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                  Pass number
                </dt>
                <dd
                  style={{
                    margin: 0,
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 'var(--weight-bold)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {created.passNumber}
                </dd>
              </div>
              <div>
                <dt style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                  Visiting
                </dt>
                <dd style={{ margin: 0 }}>
                  {created.flatNumber ? `Flat ${created.flatNumber}` : created.flatId}
                  {created.residentName ? ` · ${created.residentName}` : ''}
                </dd>
              </div>
            </dl>

            <div
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                marginTop: 'var(--space-6)',
                flexDirection: 'column',
              }}
            >
              <Button
                size="lg"
                icon={<Icon name="plus" size={18} />}
                onClick={resetForm}
                className="hs-w-full"
              >
                Log another visitor
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate('/visitors')}
                className="hs-w-full"
              >
                View visitor register
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Visitor entry"
        subtitle="Log a visitor at the gate"
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Visitors', route: '/visitors', onClick: () => navigate('/visitors') },
              { label: 'New entry' },
            ]}
          />
        }
      />

      {submitError && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">
            <strong>Could not log the visitor.</strong> {submitError}
          </Alert>
        </div>
      )}

      <Card>
        <CardBody>
          <form onSubmit={(e) => void handleSubmit(e)} noValidate>
            {/* One field per row on phones; two columns only once there is room. */}
            <div
              className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
              style={{ gap: 'var(--space-4)' }}
            >
              <FormField label="Visitor name" required error={errors.visitorName}>
                <Input
                  value={form.visitorName}
                  onChange={(e) => setField('visitorName', e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  error={errors.visitorName}
                  autoComplete="off"
                />
              </FormField>

              <FormField label="Mobile" required error={errors.mobile}>
                <Input
                  type="tel"
                  value={form.mobile}
                  onChange={(e) => setField('mobile', e.target.value)}
                  placeholder="e.g. 9876543210"
                  error={errors.mobile}
                  inputMode="tel"
                />
              </FormField>

              <FormField label="Visitor type" required error={errors.visitorTypeId}>
                <LookupSelect
                  options={typeOptions}
                  value={form.visitorTypeId}
                  onChange={(value) => setField('visitorTypeId', value)}
                  placeholder="Select type"
                  loading={typesLoading}
                  error={errors.visitorTypeId}
                />
              </FormField>

              <FormField
                label="Flat being visited"
                required
                error={errors.flatId}
                hint="Type a flat number or owner name to narrow the list."
              >
                <LookupSelect
                  options={flats.options}
                  value={form.flatId}
                  onChange={(value) => setField('flatId', value)}
                  placeholder="Select flat"
                  loading={flats.loading}
                  error={errors.flatId}
                  onSearch={flats.search}
                  searchPlaceholder="Search flat number or owner..."
                />
              </FormField>

              <FormField label="Purpose" required error={errors.purpose} className="hs-col-span-2">
                <Input
                  value={form.purpose}
                  onChange={(e) => setField('purpose', e.target.value)}
                  placeholder="e.g. Delivery, Guest of A-101"
                  error={errors.purpose}
                />
              </FormField>

              <FormField label="Vehicle number" hint="Optional.">
                <Input
                  value={form.vehicleNumber}
                  onChange={(e) => setField('vehicleNumber', e.target.value)}
                  placeholder="e.g. MH 12 AB 1234"
                />
              </FormField>

              <FormField label="Number of persons" hint="Defaults to 1 when left blank.">
                <Input
                  type="number"
                  min={1}
                  value={form.personCount}
                  onChange={(e) => setField('personCount', e.target.value)}
                  inputMode="numeric"
                />
              </FormField>

              <FormField label="Entry gate" hint="Optional — e.g. Main gate, Gate 2.">
                <Input
                  value={form.entryGate}
                  onChange={(e) => setField('entryGate', e.target.value)}
                  placeholder="e.g. Main gate"
                />
              </FormField>

              <FormField label="Remarks" hint="Optional." className="hs-col-span-2">
                <Textarea
                  value={form.remarks}
                  onChange={(e) => setField('remarks', e.target.value)}
                  rows={2}
                  placeholder="Anything the next shift should know"
                />
              </FormField>
            </div>

            {typeOptions.length === 0 && !typesLoading ? (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Alert variant="warning">
                  No visitor types were returned by the server. Visitor types are configuration
                  data — add them in Settings before logging visitors.
                </Alert>
              </div>
            ) : null}

            <div
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                marginTop: 'var(--space-6)',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
              }}
            >
              <Button type="button" variant="ghost" onClick={() => navigate('/visitors')}>
                Cancel
              </Button>
              {/* Large target: this is the primary action of the whole screen. */}
              <Button
                type="submit"
                size="lg"
                loading={creating}
                icon={<Icon name="check" size={18} />}
              >
                Log entry
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
