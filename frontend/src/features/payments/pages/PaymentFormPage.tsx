/* PaymentFormPage.tsx — FE-06
 * Record a payment.
 *
 * The server allocates oldest-due-first and computes the split (PaymentService.recordPayment).
 * This form therefore shows the flat's outstanding demands as read-only CONTEXT so the user
 * understands what the money will settle, but it never proposes or computes an allocation.
 * There is no optimistic UI: on success we navigate to the server-created receipt (SRS §23). */

import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Alert } from '@/components/ui/Alert';
import { DataTable, type Column } from '@/components/data/DataTable';
import { AmountText } from '@/components/data/AmountText';
import { LookupSelect } from '@/components/data/LookupSelect';
import * as paymentService from '@/services/paymentService';
import { useFlatOptions } from '@/features/members/hooks/useFlatOptions';
import { useDemandList } from '@/features/maintenance/hooks/useDemands';
import { useEnumOptions } from '@/features/flats/hooks/useLookups';
import { generateClientId } from '@/lib/idempotency';
import { parseMoneyInput } from '@/lib/money';
import { todayISO } from '@/lib/dates';
import {
  required,
  minNumber,
  validate,
  mapServerErrors,
  type FormErrors,
} from '@/lib/validation';
import type { Demand } from '@/types/domain';

interface PaymentFormState {
  flatId: string;
  amount: string;
  paymentDate: string;
  paymentModeKey: string;
  referenceNumber: string;
  bankName: string;
  remarks: string;
}

export default function PaymentFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { options: flatOptions, loading: flatsLoading, searchFlats } = useFlatOptions();
  const { options: modeOptions, loading: modesLoading } = useEnumOptions('PAYMENT_MODE');

  const [form, setForm] = useState<PaymentFormState>({
    flatId: searchParams.get('flatId') ?? '',
    amount: '',
    paymentDate: todayISO(),
    paymentModeKey: '',
    referenceNumber: '',
    bankName: '',
    remarks: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Outstanding demands for the selected flat — read-only context only.
  const { demands, loading: demandsLoading } = useDemandList(
    form.flatId ? { flatId: form.flatId } : undefined,
  );
  const outstanding = demands.filter(
    (d) => d.statusKey !== 'CANCELLED' && d.balanceAmount > 0,
  );

  const setField = <K extends keyof PaymentFormState>(key: K, value: PaymentFormState[K]) => {
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

    const amount = parseMoneyInput(form.amount);
    const amountError = validate(amount, [minNumber(0.01, 'Amount must be greater than zero')]);
    if (amountError) nextErrors.amount = amountError;

    const dateError = validate(form.paymentDate, [required('Payment date is required')]);
    if (dateError) nextErrors.paymentDate = dateError;

    const modeError = validate(form.paymentModeKey, [required('Payment mode is required')]);
    if (modeError) nextErrors.paymentModeKey = modeError;

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const result = await paymentService.recordPayment({
        flatId: form.flatId,
        amount,
        paymentDate: form.paymentDate,
        paymentModeKey: form.paymentModeKey,
        referenceNumber: form.referenceNumber.trim() || undefined,
        bankName: form.bankName.trim() || undefined,
        remarks: form.remarks.trim() || undefined,
        clientRequestId: generateClientId(),
      });

      // Go straight to the receipt the server created in the same transaction.
      const receiptId = result?.receipt?.receiptId;
      if (receiptId) {
        navigate(`/receipts/${receiptId}`);
      } else {
        navigate(`/payments/${result.payment.paymentId}`);
      }
    } catch (err) {
      const details = (err as { details?: { field: string; message: string }[] })?.details;
      if (Array.isArray(details) && details.length > 0) {
        setErrors(mapServerErrors(details));
      }
      setSubmitError(err instanceof Error ? err.message : 'Could not record the payment.');
    } finally {
      setSaving(false);
    }
  };

  const outstandingColumns: Column<Demand>[] = [
    { key: 'periodKey', header: 'Period' },
    { key: 'chargeNameSnapshot', header: 'Charge', render: (r) => r.chargeNameSnapshot || '—' },
    {
      key: 'totalPayable',
      header: 'Payable',
      align: 'right',
      render: (r) => <AmountText amount={r.totalPayable} />,
    },
    {
      key: 'balanceAmount',
      header: 'Balance',
      align: 'right',
      render: (r) => <AmountText amount={r.balanceAmount} />,
    },
    { key: 'statusKey', header: 'Status', render: (r) => <StatusBadge statusKey={r.statusKey} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Record Payment"
        subtitle="Payments are allocated to the oldest outstanding demands first"
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Payments', route: '/payments', onClick: () => navigate('/payments') },
              { label: 'New' },
            ]}
          />
        }
      />

      {submitError && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">
            <strong>Could not record the payment.</strong> {submitError}
          </Alert>
        </div>
      )}

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Alert variant="info">
          The amount you enter is applied to the oldest unpaid demands first. The split is decided
          by the server and shown on the receipt — this form does not calculate it.
        </Alert>
      </div>

      <div className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2" style={{ gap: 'var(--space-4)' }}>
        <Card>
          <CardHeader title="Payment Details" />
          <CardBody>
            <form onSubmit={(e) => void handleSubmit(e)} noValidate>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <FormField label="Flat" required error={errors.flatId}>
                  <LookupSelect
                    options={flatOptions}
                    value={form.flatId}
                    onChange={(v) => setField('flatId', v)}
                    placeholder="Select flat"
                    loading={flatsLoading}
                    error={errors.flatId}
                    onSearch={searchFlats}
                    searchPlaceholder="Search flats..."
                  />
                </FormField>

                <FormField
                  label="Amount"
                  required
                  error={errors.amount}
                  hint="Enter the total received. It will be applied across outstanding demands."
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) => setField('amount', e.target.value)}
                    placeholder="0.00"
                    error={errors.amount}
                  />
                </FormField>

                <FormField label="Payment Date" required error={errors.paymentDate}>
                  <Input
                    type="date"
                    value={form.paymentDate}
                    onChange={(e) => setField('paymentDate', e.target.value)}
                    error={errors.paymentDate}
                  />
                </FormField>

                <FormField label="Payment Mode" required error={errors.paymentModeKey}>
                  <LookupSelect
                    options={modeOptions}
                    value={form.paymentModeKey}
                    onChange={(v) => setField('paymentModeKey', v)}
                    placeholder="Select mode"
                    loading={modesLoading}
                    error={errors.paymentModeKey}
                  />
                </FormField>

                <FormField label="Reference Number" hint="Cheque / UTR / transaction reference.">
                  <Input
                    value={form.referenceNumber}
                    onChange={(e) => setField('referenceNumber', e.target.value)}
                  />
                </FormField>

                <FormField label="Bank Name">
                  <Input
                    value={form.bankName}
                    onChange={(e) => setField('bankName', e.target.value)}
                  />
                </FormField>

                <FormField label="Remarks">
                  <Textarea
                    rows={3}
                    value={form.remarks}
                    onChange={(e) => setField('remarks', e.target.value)}
                  />
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
                <Button type="button" variant="ghost" onClick={() => navigate('/payments')}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving} icon={<Icon name="check" size={16} />}>
                  Record Payment
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Outstanding Demands (context)" />
          <CardBody>
            {!form.flatId ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                Select a flat to see its outstanding demands.
              </p>
            ) : (
              <>
                <DataTable
                  columns={outstandingColumns}
                  data={outstanding}
                  loading={demandsLoading}
                  getRowId={(r) => r.demandId}
                  emptyTitle="Nothing outstanding"
                  emptyDescription="This flat has no unpaid demands. A payment will be recorded as unallocated."
                />
                <p
                  style={{
                    marginTop: 'var(--space-3)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Balances above are read from the server ledger. This list is informational — the
                  actual allocation happens server-side when you save.
                </p>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
