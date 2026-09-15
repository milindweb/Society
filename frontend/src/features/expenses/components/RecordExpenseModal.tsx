/* RecordExpenseModal.tsx — FE-11
 * SRS §13: record an expense. Wraps the shared `ExpenseForm` in create mode.
 *
 * The modal closes only when `create` resolves to a record, so a rejected write (a
 * missing category, a validation error, an expired session) leaves the form open
 * with the server's message beside the fields that caused it.
 *
 * `create` returns the new row, so the caller can navigate to it — which matters
 * because the server generates `expenseNumber` and coerces the amount, and the
 * user should see the persisted values rather than the typed ones. */

import { useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ExpenseForm } from './ExpenseForm';
import { useCreateExpense } from '../hooks/useExpenses';
import type { Expense } from '@/types/domain';

interface RecordExpenseModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (expense: Expense) => void;
}

export function RecordExpenseModal({ open, onClose, onCreated }: RecordExpenseModalProps) {
  const { create, creating, error, reset } = useCreateExpense();

  /* Clear a previous attempt's error whenever the dialog is reopened. The form's
   * own state is keyed by `open` below so its fields reset too. */
  useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record an expense"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button type="submit" form="record-expense-form" loading={creating}>
            Record expense
          </Button>
        </>
      }
    >
      {/* Keying on `open` remounts the form each time the dialog opens, so no
       * value from a previous expense leaks into the next one. */}
      {open ? (
        <ExpenseForm
          key="record-expense"
          formId="record-expense-form"
          mode="create"
          serverError={error}
          onSubmitCreate={async (input) => {
            const created = await create(input);
            if (created) {
              onCreated(created);
              return true;
            }
            return false;
          }}
        />
      ) : null}
    </Modal>
  );
}
