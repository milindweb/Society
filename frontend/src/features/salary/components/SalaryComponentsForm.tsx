/* SalaryComponentsForm.tsx — FE-10
 * SRS §12: the editable part of a salary record.
 *
 * What is editable is exactly the patchable surface of `salary.update`
 * (HRService.gs:503):
 *   overtimeHours, allowanceAmount, advanceDeduction, otherDeduction,
 *   bonusAmount, otherAdjustment, remarks
 *
 * Everything else on the row — base salary, the day counts, the per-day amount,
 * the attendance adjustment and the net — is derived by the server. There are no
 * inputs for them and no hidden fields carrying them, because sending a value the
 * server ignores would suggest it had an effect.
 *
 * The form shows the CURRENT net for reference and says plainly that it will be
 * recalculated. It does not preview a new net: computing one here would duplicate
 * `HRService.computeNetSalary` on the client, which SRS §8/§23 forbids, and any
 * drift between the two would be a money bug in the user's face. The real number
 * appears the moment the save returns. */

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { AmountText } from '@/components/data/AmountText';
import type { EmployeeSalary } from '@/types/domain';
import type { UpdateSalaryInput } from '@/services/employeeService';

interface SalaryComponentsFormProps {
  /** Lets the modal's footer button submit this form from outside it. */
  formId: string;
  salary: EmployeeSalary;
  onSubmit: (input: Omit<UpdateSalaryInput, 'salaryId'>) => Promise<boolean>;
}

interface FormState {
  overtimeHours: string;
  allowanceAmount: string;
  advanceDeduction: string;
  otherDeduction: string;
  bonusAmount: string;
  otherAdjustment: string;
  remarks: string;
}

/** A money input is valid when it is blank or parses to a finite number. Blank is
 * allowed and means "nothing entered" — the server coerces it to 0. */
function moneyError(value: string, label: string): string | undefined {
  if (value.trim() === '') return undefined;
  if (Number.isNaN(Number(value))) return `${label} must be a number, or left blank.`;
  if (Number(value) < 0) return `${label} cannot be negative.`;
  return undefined;
}

function hoursError(value: string): string | undefined {
  if (value.trim() === '') return undefined;
  if (Number.isNaN(Number(value))) return 'Overtime hours must be a number, or left blank.';
  if (Number(value) < 0) return 'Overtime hours cannot be negative.';
  return undefined;
}

export function SalaryComponentsForm({ formId, salary, onSubmit }: SalaryComponentsFormProps) {
  const [form, setForm] = useState<FormState>({
    overtimeHours: salary.overtimeHours ?? '',
    allowanceAmount: salary.allowanceAmount ?? '',
    advanceDeduction: salary.advanceDeduction ?? '',
    otherDeduction: salary.otherDeduction ?? '',
    bonusAmount: salary.bonusAmount ?? '',
    otherAdjustment: salary.otherAdjustment ?? '',
    remarks: salary.remarks ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const set = <K extends keyof FormState>(key: K, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const next: Record<string, string | undefined> = {
      overtimeHours: hoursError(form.overtimeHours),
      allowanceAmount: moneyError(form.allowanceAmount, 'Allowance'),
      advanceDeduction: moneyError(form.advanceDeduction, 'Advance recovery'),
      otherDeduction: moneyError(form.otherDeduction, 'Other deduction'),
      bonusAmount: moneyError(form.bonusAmount, 'Bonus'),
      otherAdjustment: moneyError(form.otherAdjustment, 'Other adjustment'),
    };

    const failed = Object.values(next).some((message) => message !== undefined);
    if (failed) {
      setErrors(next);
      return;
    }

    /* Blank means "no change intended" only for a field the user actually
     * cleared; sending '' is safe because the server coerces it to 0 and the
     * reload shows the truth either way. Trimming keeps stray spaces out. */
    await onSubmit({
      overtimeHours: form.overtimeHours.trim(),
      allowanceAmount: form.allowanceAmount.trim(),
      advanceDeduction: form.advanceDeduction.trim(),
      otherDeduction: form.otherDeduction.trim(),
      bonusAmount: form.bonusAmount.trim(),
      otherAdjustment: form.otherAdjustment.trim(),
      remarks: form.remarks.trim(),
    });
  };

  return (
    <form id={formId} onSubmit={(e) => void handleSubmit(e)} noValidate>
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <Alert variant="info">
          The net amount is calculated on the server from these figures and the recorded attendance.
          Save, and the recalculated total appears on the record.
        </Alert>

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
          <span style={{ color: 'var(--color-text-muted)' }}>Net before this change</span>
          <strong>
            <AmountText amount={Number(salary.netSalary) || 0} />
          </strong>
        </div>

        <FormField
          label="Overtime hours"
          error={errors.overtimeHours}
          hint="Optional. Hours are converted to an amount by the server."
        >
          <Input
            value={form.overtimeHours}
            onChange={(e) => set('overtimeHours', e.target.value)}
            inputMode="decimal"
            placeholder="0"
            error={errors.overtimeHours}
          />
        </FormField>

        <div
          className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
          style={{ gap: 'var(--space-4)' }}
        >
          <FormField label="Allowance" error={errors.allowanceAmount} hint="Optional. Added.">
            <Input
              value={form.allowanceAmount}
              onChange={(e) => set('allowanceAmount', e.target.value)}
              inputMode="decimal"
              placeholder="0"
              error={errors.allowanceAmount}
            />
          </FormField>
          <FormField label="Bonus" error={errors.bonusAmount} hint="Optional. Added.">
            <Input
              value={form.bonusAmount}
              onChange={(e) => set('bonusAmount', e.target.value)}
              inputMode="decimal"
              placeholder="0"
              error={errors.bonusAmount}
            />
          </FormField>
          <FormField
            label="Advance recovery"
            error={errors.advanceDeduction}
            hint="Optional. Deducted."
          >
            <Input
              value={form.advanceDeduction}
              onChange={(e) => set('advanceDeduction', e.target.value)}
              inputMode="decimal"
              placeholder="0"
              error={errors.advanceDeduction}
            />
          </FormField>
          <FormField label="Other deduction" error={errors.otherDeduction} hint="Optional. Deducted.">
            <Input
              value={form.otherDeduction}
              onChange={(e) => set('otherDeduction', e.target.value)}
              inputMode="decimal"
              placeholder="0"
              error={errors.otherDeduction}
            />
          </FormField>
        </div>

        <FormField
          label="Other adjustment"
          error={errors.otherAdjustment}
          hint="Optional. A signed amount — use a minus sign for a deduction."
        >
          <Input
            value={form.otherAdjustment}
            onChange={(e) => set('otherAdjustment', e.target.value)}
            inputMode="decimal"
            placeholder="0"
            error={errors.otherAdjustment}
          />
        </FormField>

        <FormField label="Remarks" hint="Optional. Why this record was adjusted.">
          <Textarea
            value={form.remarks}
            onChange={(e) => set('remarks', e.target.value)}
            rows={3}
          />
        </FormField>

        {/* The modal owns the submit button so it can sit in the footer with
            Cancel; this keeps the form usable on its own too. */}
        <div style={{ display: 'none' }}>
          <Button type="submit">Save</Button>
        </div>
      </div>
    </form>
  );
}
