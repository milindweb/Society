/* EmployeeFormPage.tsx — FE-10
 * Serves both `/employees/new` and `/employees/:employeeId/edit`.
 *
 * contract notes (verified against HRService.gs:132-203):
 * - `employees.create` requires fullName + employeeTypeId + joinDate; `employeeCode`
 *   is OPTIONAL because the server generates `EMP0001`-style when omitted. The form
 *   says so rather than forcing a code the society may not use.
 * - `employees.update` patches an allow-list that EXCLUDES `joinDate` and
 *   `employeeCode` (HRService.gs:182). In edit mode those two are therefore shown
 *   read-only with an explanation — offering them as editable would be a lie.
 * - `monthlySalary` is stored as a string; it is sent as entered and never
 *   computed here (SRS §8).
 * - A duplicate supplied `employeeCode` answers `CONFLICT_ERROR`; that message is
 *   shown on the code field.
 *
 * No optimistic UI (SRS §23): after a write the page reloads from the server (edit
 * mode) or navigates to the record the server actually created (create mode). */

import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { LookupSelect } from '@/components/data/LookupSelect';
import { useEmployee, useCreateEmployee } from '../hooks/useEmployees';
import {
  useEmployeeTypeOptions,
  useEmployeeStatusOptions,
} from '../hooks/useEmployeeLookups';
import { required, validate, type FormErrors } from '@/lib/validation';
import { todayISO } from '@/lib/dates';

interface EmployeeFormState {
  fullName: string;
  employeeCode: string;
  employeeTypeId: string;
  joinDate: string;
  mobile: string;
  altMobile: string;
  email: string;
  address: string;
  monthlySalary: string;
  bankName: string;
  bankAccount: string;
  ifsc: string;
  emergencyName: string;
  emergencyMobile: string;
  idProofType: string;
  idProofNumber: string;
  notes: string;
  statusKey: string;
}

function emptyForm(): EmployeeFormState {
  return {
    fullName: '',
    employeeCode: '',
    employeeTypeId: '',
    joinDate: todayISO(),
    mobile: '',
    altMobile: '',
    email: '',
    address: '',
    monthlySalary: '',
    bankName: '',
    bankAccount: '',
    ifsc: '',
    emergencyName: '',
    emergencyMobile: '',
    idProofType: '',
    idProofNumber: '',
    notes: '',
    statusKey: 'ACTIVE',
  };
}

export default function EmployeeFormPage() {
  const navigate = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();
  const isEdit = Boolean(employeeId);

  const types = useEmployeeTypeOptions();
  const statuses = useEmployeeStatusOptions();

  const { detail, loading, error, busy, reload, update } = useEmployee(employeeId);
  const { create, creating, error: createError, reset: resetCreate } = useCreateEmployee();

  const [form, setForm] = useState<EmployeeFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [hydrated, setHydrated] = useState(false);

  /* Hydrate once from the loaded record. The `hydrated` flag means a later reload
   * (after a save) cannot clobber what the user is typing. */
  useEffect(() => {
    if (isEdit && detail?.employee && !hydrated) {
      const e = detail.employee;
      setForm({
        fullName: e.fullName ?? '',
        employeeCode: e.employeeCode ?? '',
        employeeTypeId: e.employeeTypeId ?? '',
        joinDate: e.joinDate ?? '',
        mobile: e.mobile ?? '',
        altMobile: e.altMobile ?? '',
        email: e.email ?? '',
        address: e.address ?? '',
        monthlySalary: e.monthlySalary ?? '',
        bankName: e.bankName ?? '',
        bankAccount: e.bankAccount ?? '',
        ifsc: e.ifsc ?? '',
        emergencyName: e.emergencyName ?? '',
        emergencyMobile: e.emergencyMobile ?? '',
        idProofType: e.idProofType ?? '',
        idProofNumber: e.idProofNumber ?? '',
        notes: e.notes ?? '',
        statusKey: e.statusKey ?? 'ACTIVE',
      });
      setHydrated(true);
    }
  }, [isEdit, detail, hydrated]);

  const set = <K extends keyof EmployeeFormState>(key: K, value: EmployeeFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (formErrors[key as string]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const nextErrors: FormErrors = {};
    const nameError = validate(form.fullName.trim(), [required('A full name is required')]);
    if (nameError) nextErrors.fullName = nameError;
    const typeError = validate(form.employeeTypeId, [required('Choose an employee type')]);
    if (typeError) nextErrors.employeeTypeId = typeError;
    const joinError = validate(form.joinDate, [required('A join date is required')]);
    if (joinError) nextErrors.joinDate = joinError;

    /* The salary is a string on the sheet, but a non-numeric value would be
     * silently coerced to 0 by the server — better to reject it here. */
    if (form.monthlySalary.trim() !== '' && Number.isNaN(Number(form.monthlySalary))) {
      nextErrors.monthlySalary = 'Enter a number, or leave this blank.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    if (isEdit) {
      /* `joinDate` and `employeeCode` are deliberately NOT sent — the server
       * ignores them, and sending them would imply they were saved. */
      const ok = await update({
        fullName: form.fullName.trim(),
        employeeTypeId: form.employeeTypeId,
        mobile: form.mobile.trim(),
        altMobile: form.altMobile.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        monthlySalary: form.monthlySalary.trim(),
        bankName: form.bankName.trim(),
        bankAccount: form.bankAccount.trim(),
        ifsc: form.ifsc.trim(),
        emergencyName: form.emergencyName.trim(),
        emergencyMobile: form.emergencyMobile.trim(),
        idProofType: form.idProofType.trim(),
        idProofNumber: form.idProofNumber.trim(),
        notes: form.notes.trim(),
        statusKey: form.statusKey,
      });
      if (ok) navigate(`/employees/${employeeId}`);
      return;
    }

    const created = await create({
      fullName: form.fullName.trim(),
      employeeTypeId: form.employeeTypeId,
      joinDate: form.joinDate,
      employeeCode: form.employeeCode.trim() || undefined,
      mobile: form.mobile.trim() || undefined,
      altMobile: form.altMobile.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      monthlySalary: form.monthlySalary.trim() || undefined,
      bankName: form.bankName.trim() || undefined,
      bankAccount: form.bankAccount.trim() || undefined,
      ifsc: form.ifsc.trim() || undefined,
      emergencyName: form.emergencyName.trim() || undefined,
      emergencyMobile: form.emergencyMobile.trim() || undefined,
      idProofType: form.idProofType.trim() || undefined,
      idProofNumber: form.idProofNumber.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });

    if (created) navigate(`/employees/${created.employeeId}`);
  };

  if (isEdit && loading && !hydrated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner />
      </div>
    );
  }

  if (isEdit && error && !detail) {
    return (
      <div>
        <PageHeader title="Employee" />
        <ErrorState message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  const submitError = isEdit ? error : createError;
  const saving = isEdit ? busy : creating;

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit ${form.fullName || 'employee'}` : 'Add an employee'}
        subtitle={
          isEdit
            ? 'Update contact, salary, bank and identity details'
            : 'Record a new society employee'
        }
        breadcrumbs={
          <Breadcrumb
            items={
              isEdit && employeeId
                ? [
                    { label: 'Employees', route: '/employees', onClick: () => navigate('/employees') },
                    {
                      label: form.fullName || 'Employee',
                      onClick: () => navigate(`/employees/${employeeId}`),
                    },
                    { label: 'Edit' },
                  ]
                : [
                    { label: 'Employees', route: '/employees', onClick: () => navigate('/employees') },
                    { label: 'New' },
                  ]
            }
          />
        }
      />

      {submitError ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">
            <strong>{isEdit ? 'The employee could not be saved.' : 'The employee could not be created.'}</strong>{' '}
            {submitError}
          </Alert>
        </div>
      ) : null}

      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <Card>
            <CardBody>
              <h3 style={{ marginTop: 0, fontSize: 'var(--text-md)' }}>Identity</h3>
              <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                <FormField label="Full name" required error={formErrors.fullName}>
                  <Input
                    value={form.fullName}
                    onChange={(e) => set('fullName', e.target.value)}
                    error={formErrors.fullName}
                  />
                </FormField>

                <div
                  className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
                  style={{ gap: 'var(--space-4)' }}
                >
                  <FormField
                    label="Employee code"
                    error={formErrors.employeeCode}
                    hint={
                      isEdit
                        ? 'The code is fixed once the employee exists.'
                        : 'Leave blank and the server assigns the next code.'
                    }
                  >
                    <Input
                      value={form.employeeCode}
                      onChange={(e) => set('employeeCode', e.target.value)}
                      disabled={isEdit}
                      placeholder={isEdit ? undefined : 'Auto'}
                      error={formErrors.employeeCode}
                    />
                  </FormField>

                  <FormField
                    label="Employee type"
                    required
                    error={formErrors.employeeTypeId}
                  >
                    <LookupSelect
                      options={types.options}
                      value={form.employeeTypeId}
                      onChange={(value) => set('employeeTypeId', value)}
                      placeholder="Select a type"
                      loading={types.loading}
                      error={formErrors.employeeTypeId}
                    />
                  </FormField>
                </div>

                <div
                  className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
                  style={{ gap: 'var(--space-4)' }}
                >
                  <FormField
                    label="Join date"
                    required
                    error={formErrors.joinDate}
                    hint={isEdit ? 'Not editable after creation.' : undefined}
                  >
                    <Input
                      type="date"
                      value={form.joinDate}
                      onChange={(e) => set('joinDate', e.target.value)}
                      disabled={isEdit}
                      error={formErrors.joinDate}
                    />
                  </FormField>

                  {isEdit ? (
                    <FormField label="Status" hint="Archiving is done from the detail page.">
                      <LookupSelect
                        options={statuses.options}
                        value={form.statusKey}
                        onChange={(value) => set('statusKey', value)}
                        placeholder="Select a status"
                        loading={statuses.loading}
                      />
                    </FormField>
                  ) : null}
                </div>

                <FormField label="Address">
                  <Textarea
                    value={form.address}
                    onChange={(e) => set('address', e.target.value)}
                    rows={2}
                  />
                </FormField>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 style={{ marginTop: 0, fontSize: 'var(--text-md)' }}>Contact</h3>
              <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                <div
                  className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
                  style={{ gap: 'var(--space-4)' }}
                >
                  <FormField label="Mobile">
                    <Input value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
                  </FormField>
                  <FormField label="Alternate mobile">
                    <Input
                      value={form.altMobile}
                      onChange={(e) => set('altMobile', e.target.value)}
                    />
                  </FormField>
                </div>
                <FormField label="Email">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                  />
                </FormField>
                <div
                  className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
                  style={{ gap: 'var(--space-4)' }}
                >
                  <FormField label="Emergency contact">
                    <Input
                      value={form.emergencyName}
                      onChange={(e) => set('emergencyName', e.target.value)}
                    />
                  </FormField>
                  <FormField label="Emergency mobile">
                    <Input
                      value={form.emergencyMobile}
                      onChange={(e) => set('emergencyMobile', e.target.value)}
                    />
                  </FormField>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 style={{ marginTop: 0, fontSize: 'var(--text-md)' }}>Salary and bank</h3>
              <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                <FormField
                  label="Monthly salary"
                  error={formErrors.monthlySalary}
                  hint="Used as the base for the monthly salary run. Stored as entered; never computed here."
                >
                  <Input
                    value={form.monthlySalary}
                    onChange={(e) => set('monthlySalary', e.target.value)}
                    inputMode="decimal"
                    error={formErrors.monthlySalary}
                  />
                </FormField>
                <div
                  className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
                  style={{ gap: 'var(--space-4)' }}
                >
                  <FormField label="Bank name">
                    <Input value={form.bankName} onChange={(e) => set('bankName', e.target.value)} />
                  </FormField>
                  <FormField label="Account number">
                    <Input
                      value={form.bankAccount}
                      onChange={(e) => set('bankAccount', e.target.value)}
                    />
                  </FormField>
                </div>
                <FormField label="IFSC">
                  <Input value={form.ifsc} onChange={(e) => set('ifsc', e.target.value)} />
                </FormField>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 style={{ marginTop: 0, fontSize: 'var(--text-md)' }}>Identity proof and notes</h3>
              <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                <div
                  className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
                  style={{ gap: 'var(--space-4)' }}
                >
                  <FormField label="ID proof type" hint="e.g. Aadhaar, PAN, Voter ID.">
                    <Input
                      value={form.idProofType}
                      onChange={(e) => set('idProofType', e.target.value)}
                    />
                  </FormField>
                  <FormField label="ID proof number">
                    <Input
                      value={form.idProofNumber}
                      onChange={(e) => set('idProofNumber', e.target.value)}
                    />
                  </FormField>
                </div>
                <FormField label="Notes">
                  <Textarea
                    value={form.notes}
                    onChange={(e) => set('notes', e.target.value)}
                    rows={3}
                  />
                </FormField>
              </div>
            </CardBody>
          </Card>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button type="submit" loading={saving}>
              {isEdit ? 'Save changes' : 'Add employee'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                navigate(isEdit && employeeId ? `/employees/${employeeId}` : '/employees')
              }
              disabled={saving}
            >
              Cancel
            </Button>
            {!isEdit ? (
              <Button type="button" variant="ghost" onClick={resetCreate} disabled={saving}>
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}
