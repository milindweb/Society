/* EndAllocationModal.tsx — FE-09
 * SRS §10: end an allocation, which also frees the slot.
 *
 * Mirrors `parking.allocations.end` (Routes.gs:818-823, ParkingService.gs): the
 * route requires `allocationId` + `endDate` + `clientRequestId`; the reason is
 * stored in the allocation's `remarks` column. The backend REFUSES anything that
 * is not ACTIVE ("Allocation is not active."), so the reason this dialog closes
 * is the SERVER's answer, not an assumption — `end()` returns false on failure
 * and the modal stays open with the message shown.
 *
 * Ending the last active allocation on a slot also flips that slot back to
 * AVAILABLE, server-side. The page reloads both the list and the summary rather
 * than adjusting its own numbers (SRS §23). */

import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { required, validate } from '@/lib/validation';
import { todayISO } from '@/lib/dates';
import type { ParkingAllocation } from '@/types/domain';

interface EndAllocationModalProps {
  open: boolean;
  allocation: ParkingAllocation | null;
  onClose: () => void;
  /** Must resolve to true only when the server accepted the end. */
  onConfirm: (input: { endDate: string; reason?: string }) => Promise<boolean>;
  busy?: boolean;
  error?: string | null;
}

export function EndAllocationModal({
  open,
  allocation,
  onClose,
  onConfirm,
  busy = false,
  error,
}: EndAllocationModalProps) {
  const [endDate, setEndDate] = useState(todayISO());
  const [reason, setReason] = useState('');
  const [dateError, setDateError] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      setEndDate(todayISO());
      setReason('');
      setDateError(undefined);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const nextDateError = validate(endDate, [required('An end date is required')]);
    if (nextDateError) {
      setDateError(nextDateError);
      return;
    }
    /* The end cannot precede the start — the backend does not cross-check this,
     * but a negative allocation period is never correct. */
    if (allocation?.startDate && endDate < allocation.startDate) {
      setDateError('The end date cannot be before the allocation start date.');
      return;
    }

    const ok = await onConfirm({ endDate, reason: reason.trim() || undefined });
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="End parking allocation"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="end-allocation-form" variant="danger" loading={busy}>
            End allocation
          </Button>
        </>
      }
    >
      {error ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">
            <strong>The allocation could not be ended.</strong> {error}
          </Alert>
        </div>
      ) : null}

      <form id="end-allocation-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
            {allocation?.slotNumber
              ? `Slot ${allocation.slotNumber}`
              : allocation
                ? `Slot ${allocation.parkingSlotId}`
                : 'This allocation'}{' '}
            will be marked ended. If it was the slot's last active allocation, the slot becomes
            available again.
          </p>

          <FormField label="End date" required error={dateError}>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                if (dateError) setDateError(undefined);
              }}
              error={dateError}
            />
          </FormField>

          <FormField label="Reason" hint="Optional. Recorded on the allocation and in the audit trail.">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Vehicle sold"
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
