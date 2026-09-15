/* ExitVisitorModal.tsx — FE-07
 * SRS §7: recording an exit flips the visitor INSIDE → EXITED and captures the
 * exit gate and (optionally) remarks.
 *
 * Both fields are optional at the API level, so the modal does not block on
 * them — a watchman must be able to wave someone through in one tap. The primary
 * button is therefore enabled immediately and labelled unambiguously. */

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { Visitor } from '@/types/domain';

export interface ExitVisitorValues {
  exitGate?: string;
  remarks?: string;
}

interface ExitVisitorModalProps {
  /** The visitor being signed out; `null` closes the modal. */
  visitor: Visitor | null;
  onClose: () => void;
  onConfirm: (values: ExitVisitorValues) => void | Promise<void>;
  saving?: boolean;
}

export function ExitVisitorModal({
  visitor,
  onClose,
  onConfirm,
  saving = false,
}: ExitVisitorModalProps) {
  const [exitGate, setExitGate] = useState('');
  const [remarks, setRemarks] = useState('');

  /* Clear on open so the previous visitor's gate never leaks into the next. */
  useEffect(() => {
    if (visitor) {
      setExitGate(visitor.entryGate ?? '');
      setRemarks('');
    }
  }, [visitor]);

  const open = visitor !== null;

  const handleConfirm = () => {
    void onConfirm({
      exitGate: exitGate.trim() || undefined,
      remarks: remarks.trim() || undefined,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record visitor exit"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} loading={saving}>
            Confirm exit
          </Button>
        </>
      }
    >
      {visitor ? (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-sm)' }}>
            <div>
              <strong>{visitor.visitorName}</strong>
              {visitor.mobile ? ` · ${visitor.mobile}` : ''}
            </div>
            <div style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
              Pass {visitor.passNumber}
              {visitor.flatNumber ? ` · Flat ${visitor.flatNumber}` : ''}
            </div>
          </div>

          <FormField label="Exit gate" hint="Optional.">
            <Input
              value={exitGate}
              onChange={(e) => setExitGate(e.target.value)}
              placeholder="e.g. Main gate"
            />
          </FormField>

          <FormField label="Remarks" hint="Optional.">
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="e.g. Left with a sealed package"
            />
          </FormField>
        </div>
      ) : null}
    </Modal>
  );
}
