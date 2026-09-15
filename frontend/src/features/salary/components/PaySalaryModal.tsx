/* PaySalaryModal.tsx — FE-10
 * SRS §12: record that a salary row was paid.
 *
 * The route validator requires `paymentDate` and `paymentModeKey`
 * (Routes.gs:920-938), and `salary.pay` refuses any row that is not APPROVED —
 * both are enforced server-side; this form simply satisfies them rather than
 * duplicating the state check.
 *
 * `paymentModeKey` options come from `config.enums.paymentModes`
 * (ConfigService.gs:202) — the same source the payments module uses, so a mode
 * means one thing across the app (SRS §15). Nothing here is hardcoded.
 *
 * The amount is shown for confirmation and is NOT editable: the server pays the
 * net it computed. An input for it would imply the client could change what gets
 * paid, which SRS §8/§23 rules out. */

import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { LookupSelect } from '@/components/data/LookupSelect';
import { AmountText } from '@/components/data/AmountText';
import { usePaymentModeOptions } from '../hooks/useSalaryLookups';
import { todayISO } from '@/lib/dates';
import type { EmployeeSalary } from '@/types/domain';
import type { PaySalaryInput } from '@/services/employeeService';

interface PaySalaryModalProps {
  open: boolean;
  salary: EmployeeSalary;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (input: Omit<PaySalaryInput, 'salaryId'>) => Promise<boolean>;
}

export function PaySalaryModal({
  open,
  salary,
  busy,
  error,
  onClose,
  onConfirm,
}: PaySalaryModalProps) {
  const modes = usePaymentModeOptions();

  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentModeKey, setPaymentModeKey] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  /* Reset on open so a previous attempt's values never leak into the next
   * record, and so the date defaults to today rather than to whenever this
   * component first mounted. */
  useEffect(() => {
    if (open) {
      setPaymentDate(todayISO());
      /* Preselect when there is only one mode — a single-choice question should
       * not require a click. */
      setPaymentModeKey(modes.options.length === 1 ? (modes.options[0]?.value ?? '') : '');
      setReferenceNumber('');
      setRemarks('');
      setFormError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!paymentDate) {
      setFormError('A payment date is required.');
      return;
    }
    if (!paymentModeKey) {
      setFormError('Choose how the salary was paid.');
      return;
    }

    await onConfirm({
      paymentDate,
      paymentModeKey,
      referenceNumber: referenceNumber.trim() || undefined,
      remarks: remarks.trim() || undefined,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record salary payment"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="pay-salary-form" loading={busy}>
            Record payment
          </Button>
        </>
      }
    >
      <form id="pay-salary-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          {formError ? <Alert variant="danger">{formError}</Alert> : null}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 'var(--space-4)',
              padding: 'var(--space-3)',
              background: 'var(--color-surface-sunken)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
            }}
          >
            <div>
              <div style={{ color: 'var(--color-text-muted)' }}>Employee</div>
              <div>{salary.employeeName || salary.employeeId}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'var(--color-text-muted)' }}>Amount</div>
              <strong>
                <AmountText amount={Number(salary.netSalary) || 0} />
              </strong>
            </div>
          </div>

          <FormField label="Payment date" required hint="The date the salary was actually paid.">
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => {
                setPaymentDate(e.target.value);
                setFormError(null);
              }}
            />
          </FormField>

          <FormField
            label="Payment mode"
            required
            hint={
              modes.loading
                ? 'Loading payment modes…'
                : 'The modes configured for the society.'
            }
          >
            <LookupSelect
              options={modes.options}
              value={paymentModeKey}
              onChange={(value) => {
                setPaymentModeKey(value);
                setFormError(null);
              }}
              placeholder="Select a payment mode"
              loading={modes.loading}
            />
          </FormField>

          <FormField
            label="Reference number"
            hint="Optional. A transaction id, cheque number or similar."
          >
            <Input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. cheque or transaction reference"
            />
          </FormField>

          <FormField label="Remarks" hint="Optional.">
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </FormField>

          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Recording the payment marks the record as paid. The amount is the one the server
            calculated — it cannot be changed here.
          </p>
        </div>
      </form>
    </Modal>
  );
}
