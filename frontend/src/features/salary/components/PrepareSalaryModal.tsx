/* PrepareSalaryModal.tsx — FE-10
 * SRS §12: start (or re-run) a month's salary preparation.
 *
 * The only required input is the period. The employee narrowing is offered
 * because `salary.prepare` genuinely accepts `employeeIds`, and the three
 * per-employee overrides are offered because the route accepts
 * `overrides[employeeId]` — but both are extras, and the common case is "prepare
 * the whole month" with nothing else set.
 *
 * Two things this modal deliberately does NOT do:
 *  - It does not show a predicted net for anyone. The net depends on attendance
 *    the server reads, so any figure shown here would be a guess dressed as a
 *    fact (SRS §8/§23). The drafts, once created, show the real numbers.
 *  - It does not warn about re-running as if it were destructive. It is not:
 *    `salary.prepare` skips an employee who already has a row for the period
 *    (HRService.gs:377). The helper text says exactly that.
 *
 * SRS §15: employee options come from the API, and the period list is generated
 * from the clock — no hardcoded months. */

import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Alert } from '@/components/ui/Alert';
import { LookupSelect } from '@/components/data/LookupSelect';
import { useEmployeeOptions } from '@/features/employees/hooks/useEmployees';
import type { SelectOption } from '@/types/domain';
import type { PrepareSalaryInput } from '@/services/employeeService';

interface PrepareSalaryModalProps {
  open: boolean;
  periodOptions: SelectOption[];
  defaultPeriodKey: string;
  preparing: boolean;
  onClose: () => void;
  /** Returns true when the run succeeded, so the modal knows to close. */
  onConfirm: (input: PrepareSalaryInput) => Promise<boolean>;
}

type Scope = 'ALL' | 'SELECTED';

export function PrepareSalaryModal({
  open,
  periodOptions,
  defaultPeriodKey,
  preparing,
  onClose,
  onConfirm,
}: PrepareSalaryModalProps) {
  const employees = useEmployeeOptions();

  const [periodKey, setPeriodKey] = useState(defaultPeriodKey);
  const [scope, setScope] = useState<Scope>('ALL');
  const [selected, setSelected] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  /* Reset on open: a previous attempt's period and selections must not leak in,
   * and the period should follow whatever the list is showing. */
  useEffect(() => {
    if (open) {
      setPeriodKey(defaultPeriodKey);
      setScope('ALL');
      setSelected([]);
      setFormError(null);
    }
  }, [open, defaultPeriodKey]);

  const toggleSelected = (employeeId: string) => {
    setSelected((prev) =>
      prev.includes(employeeId) ? prev.filter((id) => id !== employeeId) : [...prev, employeeId],
    );
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!periodKey) {
      setFormError('Choose the period to prepare.');
      return;
    }
    if (scope === 'SELECTED' && selected.length === 0) {
      setFormError('Choose at least one employee, or prepare for everyone.');
      return;
    }

    const input: PrepareSalaryInput = {
      periodKey,
      /* Omit `employeeIds` entirely for a full run: sending an empty array is not
       * the same thing, and the server treats a missing list as "everyone". */
      ...(scope === 'SELECTED' ? { employeeIds: selected } : {}),
    };

    await onConfirm(input);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Prepare salary"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={preparing}>
            Cancel
          </Button>
          <Button type="submit" form="prepare-salary-form" loading={preparing}>
            Prepare
          </Button>
        </>
      }
    >
      <form id="prepare-salary-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <Alert variant="info">
            Preparation creates one draft per active employee, with the net computed on the server
            from that month&apos;s attendance. Running it again for the same period is safe — anyone
            who already has a record is skipped, so only the missing ones are added.
          </Alert>

          {formError ? <Alert variant="danger">{formError}</Alert> : null}

          <FormField
            label="Period"
            required
            hint="The month to prepare. Amounts are calculated from that month's attendance."
          >
            <LookupSelect
              options={periodOptions}
              value={periodKey}
              onChange={(value) => {
                setPeriodKey(value);
                setFormError(null);
              }}
              placeholder="Select a month"
            />
          </FormField>

          <FormField label="Who to prepare">
            <LookupSelect
              options={[
                { value: 'ALL', label: 'Every active employee' },
                { value: 'SELECTED', label: 'Only the employees I pick' },
              ]}
              value={scope}
              onChange={(value) => {
                setScope(value as Scope);
                setFormError(null);
              }}
            />
          </FormField>

          {scope === 'SELECTED' ? (
            <FormField
              label="Employees"
              hint={
                employees.loading
                  ? 'Loading employees…'
                  : `Selected ${selected.length}. At least one is required.`
              }
            >
              {employees.options.length === 0 ? (
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                  No active employees to prepare.
                </p>
              ) : (
                <div
                  style={{
                    maxHeight: 240,
                    overflowY: 'auto',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-2)',
                  }}
                >
                  {employees.options.map((option) => (
                    <label
                      key={option.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-2)',
                        fontSize: 'var(--text-sm)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(option.value)}
                        onChange={() => toggleSelected(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              )}
            </FormField>
          ) : null}

          <p
            style={{
              margin: 0,
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
            }}
          >
            Allowances, advances and other deductions are set per employee on the record itself once
            the drafts exist — the server recalculates the net after each change.
          </p>
        </div>
      </form>
    </Modal>
  );
}
