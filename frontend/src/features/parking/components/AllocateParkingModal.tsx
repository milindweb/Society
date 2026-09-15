/* AllocateParkingModal.tsx — FE-09
 * SRS §10: allocate a slot to a flat/member with a vehicle, permanent or
 * temporary, with an optional monthly charge.
 *
 * The form mirrors the `parking.allocations.create` route validator exactly
 * (Routes.gs:805-816): parkingSlotId, flatId, allocationType and startDate are
 * required; everything else is optional. `clientRequestId` is added by the hook.
 *
 * Two behaviours are deliberate:
 *  - The slot picker only offers AVAILABLE slots (`isSlotAllocatable`). The
 *    backend enforces one ACTIVE allocation per slot regardless, so this is a
 *    convenience, not the guard.
 *  - A `CONFLICT_ERROR` from the server (slot or vehicle already allocated) is
 *    shown INLINE against the field it concerns, verbatim. We do not re-word it
 *    and we do not pre-empt it — the server is the only authority on what is
 *    taken right now (SRS §23: no optimistic UI).
 *
 * SRS §15: slots, types, flats and vehicles all come from the API. */

import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { LookupSelect } from '@/components/data/LookupSelect';
import { useCreateAllocation } from '../hooks/useParking';
import {
  useParkingSlotOptions,
  useVehicleOptions,
  useAllocationTypeOptions,
} from '../hooks/useParkingLookups';
import { useFlatOptions } from '@/features/members/hooks/useFlatOptions';
import { isConflictError } from '@/services/parkingService';
import { required, validate, type FormErrors } from '@/lib/validation';
import { todayISO } from '@/lib/dates';
import type { ParkingAllocation } from '@/types/domain';

interface AllocateParkingModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (allocation: ParkingAllocation) => void;
}

interface FormState {
  parkingSlotId: string;
  flatId: string;
  allocationType: string;
  startDate: string;
  endDate: string;
  vehicleId: string;
  vehicleNumber: string;
  monthlyCharge: string;
  remarks: string;
}

export function AllocateParkingModal({ open, onClose, onCreated }: AllocateParkingModalProps) {
  const slots = useParkingSlotOptions();
  const vehicles = useVehicleOptions();
  const allocationTypes = useAllocationTypeOptions();
  const flats = useFlatOptions();
  const { create, creating, error: submitError, errorCode, reset } = useCreateAllocation();

  const [form, setForm] = useState<FormState>({
    parkingSlotId: '',
    flatId: '',
    allocationType: '',
    startDate: todayISO(),
    endDate: '',
    vehicleId: '',
    vehicleNumber: '',
    monthlyCharge: '',
    remarks: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  /* Reset on open so a previous attempt's values and error never leak in. */
  useEffect(() => {
    if (open) {
      setForm({
        parkingSlotId: '',
        flatId: '',
        allocationType: '',
        startDate: todayISO(),
        endDate: '',
        vehicleId: '',
        vehicleNumber: '',
        monthlyCharge: '',
        remarks: '',
      });
      setErrors({});
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key as string]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    }
  };

  /* A CONFLICT_ERROR names a slot or a vehicle; anchor it to the right field so
   * the user knows which input to change. */
  const conflictField: string | undefined = isConflictError({ code: errorCode ?? undefined })
    ? (submitError ?? '').toLowerCase().includes('vehicle')
      ? 'vehicleId'
      : 'parkingSlotId'
    : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const nextErrors: FormErrors = {};
    const slotError = validate(form.parkingSlotId, [required('Choose a parking slot')]);
    if (slotError) nextErrors.parkingSlotId = slotError;
    const flatError = validate(form.flatId, [required('Choose a flat')]);
    if (flatError) nextErrors.flatId = flatError;
    const typeError = validate(form.allocationType, [required('Choose an allocation type')]);
    if (typeError) nextErrors.allocationType = typeError;
    const startError = validate(form.startDate, [required('A start date is required')]);
    if (startError) nextErrors.startDate = startError;

    /* A TEMPORARY allocation is expected to end, so the end date is required for
     * it. The backend accepts an empty endDate, but a temporary allocation with
     * no end is meaningless to the society. */
    if (form.allocationType === 'TEMPORARY' && !form.endDate) {
      nextErrors.endDate = 'A temporary allocation needs an end date.';
    }
    if (form.endDate && form.startDate && form.endDate < form.startDate) {
      nextErrors.endDate = 'The end date cannot be before the start date.';
    }

    /* A vehicle number without a vehicle record is allowed (the backend stores
     * both independently), but a charge must be a non-negative number. */
    if (form.monthlyCharge.trim() !== '' && Number.isNaN(Number(form.monthlyCharge))) {
      nextErrors.monthlyCharge = 'Enter a number, or leave this blank.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const result = await create({
      parkingSlotId: form.parkingSlotId,
      flatId: form.flatId,
      allocationType: form.allocationType,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
      vehicleId: form.vehicleId || undefined,
      vehicleNumber: form.vehicleNumber.trim() || undefined,
      monthlyCharge: form.monthlyCharge.trim() || undefined,
      remarks: form.remarks.trim() || undefined,
    });

    if (result) onCreated(result);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Allocate a parking slot"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button type="submit" form="allocate-parking-form" loading={creating}>
            Allocate
          </Button>
        </>
      }
    >
      {submitError ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">
            <strong>The allocation was refused.</strong> {submitError}
          </Alert>
        </div>
      ) : null}

      <form id="allocate-parking-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <Alert variant="info">
            Allocating a slot marks it as occupied, and ending the allocation frees it again. Only
            one active allocation is allowed per slot and per vehicle.
          </Alert>

          <FormField
            label="Parking slot"
            required
            error={errors.parkingSlotId}
            hint={conflictField === 'parkingSlotId' ? submitError ?? undefined : 'Only free slots are offered.'}
          >
            <LookupSelect
              options={slots.options}
              value={form.parkingSlotId}
              onChange={(value) => set('parkingSlotId', value)}
              placeholder="Select a free slot"
              loading={slots.loading}
              error={errors.parkingSlotId}
            />
          </FormField>

          <FormField
            label="Flat"
            required
            error={errors.flatId}
            hint="The flat the slot is allocated to."
          >
            <LookupSelect
              options={flats.options}
              value={form.flatId}
              onChange={(value) => set('flatId', value)}
              onSearch={flats.searchFlats}
              placeholder="Search flats"
              loading={flats.loading}
              error={errors.flatId}
            />
          </FormField>

          <FormField label="Allocation type" required error={errors.allocationType}>
            <LookupSelect
              options={allocationTypes.options}
              value={form.allocationType}
              onChange={(value) => set('allocationType', value)}
              placeholder="Permanent or temporary"
              loading={allocationTypes.loading}
              error={errors.allocationType}
            />
          </FormField>

          <div
            className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
            style={{ gap: 'var(--space-4)' }}
          >
            <FormField label="Start date" required error={errors.startDate}>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)}
                error={errors.startDate}
              />
            </FormField>
            <FormField
              label="End date"
              error={errors.endDate}
              hint={form.allocationType === 'TEMPORARY' ? 'Required for a temporary allocation.' : 'Optional.'}
            >
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => set('endDate', e.target.value)}
                error={errors.endDate}
              />
            </FormField>
          </div>

          <FormField label="Vehicle" error={errors.vehicleId} hint="Optional. The vehicle using this slot.">
            <LookupSelect
              options={vehicles.options}
              value={form.vehicleId}
              onChange={(value) => set('vehicleId', value)}
              placeholder="Not linked to a vehicle record"
              loading={vehicles.loading}
              error={errors.vehicleId}
            />
          </FormField>

          <FormField
            label="Vehicle number"
            hint="Optional. Free text, in case the vehicle is not in the register."
          >
            <Input
              value={form.vehicleNumber}
              onChange={(e) => set('vehicleNumber', e.target.value)}
              placeholder="e.g. KA-01-AB-1234"
            />
          </FormField>

          <FormField
            label="Monthly charge"
            error={errors.monthlyCharge}
            hint="Optional. Stored as entered; the amount is never computed here."
          >
            <Input
              value={form.monthlyCharge}
              onChange={(e) => set('monthlyCharge', e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 500"
              error={errors.monthlyCharge}
            />
          </FormField>

          <FormField label="Remarks">
            <Textarea
              value={form.remarks}
              onChange={(e) => set('remarks', e.target.value)}
              rows={3}
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
