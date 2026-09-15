/* PaymentDetailPage.tsx — FE-06
 * A recorded payment with the allocation rows the server produced and a link to its
 * receipt. Reversal is a correction, not a deletion (SRS §24), and requires a reason. */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Textarea } from '@/components/ui/Textarea';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { DataTable, type Column } from '@/components/data/DataTable';
import { AmountText } from '@/components/data/AmountText';
import { PermissionGate } from '@/app/PermissionGate';
import { usePayment } from '../hooks/usePayments';
import { formatDate } from '@/lib/dates';
import { formatEnumKey } from '@/lib/format';
import type { PaymentAllocation } from '@/types/domain';

export default function PaymentDetailPage() {
  const navigate = useNavigate();
  const { paymentId } = useParams<{ paymentId: string }>();
  const { payment, loading, error, busy, reload, reverse } = usePayment(paymentId);

  const [reverseOpen, setReverseOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  const handleReverse = async () => {
    if (!reason.trim()) {
      setReasonError('A reason is required to reverse a payment.');
      return;
    }
    setReasonError(null);
    await reverse(reason.trim());
    setReverseOpen(false);
    setReason('');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner />
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div>
        <PageHeader title="Payment Details" />
        <ErrorState
          title="Payment not found"
          message={error ?? 'This payment may have been removed.'}
          onRetry={() => void reload()}
        />
      </div>
    );
  }

  // Allocation rows are not part of the payment payload returned by payments.get, so they
  // are only shown when the API supplies them. The page does not invent a split.
  const allocations =
    (payment as unknown as { allocations?: PaymentAllocation[] }).allocations ?? [];

  const allocationColumns: Column<PaymentAllocation>[] = [
    { key: 'periodKey', header: 'Period', render: (r) => r.periodKey || '—' },
    { key: 'demandId', header: 'Demand', render: (r) => r.demandId },
    {
      key: 'amount',
      header: 'Allocated',
      align: 'right',
      render: (r) => <AmountText amount={r.amount} />,
    },
  ];

  const reversed = payment.statusKey === 'REVERSED' || payment.statusKey === 'CANCELLED';

  return (
    <div>
      <PageHeader
        title={`Payment ${payment.receiptNumber}`}
        subtitle={
          payment.flatNumber
            ? `Flat ${payment.flatNumber} · ${formatDate(payment.paymentDate)}`
            : formatDate(payment.paymentDate)
        }
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Payments', route: '/payments', onClick: () => navigate('/payments') },
              { label: payment.receiptNumber },
            ]}
          />
        }
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="ghost"
              icon={<Icon name="back" size={16} />}
              onClick={() => navigate('/payments')}
            >
              Back
            </Button>
            <Button
              variant="secondary"
              icon={<Icon name="refresh" size={16} />}
              onClick={() => void reload()}
            >
              Refresh
            </Button>
            <PermissionGate permission="payments.reverse">
              <Button
                variant="danger"
                icon={<Icon name="x" size={16} />}
                disabled={reversed}
                onClick={() => {
                  setReverseOpen(true);
                  setReason('');
                  setReasonError(null);
                }}
              >
                Reverse Payment
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {error && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      <div className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2" style={{ gap: 'var(--space-4)' }}>
        <Card>
          <CardHeader title="Payment" />
          <CardBody>
            <DescriptionList
              items={[
                { label: 'Receipt Number', value: payment.receiptNumber },
                { label: 'Date', value: formatDate(payment.paymentDate) },
                {
                  label: 'Flat',
                  value: (
                    <Button variant="link" onClick={() => navigate(`/flats/${payment.flatId}`)}>
                      {payment.flatNumber || payment.flatId}
                    </Button>
                  ),
                },
                { label: 'Amount', value: <AmountText amount={payment.amount} /> },
                {
                  label: 'Mode',
                  value: formatEnumKey(payment.paymentModeKey),
                },
                { label: 'Reference', value: payment.referenceNumber || '—' },
                { label: 'Bank', value: payment.bankName || '—' },
                { label: 'Status', value: <StatusBadge statusKey={payment.statusKey} /> },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Allocation" />
          <CardBody>
            <DescriptionList
              items={[
                { label: 'Allocated', value: <AmountText amount={payment.allocatedAmount} /> },
                {
                  label: 'Unallocated',
                  value: <AmountText amount={payment.unallocatedAmount} />,
                },
                {
                  label: 'Received By',
                  value: payment.receivedBy || '—',
                },
                {
                  label: 'Received At',
                  value: payment.receivedAt ? formatDate(payment.receivedAt, 'DD/MM/YYYY HH:mm') : '—',
                },
                { label: 'Remarks', value: payment.remarks || '—', span: 2 },
              ]}
            />
            {payment.unallocatedAmount > 0 && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <Alert variant="warning">
                  Part of this payment could not be matched to an outstanding demand and is held as
                  unallocated. It will be applied as further demands fall due.
                </Alert>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardHeader
          title="Allocation Detail"
          action={
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon name="print" size={14} />}
              onClick={() => navigate('/receipts')}
            >
              All Receipts
            </Button>
          }
        />
        <CardBody>
          {allocations.length === 0 ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Allocation rows are created by the server when the payment is recorded. Where the API
              does not return them with this record, review them on the receipt or the member
              ledger.
            </p>
          ) : (
            <DataTable
              columns={allocationColumns}
              data={allocations}
              getRowId={(r) => r.allocationId}
            />
          )}
        </CardBody>
      </Card>

      {reversed && payment.cancelReason && (
        <Card style={{ marginTop: 'var(--space-4)' }}>
          <CardHeader title="Reversal" />
          <CardBody>
            <DescriptionList
              items={[
                {
                  label: 'Reversed At',
                  value: payment.cancelledAt ? formatDate(payment.cancelledAt, 'DD/MM/YYYY HH:mm') : '—',
                },
                { label: 'Reversed By', value: payment.cancelledBy || '—' },
                { label: 'Reason', value: payment.cancelReason, span: 2 },
              ]}
            />
          </CardBody>
        </Card>
      )}

      <Modal
        open={reverseOpen}
        onClose={() => setReverseOpen(false)}
        title="Reverse Payment"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReverseOpen(false)}>
              Keep Payment
            </Button>
            <Button variant="danger" onClick={() => void handleReverse()} loading={busy}>
              Reverse Payment
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Reversing restores the affected demands to their prior balance and writes a counter
          ledger entry. The original record stays visible for audit (SRS §24). A reason is
          mandatory.
        </p>
        <div style={{ marginTop: 'var(--space-3)' }}>
          <FormField label="Reason" required error={reasonError ?? undefined}>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this payment being reversed?"
              error={reasonError ?? undefined}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
