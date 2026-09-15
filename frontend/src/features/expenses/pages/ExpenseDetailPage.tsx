/* ExpenseDetailPage.tsx — FE-11
 * SRS §13: one expense — what it was, who was paid, how, and whether it stands.
 *
 * Contract notes (verified against ExpenseService.gs:103-210):
 * - `expenses.get` returns the **raw row**, with no join: there is no
 *   `categoryName` or `vendorName` on it. Both are resolved here from the config
 *   lookups, which is why the lookups are loaded on a detail page at all.
 * - `expenses.update` patches an allow-list and **refuses a CANCELLED row**
 *   ("Cannot update a cancelled expense."). The edit action is gated by
 *   `canEditExpense()`; the server enforces it regardless.
 * - `expenses.cancel` requires a reason and **refuses an already-cancelled row**
 *   ("Expense is already cancelled."). There is **no un-cancel route**, so once
 *   cancelled the record is read-only for good and the UI says so.
 * - `periodKey` is set on create and is **not patchable**. It is displayed as
 *   context, never as an editable field.
 *
 * `amount` is a STRING on the sheet, parsed for display only (SRS §8/§23). Nothing
 * on this page computes a total. */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Alert } from '@/components/ui/Alert';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Textarea } from '@/components/ui/Textarea';
import { PermissionGate } from '@/app/PermissionGate';
import { AmountText } from '@/components/data/AmountText';
import { ExpenseForm } from '../components/ExpenseForm';
import { valuesFromExpense } from '../components/expenseFormModel';
import { useExpense } from '../hooks/useExpenses';
import {
  useExpenseCategoryOptions,
  useExpensePaymentModeOptions,
  useExpenseVendorOptions,
} from '../hooks/useExpenseLookups';
import { canCancelExpense, canEditExpense, isCancelledExpense } from '@/services/expenseService';
import { formatDate, formatDateTime } from '@/lib/dates';

export default function ExpenseDetailPage() {
  const navigate = useNavigate();
  const { expenseId } = useParams<{ expenseId: string }>();

  const { expense, loading, error, busy, reload, update, cancel } = useExpense(expenseId);

  const categories = useExpenseCategoryOptions();
  const vendors = useExpenseVendorOptions();
  const paymentModes = useExpensePaymentModeOptions();

  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  if (loading) {
    return (
      <div>
        <PageHeader title="Expense" subtitle="Loading…" />
        <Skeleton height={320} variant="rect" />
      </div>
    );
  }

  if (!expense) {
    return (
      <div>
        <PageHeader title="Expense" subtitle="Not available" />
        <ErrorState
          message={error ?? 'This expense could not be loaded.'}
          onRetry={() => void reload()}
        />
      </div>
    );
  }

  const cancelled = isCancelledExpense(expense.statusKey);

  const categoryLabel =
    categories.options.find((option) => option.value === expense.categoryId)?.label ||
    expense.categoryId ||
    'Uncategorised';

  const vendorLabel =
    vendors.options.find((option) => option.value === expense.vendorId)?.label ||
    expense.vendorId ||
    '—';

  const paymentLabel =
    paymentModes.options.find((option) => option.value === expense.paymentModeKey)?.label ||
    expense.paymentModeKey ||
    '—';

  return (
    <div>
      <PageHeader
        title={expense.expenseNumber}
        subtitle={`${categoryLabel} · ${expense.expenseDate ? formatDate(expense.expenseDate) : '—'}`}
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Expenses', onClick: () => navigate('/expenses') },
              { label: expense.expenseNumber },
            ]}
          />
        }
        actions={
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <StatusBadge statusKey={expense.statusKey} />
            {canEditExpense(expense.statusKey) ? (
              <PermissionGate permission="expenses.write">
                <Button
                  variant="secondary"
                  icon={<Icon name="edit" size={16} />}
                  onClick={() => setEditing(true)}
                  disabled={busy}
                >
                  Edit
                </Button>
              </PermissionGate>
            ) : null}
            {canCancelExpense(expense.statusKey) ? (
              <PermissionGate permission="expenses.write">
                <Button
                  variant="danger"
                  icon={<Icon name="x" size={16} />}
                  onClick={() => {
                    setReason('');
                    setReasonError(null);
                    setCancelling(true);
                  }}
                  disabled={busy}
                >
                  Cancel expense
                </Button>
              </PermissionGate>
            ) : null}
          </div>
        }
      />

      {/* A refusal from the server, in the server's own words. */}
      {error ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">{error}</Alert>
        </div>
      ) : null}

      {cancelled ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="warning">
            This expense was cancelled
            {expense.cancelledAt ? ` on ${formatDateTime(expense.cancelledAt)}` : ''}
            {expense.cancelReason ? ` — “${expense.cancelReason}”` : '.'} A cancelled expense is kept
            for the record and cannot be edited or reinstated.
          </Alert>
        </div>
      ) : null}

      <Card>
        <CardBody>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 'var(--space-1)',
            }}
          >
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Amount recorded
            </span>
            <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>
              <AmountText amount={Number(expense.amount) || 0} />
            </span>
          </div>
        </CardBody>
      </Card>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardHeader title="Details" />
        <CardBody>
          <DescriptionList
            columns={2}
            items={[
              { label: 'Expense number', value: expense.expenseNumber },
              {
                label: 'Expense date',
                value: expense.expenseDate ? formatDate(expense.expenseDate) : '—',
              },
              { label: 'Period', value: expense.periodKey || '—' },
              { label: 'Category', value: categoryLabel },
              { label: 'Description', value: expense.description || '—', span: 2 },
              { label: 'Vendor', value: vendorLabel },
              { label: 'Payee name', value: expense.payeeName || '—' },
              { label: 'Payment mode', value: paymentLabel },
              { label: 'Reference number', value: expense.referenceNumber || '—' },
              {
                label: 'Amount',
                value: <AmountText amount={Number(expense.amount) || 0} />,
              },
              { label: 'Status', value: <StatusBadge statusKey={expense.statusKey} /> },
            ]}
          />
        </CardBody>
      </Card>

      {expense.remarks ? (
        <Card style={{ marginTop: 'var(--space-4)' }}>
          <CardHeader title="Remarks" />
          <CardBody>
            <p style={{ margin: 0 }}>{expense.remarks}</p>
          </CardBody>
        </Card>
      ) : null}

      {cancelled ? (
        <Card style={{ marginTop: 'var(--space-4)' }}>
          <CardHeader title="Cancellation" />
          <CardBody>
            <DescriptionList
              columns={2}
              items={[
                {
                  label: 'Cancelled at',
                  value: expense.cancelledAt ? formatDateTime(expense.cancelledAt) : '—',
                },
                { label: 'Cancelled by', value: expense.cancelledBy || '—' },
                { label: 'Reason', value: expense.cancelReason || '—', span: 2 },
              ]}
            />
          </CardBody>
        </Card>
      ) : null}

      {/* Supporting document. The attachment is a JSON string on the sheet and this
       * phase does not upload — attaching is the Documents module's job (SRS §9),
       * so this states where it lives rather than offering a broken control. */}
      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardHeader title="Supporting document" />
        <CardBody>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            {expense.attachmentRef
              ? 'A supporting document is referenced on this expense.'
              : 'No supporting document is attached. Bills are uploaded from the Documents module, which keeps every society document in one place, and referenced here.'}
          </p>
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Button
              variant="ghost"
              icon={<Icon name="documents" size={16} />}
              onClick={() => navigate('/documents')}
            >
              Open Documents
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Edit — the shared form in edit mode. Blocked server-side for a cancelled
       * row, and the button above is not offered then either. */}
      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit expense"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="edit-expense-form" loading={busy}>
              Save changes
            </Button>
          </>
        }
      >
        {editing ? (
          <ExpenseForm
            key="edit-expense"
            formId="edit-expense-form"
            mode="edit"
            initial={valuesFromExpense(expense)}
            periodKey={expense.periodKey}
            serverError={error}
            onSubmitUpdate={async (input) => {
              const ok = await update(input);
              if (ok) setEditing(false);
              return ok;
            }}
          />
        ) : null}
      </Modal>

      {/* Cancel — a reason is required by both the route validator and the service.
       * Shown as a Modal rather than a ConfirmDialog because the reason is an input,
       * not a message. */}
      <Modal
        open={cancelling}
        onClose={() => setCancelling(false)}
        title="Cancel this expense?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelling(false)} disabled={busy}>
              Keep expense
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (reason.trim() === '') {
                  setReasonError('A reason is required to cancel an expense.');
                  return;
                }
                void (async () => {
                  const ok = await cancel(reason.trim());
                  if (ok) setCancelling(false);
                })();
              }}
              loading={busy}
            >
              Cancel expense
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <Alert variant="warning">
            Cancelling keeps the record but removes it from every total the society reports. It cannot
            be undone.
          </Alert>

          {error ? <Alert variant="danger">{error}</Alert> : null}

          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            {expense.expenseNumber} · {categoryLabel} ·{' '}
            <AmountText amount={Number(expense.amount) || 0} />
          </p>

          <FormField label="Reason" required error={reasonError ?? undefined}>
            <Textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError) setReasonError(null);
              }}
              rows={3}
              placeholder="Why is this expense being cancelled?"
              error={reasonError ?? undefined}
            />
          </FormField>
        </div>
      </Modal>

      <div style={{ marginTop: 'var(--space-4)' }}>
        <Button
          variant="ghost"
          icon={<Icon name="back" size={16} />}
          onClick={() => navigate('/expenses')}
        >
          Back to expenses
        </Button>
      </div>
    </div>
  );
}
