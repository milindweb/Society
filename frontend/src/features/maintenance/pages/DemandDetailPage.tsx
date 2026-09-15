/* DemandDetailPage.tsx — FE-06
 * A single demand line. Because the backend stores one Demands row per flat × charge
 * type (Schema.gs `Demands`), this page explains that one line using the snapshotted
 * rate/basis rather than showing a separate allocation table (there isn't one).
 * Every amount is server-computed; the UI formats only (SRS §23). */

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
import { AmountText } from '@/components/data/AmountText';
import { PermissionGate } from '@/app/PermissionGate';
import { useDemand } from '../hooks/useDemands';
import { formatDate } from '@/lib/dates';
import { formatEnumKey } from '@/lib/format';

export default function DemandDetailPage() {
  const navigate = useNavigate();
  const { demandId } = useParams<{ demandId: string }>();
  const { demand, loading, error, busy, reload, cancel } = useDemand(demandId);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  const handleCancel = async () => {
    if (!reason.trim()) {
      setReasonError('A reason is required to cancel a demand.');
      return;
    }
    setReasonError(null);
    await cancel(reason.trim());
    setCancelOpen(false);
    setReason('');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner />
      </div>
    );
  }

  if (error || !demand) {
    return (
      <div>
        <PageHeader title="Demand Details" />
        <ErrorState
          title="Demand not found"
          message={error ?? 'This demand may have been removed.'}
          onRetry={() => void reload()}
        />
      </div>
    );
  }

  const canCancel = demand.statusKey !== 'CANCELLED' && demand.paidAmount === 0;

  return (
    <div>
      <PageHeader
        title={demand.chargeNameSnapshot || 'Demand'}
        subtitle={
          demand.flatNumber
            ? `${demand.periodKey} · Flat ${demand.wingName ? `${demand.wingName} · ` : ''}${demand.flatNumber}`
            : `${demand.periodKey} · Flat ${demand.flatId}`
        }
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Demands', route: '/maintenance/demands', onClick: () => navigate('/maintenance/demands') },
              { label: demand.periodKey },
            ]}
          />
        }
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="ghost"
              icon={<Icon name="back" size={16} />}
              onClick={() => navigate('/maintenance/demands')}
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
            <PermissionGate permission="maintenance.write">
              <Button
                variant="danger"
                icon={<Icon name="x" size={16} />}
                disabled={!canCancel}
                onClick={() => {
                  setCancelOpen(true);
                  setReason('');
                  setReasonError(null);
                }}
              >
                Cancel Demand
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

      {!canCancel && demand.paidAmount > 0 && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="info">
            This demand has payments against it, so it can no longer be cancelled. Use a reversal
            or an adjustment instead (SRS §24).
          </Alert>
        </div>
      )}

      <div className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2" style={{ gap: 'var(--space-4)' }}>
        <Card>
          <CardHeader title="Amounts" />
          <CardBody>
            <DescriptionList
              items={[
                { label: 'Charge Amount', value: <AmountText amount={demand.amount} /> },
                {
                  label: 'Previous Due',
                  value: <AmountText amount={demand.previousDueAmount} />,
                },
                { label: 'Interest', value: <AmountText amount={demand.interestAmount} /> },
                { label: 'Adjustment', value: <AmountText amount={demand.adjustmentAmount} /> },
                {
                  label: 'Total Payable',
                  value: (
                    <strong>
                      <AmountText amount={demand.totalPayable} />
                    </strong>
                  ),
                },
                { label: 'Paid', value: <AmountText amount={demand.paidAmount} /> },
                {
                  label: 'Balance',
                  value: (
                    <strong>
                      <AmountText amount={demand.balanceAmount} />
                    </strong>
                  ),
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Charge Basis (snapshot)" />
          <CardBody>
            <DescriptionList
              items={[
                { label: 'Charge Type', value: demand.chargeNameSnapshot || '—' },
                {
                  label: 'Calculation Method',
                  value: demand.calculationMethodSnapshot
                    ? formatEnumKey(demand.calculationMethodSnapshot)
                    : '—',
                },
                {
                  label: 'Rate',
                  value:
                    demand.rateSnapshot != null ? <AmountText amount={demand.rateSnapshot} /> : '—',
                },
                { label: 'Basis', value: demand.basisSnapshot || '—' },
                {
                  label: 'Quantity',
                  value: demand.quantitySnapshot != null ? String(demand.quantitySnapshot) : '—',
                },
              ]}
            />
            <p
              style={{
                marginTop: 'var(--space-3)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-muted)',
              }}
            >
              Rate and basis are frozen at generation time so a historical demand stays
              explainable even after the charge configuration changes.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Demand Details" />
          <CardBody>
            <DescriptionList
              items={[
                { label: 'Demand Number', value: demand.demandNumber || '—' },
                { label: 'Period', value: demand.periodKey },
                {
                  label: 'Flat',
                  value: (
                    <Button variant="link" onClick={() => navigate(`/flats/${demand.flatId}`)}>
                      {demand.flatNumber || demand.flatId}
                    </Button>
                  ),
                },
                { label: 'Status', value: <StatusBadge statusKey={demand.statusKey} /> },
                { label: 'Due Date', value: demand.dueDate ? formatDate(demand.dueDate) : '—' },
                { label: 'Carried Forward', value: demand.isCarriedForward ? 'Yes' : 'No' },
                {
                  label: 'Generated',
                  value: demand.generatedAt ? formatDate(demand.generatedAt, 'DD/MM/YYYY HH:mm') : '—',
                },
              ]}
            />
          </CardBody>
        </Card>

        {demand.statusKey === 'CANCELLED' && (
          <Card>
            <CardHeader title="Cancellation" />
            <CardBody>
              <DescriptionList
                items={[
                  {
                    label: 'Cancelled At',
                    value: demand.cancelledAt ? formatDate(demand.cancelledAt, 'DD/MM/YYYY HH:mm') : '—',
                  },
                  { label: 'Cancelled By', value: demand.cancelledBy || '—' },
                  { label: 'Reason', value: demand.cancelReason || '—', span: 2 },
                ]}
              />
            </CardBody>
          </Card>
        )}
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel Demand"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Keep Demand
            </Button>
            <Button variant="danger" onClick={() => void handleCancel()} loading={busy}>
              Cancel Demand
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Cancelling records the reason and keeps the demand visible for audit rather than deleting
          it (SRS §24). A reason is mandatory.
        </p>
        <div style={{ marginTop: 'var(--space-3)' }}>
          <FormField label="Reason" required error={reasonError ?? undefined}>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this demand being cancelled?"
              error={reasonError ?? undefined}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
