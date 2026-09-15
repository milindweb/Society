/* expenseFormModel.ts — FE-11 shared expense form model
 *
 * Kept out of `ExpenseForm.tsx` on purpose: a module that exports a component
 * alongside a plain function defeats react-refresh, because the dev server cannot
 * tell a component update from a non-component one and falls back to a full reload.
 * The values type and its two helpers therefore live here, and the component file
 * exports only the component.
 *
 * `periodKey` is part of the form VALUES for display, but it is deliberately NOT
 * part of the payload: `expenses.update` does not accept it
 * (`ExpenseService.gs:155` — the allow-list omits `periodKey`), so sending it would
 * imply the edit could move the expense between periods. It cannot. */

import { todayISO } from '@/lib/dates';
import type { Expense } from '@/types/domain';

export interface ExpenseFormValues {
  expenseDate: string;
  categoryId: string;
  description: string;
  amount: string;
  paymentModeKey: string;
  vendorId: string;
  payeeName: string;
  referenceNumber: string;
  remarks: string;
}

/** A blank expense, dated today. */
export function emptyExpenseForm(): ExpenseFormValues {
  return {
    expenseDate: todayISO(),
    categoryId: '',
    description: '',
    amount: '',
    paymentModeKey: '',
    vendorId: '',
    payeeName: '',
    referenceNumber: '',
    remarks: '',
  };
}

/** Seed the form from an existing row, for the edit path.
 *
 * `amount` is copied through as the raw STRING the sheet holds — no reformatting.
 * If the form prettied it up and the user saved without touching it, the value
 * sent would differ from the value stored for no reason the user asked for. */
export function valuesFromExpense(expense: Expense): ExpenseFormValues {
  return {
    expenseDate: expense.expenseDate || todayISO(),
    categoryId: expense.categoryId || '',
    description: expense.description || '',
    amount: expense.amount ?? '',
    paymentModeKey: expense.paymentModeKey || '',
    vendorId: expense.vendorId || '',
    payeeName: expense.payeeName || '',
    referenceNumber: expense.referenceNumber || '',
    remarks: expense.remarks || '',
  };
}
