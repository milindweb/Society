/* MeetingCreateModal.tsx — FE-08
 * SRS §8: AGM / SGM / committee meetings with date, time, venue and agenda.
 * Scheduling is a modal over the list; the long-form writing (minutes,
 * resolutions, attendance) belongs on the detail page once the meeting has
 * actually happened.
 *
 * design.md §44: FormField label → control → hint/error.
 * SRS §15: meeting types come from config; never a literal here. */

import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { LookupSelect } from '@/components/data/LookupSelect';
import { useCreateMeeting } from '../hooks/useMeetings';
import { useMeetingTypeOptions } from '../hooks/useMeetingLookups';
import { required, validate, mapServerErrors, type FormErrors } from '@/lib/validation';
import { todayISO } from '@/lib/dates';
import type { Meeting } from '@/types/domain';

interface MeetingFormState {
  meetingTypeKey: string;
  title: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  agenda: string;
  quorumRequired: string;
}

function emptyForm(): MeetingFormState {
  return {
    meetingTypeKey: '',
    title: '',
    meetingDate: todayISO(),
    startTime: '',
    endTime: '',
    venue: '',
    agenda: '',
    quorumRequired: '',
  };
}

interface MeetingCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (meeting: Meeting) => void;
}

export function MeetingCreateModal({ open, onClose, onCreated }: MeetingCreateModalProps) {
  const types = useMeetingTypeOptions();
  const { create, creating, error: submitError } = useCreateMeeting();

  const [form, setForm] = useState<MeetingFormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});

  /* Reset on open so a half-filled previous meeting never leaks in. */
  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setErrors({});
    }
  }, [open]);

  const setField = <K extends keyof MeetingFormState>(key: K, value: MeetingFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  /** The three fields `meetings.create` insists on. */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const nextErrors: FormErrors = {};
    const typeError = validate(form.meetingTypeKey, [required('Meeting type is required')]);
    if (typeError) nextErrors.meetingTypeKey = typeError;
    const titleError = validate(form.title.trim(), [required('Title is required')]);
    if (titleError) nextErrors.title = titleError;
    const dateError = validate(form.meetingDate, [required('Meeting date is required')]);
    if (dateError) nextErrors.meetingDate = dateError;

    /* An end time before the start time is a data-entry slip, not a server rule;
     * catching it here saves a round-trip. */
    if (form.startTime && form.endTime && form.endTime < form.startTime) {
      nextErrors.endTime = 'The end time cannot be before the start time.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const created = await create({
      /* ⚠️ The option value is the Meeting_Types.typeKey, not its row id — that
       * is what the Meetings sheet stores and what the service validates. */
      meetingTypeKey: form.meetingTypeKey,
      title: form.title.trim(),
      meetingDate: form.meetingDate,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      venue: form.venue.trim() || undefined,
      agenda: form.agenda.trim() || undefined,
      quorumRequired: form.quorumRequired.trim() || undefined,
    });

    if (created) {
      setForm(emptyForm());
      onCreated(created);
    } else {
      const details = (submitError as unknown as { details?: { field: string; message: string }[] })
        ?.details;
      if (Array.isArray(details) && details.length > 0) setErrors(mapServerErrors(details));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule meeting"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button type="submit" form="meeting-create-form" loading={creating}>
            Schedule
          </Button>
        </>
      }
    >
      {submitError ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">
            <strong>Could not schedule the meeting.</strong> {submitError}
          </Alert>
        </div>
      ) : null}

      <form id="meeting-create-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <FormField label="Meeting type" required error={errors.meetingTypeKey}>
            <LookupSelect
              options={types.options}
              value={form.meetingTypeKey}
              onChange={(value) => setField('meetingTypeKey', value)}
              placeholder="Select type"
              loading={types.loading}
              error={errors.meetingTypeKey}
            />
          </FormField>

          {types.options.length === 0 && !types.loading ? (
            <Alert variant="warning">
              No meeting types were returned by the server. Add them in Settings first — the server
              validates the type when the meeting is created.
            </Alert>
          ) : null}

          <FormField label="Title" required error={errors.title}>
            <Input
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="e.g. Annual General Meeting 2026"
              error={errors.title}
            />
          </FormField>

          <FormField label="Meeting date" required error={errors.meetingDate}>
            <Input
              type="date"
              value={form.meetingDate}
              onChange={(e) => setField('meetingDate', e.target.value)}
              error={errors.meetingDate}
            />
          </FormField>

          <div
            className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
            style={{ gap: 'var(--space-4)' }}
          >
            <FormField label="Start time">
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => setField('startTime', e.target.value)}
              />
            </FormField>

            <FormField label="End time" error={errors.endTime}>
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => setField('endTime', e.target.value)}
                error={errors.endTime}
              />
            </FormField>
          </div>

          <FormField label="Venue">
            <Input
              value={form.venue}
              onChange={(e) => setField('venue', e.target.value)}
              placeholder="e.g. Community hall"
            />
          </FormField>

          <FormField
            label="Quorum required"
            hint="Optional. The number of members that must be present."
          >
            <Input
              type="number"
              min={0}
              value={form.quorumRequired}
              onChange={(e) => setField('quorumRequired', e.target.value)}
              placeholder="e.g. 25"
            />
          </FormField>

          <FormField label="Agenda" hint="Optional now — can be extended on the meeting page.">
            <Textarea
              value={form.agenda}
              onChange={(e) => setField('agenda', e.target.value)}
              rows={4}
              placeholder="Points to be discussed"
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
