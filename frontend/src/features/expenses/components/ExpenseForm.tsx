/* ExpenseForm.tsx — FE-11
 * The shared field set for recording and editing an expense.
 *
 * One component, two entry points, because `expenses.create` and `expenses.update`
 * accept almost the same surface — and where they differ, the difference is
 * visible rather than hidden:
 *
 *   create requires  expenseDate + categoryId + description + amount + paymentModeKey
 *                    (`Routes.gs:954-966`)
 *   update patches   the same fields, and `periodKey` / `expenseNumber` are absent
 *                    from BOTH because the server will not take them
 *                    (`ExpenseService.gs:155` — `periodKey` is set on create and
 *                    never patchable afterwards)
 *
 * Because `periodKey` is not patchable, it is shown on the edit path as read-only
 * context rather than as an input that would be silently dropped.
 *
 * Two server behaviours the form respects:
 *  - `amount` is coerced through `Utils.toNumber` on the way in
 *    (`ExpenseService.gs:122`), so a typed "1,200" becomes 1200 — the form sends
 *    the raw string and the page reloads to show what was stored. It never
 *    reformats the value locally and pretends that is what was saved.
 *  - the server OWNS `expenseNumber`, `statusKey` and `paidBy`. There are no
 *    fields for them.
 *
 * SRS §15: categories, vendors and payment modes all arrive from config. */

import { useState, type FormEvent } from 'react';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { LookupSelect } from '@/components/data/LookupSelect';
import {
  useExpenseCategoryOptions,
  useExpensePaymentModeOptions,
  useExpenseVendorOptions,
} from '../hooks/useExpenseLookups';
import { required, validate, type FormErrors } from '@/lib/validation';
import { parseMoneyInput } from '@/lib/money';
import { emptyExpenseForm, type ExpenseFormValues } from './expenseFormModel';
import type { CreateExpenseInput, UpdateExpenseInput } from '@/services/expenseService';

interface ExpenseFormProps {
  /** Lets a modal's footer button submit this form from outside it. */
  formId: string;
  mode: 'create' | 'edit';
  initial?: ExpenseFormValues;
  /** Create mode only — shown read-only in edit mode because it is not patchable. */
  periodKey?: string;
  /** Forwarded verbatim from the hook, so a server refusal is visible in the form. */
  serverError?: string | null;
  onSubmitCreate?: (input: CreateExpenseInput) => Promise<boolean>;
  onSubmitUpdate?: (input: Omit<UpdateExpenseInput, 'expenseId'>) => Promise<boolean>;
}

export function ExpenseForm({
  formId,
  mode,
  initial,
  periodKey,
  serverError,
  onSubmitCreate,
  onSubmitUpdate,
}: ExpenseFormProps) {
  const categories = useExpenseCategoryOptions();
  const vendors = useExpenseVendorOptions();
  const paymentModes = useExpensePaymentModeOptions();

  const [form, setForm] = useState<ExpenseFormValues>(() => initial ?? emptyExpenseForm());
  const [errors, setErrors] = useState<FormErrors>({});

  const set = <K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const nextErrors: FormErrors = {};
    const dateError = validate(form.expenseDate, [required('An expense date is required')]);
    if (dateError) nextErrors.expenseDate = dateError;
    const categoryError = validate(form.categoryId, [required('Choose a category')]);
    if (categoryError) nextErrors.categoryId = categoryError;
    const descriptionError = validate(form.description.trim(), [required('A description is required')]);
    if (descriptionError) nextErrors.description = descriptionError;
    const amountError = validate(form.amount.trim(), [required('An amount is required')]);
    if (amountError) nextErrors.amount = amountError;
    const modeError = validate(form.paymentModeKey, [required('Choose a payment mode')]);
    if (modeError) nextErrors.paymentModeKey = modeError;

    /* A blank amount already failed `required`; only a non-numeric one is left to
     * catch here. `parseMoneyInput` strips currency characters, so "1,200" is
     * accepted and "abc" is not. */
    if (!amountError && form.amount.trim() !== '') {
      if (Number.isNaN(Number(form.amount.replace(/[^0-9.-]/g, '')))) {
        nextErrors.amount = 'Enter a number.';
      } else if (parseMoneyInput(form.amount) < 0) {
        nextErrors.amount = 'The amount cannot be negative.';
      }
    }

    /* A payee name alongside a vendor record is a contradiction the user should
     * resolve, but the server allows both — so this is a soft warning, not a
     * block. Left blank either way is fine. */

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload = {
      expenseDate: form.expenseDate,
      categoryId: form.categoryId,
      description: form.description.trim(),
      amount: form.amount.trim(),
      paymentModeKey: form.paymentModeKey,
      vendorId: form.vendorId || undefined,
      payeeName: form.payeeName.trim() || undefined,
      referenceNumber: form.referenceNumber.trim() || undefined,
      remarks: form.remarks.trim() || undefined,
    };

    if (mode === 'create') {
      await onSubmitCreate?.(payload);
    } else {
      await onSubmitUpdate?.(payload);
    }
  };

  return (
    <form id={formId} onSubmit={(e) => void handleSubmit(e)} noValidate>
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        {serverError ? <Alert variant="danger">{serverError}</Alert> : null}

        {mode === 'edit' && periodKey ? (
          <Alert variant="info">
            This expense belongs to the {periodKey} period. The period is fixed when an expense is
            recorded and cannot be changed afterwards.
          </Alert>
        ) : null}

        <div className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2" style={{ gap: 'var(--space-4)' }}>
          <FormField label="Expense date" required error={errors.expenseDate}>
            <Input
              type="date"
              value={form.expenseDate}
              onChange={(e) => set('expenseDate', e.target.value)}
              error={errors.expenseDate}
            />
          </FormField>

          <FormField
            label="Amount"
            required
            error={errors.amount}
            hint="The figure the server stores is this amount, rounded to two decimals."
          >
            <Input
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 4500"
              error={errors.amount}
            />
          </FormField>
        </div>

        <FormField label="Category" required error={errors.categoryId}>
          <LookupSelect
            options={categories.options}
            value={form.categoryId}
            onChange={(value) => set('categoryId', value)}
            placeholder="Select a category"
            loading={categories.loading}
            error={errors.categoryId}
          />
        </FormField>

        <FormField
          label="Description"
          required
          error={errors.description}
          hint="What the money was spent on."
        >
          <Input
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="e.g. Lift annual maintenance"
            error={errors.description}
          />
        </FormField>

        <div className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2" style={{ gap: 'var(--space-4)' }}>
          <FormField
            label="Payment mode"
            required
            error={errors.paymentModeKey}
            hint={paymentModes.loading ? 'Loading modes…' : 'How it was paid.'}
          >
            <LookupSelect
              options={paymentModes.options}
              value={form.paymentModeKey}
              onChange={(value) => set('paymentModeKey', value)}
              placeholder="Select a payment mode"
              loading={paymentModes.loading}
              error={errors.paymentModeKey}
            />
          </FormField>

          <FormField label="Reference number" hint="Optional. A bill, cheque or transaction number.">
            <Input
              value={form.referenceNumber}
              onChange={(e) => set('referenceNumber', e.target.value)}
            />
          </FormField>
        </div>

        <FormField
          label="Vendor"
          hint="Optional. Leave blank for a one-off payment and name the payee below instead."
        >
          <LookupSelect
            options={vendors.options}
            value={form.vendorId}
            onChange={(value) => set('vendorId', value)}
            placeholder="No vendor record"
            loading={vendors.loading}
          />
        </FormField>

        <FormField
          label="Payee name"
          hint="Optional. Who was actually paid, when there is no vendor record."
        >
          <Input
            value={form.payeeName}
            onChange={(e) => set('payeeName', e.target.value)}
            placeholder="e.g. Ravi Electricals"
          />
        </FormField>

        <FormField label="Remarks" hint="Optional.">
          <Textarea value={form.remarks} onChange={(e) => set('remarks', e.target.value)} rows={3} />
        </FormField>

        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          The expense number and the status are assigned by the server. A supporting bill is attached
          from the Documents module, which keeps every society document in one place.
        </p>
      </div>
    </form>
  );
}
