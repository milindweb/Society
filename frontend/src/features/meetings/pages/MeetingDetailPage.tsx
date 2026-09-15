/* MeetingDetailPage.tsx — FE-08
 * SRS §8: a meeting records its date, time, venue, agenda, MINUTES,
 * RESOLUTIONS, attendance and the linked documents; the record is kept as
 * history. Everything except attendance is a patch on the meeting row, so it is
 * edited in place on the Overview tab. Attendance is its own entity and gets the
 * Attendance tab.
 *
 * Contract notes (verified against backend/src/CommunicationService.gs):
 * - `meetings.update` accepts only: meetingTypeKey, title, meetingDate,
 *   startTime, endTime, venue, agenda, minutes, resolutions, quorumRequired,
 *   conductedBy, linkedDocumentIds, statusKey. Anything else is ignored, so the
 *   forms below offer exactly that surface.
 * - The four statuses are SCHEDULED | COMPLETED | CANCELLED | POSTPONED. The
 *   service validates the value but does NOT constrain the sequence, so the
 *   transitions mirrored here are the milestone ones:
 *   SCHEDULED → COMPLETED | POSTPONED | CANCELLED, and POSTPONED → SCHEDULED |
 *   CANCELLED. COMPLETED and CANCELLED are terminal in that flow.
 * - `meetings.attendance.mark` needs no clientRequestId. It returns
 *   `{attendance, quorumPresent}` and it SETS the meeting's quorumPresent to the
 *   number of rows marked present in THAT call — it does not accumulate. The UI
 *   therefore always submits the whole attendance sheet, not just the changed
 *   row, so the stored quorum matches what the sheet shows.
 * - `meetings.get` resolves linkedDocumentIds into `linkedDocuments`; those live
 *   in the Documents module (SRS §8), so this page displays them rather than
 *   owning a second store.
 *
 * No optimistic UI (SRS §23): every write reloads the meeting from the server. */

import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { PermissionGate } from '@/app/PermissionGate';
import { LookupSelect } from '@/components/data/LookupSelect';
import { DataTable, type Column } from '@/components/data/DataTable';
import { useMeeting } from '../hooks/useMeetings';
import { useMeetingTypeOptions, useAttendeeTypeOptions } from '../hooks/useMeetingLookups';
import { canMarkAttendance, isPresentFlag, type AttendanceRowInput } from '@/services/meetingService';
import { required, validate, type FormErrors } from '@/lib/validation';
import { formatDate } from '@/lib/dates';
import { formatEnumKey } from '@/lib/format';
import type { MeetingAttendance } from '@/types/domain';

interface DetailsFormState {
  meetingTypeKey: string;
  title: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  agenda: string;
  quorumRequired: string;
  conductedBy: string;
}

interface RecordFormState {
  minutes: string;
  resolutions: string;
  linkedDocumentIds: string;
}

const EMPTY_DETAILS: DetailsFormState = {
  meetingTypeKey: '',
  title: '',
  meetingDate: '',
  startTime: '',
  endTime: '',
  venue: '',
  agenda: '',
  quorumRequired: '',
  conductedBy: '',
};

const EMPTY_RECORD: RecordFormState = {
  minutes: '',
  resolutions: '',
  linkedDocumentIds: '',
};

/* ── Attendance draft row ───────────────────────────────────────────────── */

interface DraftRow {
  /** Stable identity for React keys. Server rows use meetingAttendanceId; new
   * rows get a local key. */
  key: string;
  meetingAttendanceId?: string;
  attendeeType: string;
  attendeeId: string;
  attendeeName: string;
  flatId: string;
  roleInMeeting: string;
  isPresent: boolean;
  remarks: string;
}

let draftSeq = 0;
function nextKey(): string {
  draftSeq += 1;
  return `draft-${draftSeq}`;
}

function toDraft(row: MeetingAttendance): DraftRow {
  return {
    key: row.meetingAttendanceId,
    meetingAttendanceId: row.meetingAttendanceId,
    attendeeType: row.attendeeType,
    attendeeId: row.attendeeId ?? '',
    attendeeName: row.attendeeName ?? '',
    flatId: row.flatId ?? '',
    roleInMeeting: row.roleInMeeting ?? '',
    isPresent: isPresentFlag(row.isPresent),
    remarks: row.remarks ?? '',
  };
}

function emptyDraft(attendeeType: string): DraftRow {
  return {
    key: nextKey(),
    attendeeType,
    attendeeId: '',
    attendeeName: '',
    flatId: '',
    roleInMeeting: '',
    isPresent: true,
    remarks: '',
  };
}

/** The service needs either an id or a name; a row with neither is dropped
 * rather than sent to earn a VALIDATION_ERROR for the whole batch. */
function toRowInput(row: DraftRow): AttendanceRowInput {
  return {
    attendeeType: row.attendeeType,
    attendeeId: row.attendeeId.trim() || undefined,
    attendeeName: row.attendeeName.trim() || undefined,
    flatId: row.flatId.trim() || undefined,
    roleInMeeting: row.roleInMeeting.trim() || undefined,
    isPresent: row.isPresent,
    remarks: row.remarks.trim() || undefined,
  };
}

function isRowComplete(row: DraftRow): boolean {
  return Boolean(row.attendeeType && (row.attendeeId.trim() || row.attendeeName.trim()));
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function MeetingDetailPage() {
  const navigate = useNavigate();
  const { meetingId } = useParams<{ meetingId: string }>();

  const types = useMeetingTypeOptions();
  const attendeeTypes = useAttendeeTypeOptions();

  const { meeting, attendance, loading, error, busy, reload, update, markAttendance } =
    useMeeting(meetingId);

  const [editingDetails, setEditingDetails] = useState(false);
  const [editingRecord, setEditingRecord] = useState(false);
  const [statusTarget, setStatusTarget] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);

  const [details, setDetails] = useState<DetailsFormState>(EMPTY_DETAILS);
  const [record, setRecord] = useState<RecordFormState>(EMPTY_RECORD);
  const [detailsErrors, setDetailsErrors] = useState<FormErrors>({});

  const [rows, setRows] = useState<DraftRow[]>([]);
  const [rowsDirty, setRowsDirty] = useState(false);
  const [rowsMessage, setRowsMessage] = useState<string | null>(null);

  /* Hydrate the details form whenever the meeting changes and no edit is open,
   * so an abandoned edit cannot leave stale text behind. */
  useEffect(() => {
    if (meeting && !editingDetails) {
      setDetails({
        meetingTypeKey: meeting.meetingTypeKey ?? '',
        title: meeting.title ?? '',
        meetingDate: meeting.meetingDate ?? '',
        startTime: meeting.startTime ?? '',
        endTime: meeting.endTime ?? '',
        venue: meeting.venue ?? '',
        agenda: meeting.agenda ?? '',
        quorumRequired: meeting.quorumRequired ?? '',
        conductedBy: meeting.conductedBy ?? '',
      });
    }
  }, [meeting, editingDetails]);

  useEffect(() => {
    if (meeting && !editingRecord) {
      setRecord({
        minutes: meeting.minutes ?? '',
        resolutions: meeting.resolutions ?? '',
        linkedDocumentIds: meeting.linkedDocumentIds ?? '',
      });
    }
  }, [meeting, editingRecord]);

  /* Rebuild the attendance draft from the server whenever the sheet changes
   * underneath us — unless the user has unsaved row edits, which rebuilding
   * would silently throw away. */
  useEffect(() => {
    if (!rowsDirty) setRows(attendance.map(toDraft));
  }, [attendance, rowsDirty]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner />
      </div>
    );
  }

  if (error && !meeting) {
    return (
      <div>
        <PageHeader title="Meeting" />
        <ErrorState message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div>
        <PageHeader title="Meeting" />
        <Alert variant="warning">This meeting could not be found.</Alert>
      </div>
    );
  }

  const typeLabel =
    meeting.meetingTypeName ||
    types.options.find((option) => option.value === meeting.meetingTypeKey)?.label ||
    meeting.meetingTypeKey ||
    '—';

  const attendeeTypeLabel = (value: string) =>
    attendeeTypes.options.find((option) => option.value === value)?.label ?? value;

  /* Cancelled and postponed meetings are not held, so their sheet is frozen. */
  const attendanceAllowed = canMarkAttendance(meeting.statusKey);

  /* Counted client-side purely as a preview of what the server will store; the
   * stored value is the one `meetings.attendance.mark` returns. */
  const presentCount = rows.filter((row) => row.isPresent).length;

  /* The service validates the status value but does not police the sequence;
   * these are the milestone transitions we choose to offer. */
  const reachableStatuses: string[] = (() => {
    switch (meeting.statusKey) {
      case 'SCHEDULED':
        return ['COMPLETED', 'POSTPONED', 'CANCELLED'];
      case 'POSTPONED':
        return ['SCHEDULED', 'CANCELLED'];
      default:
        return [];
    }
  })();

  /* The status the modal opens on; null means the user has not chosen one yet.
   * (`noUncheckedIndexedAccess` is on, hence the explicit fallback.) */
  const defaultStatus: string | null = reachableStatuses.length > 0 ? reachableStatuses[0]! : null;

  /* ── Handlers ── */

  const handleSaveDetails = async (e: FormEvent) => {
    e.preventDefault();

    const nextErrors: FormErrors = {};
    const titleError = validate(details.title.trim(), [required('Title is required')]);
    if (titleError) nextErrors.title = titleError;
    const dateError = validate(details.meetingDate, [required('Meeting date is required')]);
    if (dateError) nextErrors.meetingDate = dateError;
    const typeError = validate(details.meetingTypeKey, [required('Meeting type is required')]);
    if (typeError) nextErrors.meetingTypeKey = typeError;
    if (details.startTime && details.endTime && details.endTime < details.startTime) {
      nextErrors.endTime = 'The end time cannot be before the start time.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setDetailsErrors(nextErrors);
      return;
    }

    await update({
      meetingTypeKey: details.meetingTypeKey,
      title: details.title.trim(),
      meetingDate: details.meetingDate,
      startTime: details.startTime,
      endTime: details.endTime,
      venue: details.venue.trim(),
      agenda: details.agenda.trim(),
      quorumRequired: details.quorumRequired.trim(),
      conductedBy: details.conductedBy.trim(),
    });
    setDetailsErrors({});
    setEditingDetails(false);
  };

  const handleSaveRecord = async (e: FormEvent) => {
    e.preventDefault();
    await update({
      minutes: record.minutes.trim(),
      resolutions: record.resolutions.trim(),
      linkedDocumentIds: record.linkedDocumentIds.trim(),
    });
    setEditingRecord(false);
  };

  const handleStatusChange = async () => {
    if (!statusTarget) return;
    await update({ statusKey: statusTarget });
    setStatusOpen(false);
    setStatusTarget(null);
  };

  const handleSaveAttendance = async () => {
    const usable = rows.filter(isRowComplete);
    if (usable.length === 0) {
      setRowsMessage('Add at least one attendee with a name or an id before saving.');
      return;
    }
    /* Submit the WHOLE sheet: attendance.mark overwrites quorumPresent with the
     * present-count of the rows it receives, so sending a single row would
     * silently reset the stored quorum. */
    await markAttendance(usable.map(toRowInput));
    setRowsDirty(false);
    setRowsMessage(null);
  };

  const setRow = <K extends keyof DraftRow>(key: string, field: K, value: DraftRow[K]) => {
    setRowsDirty(true);
    setRowsMessage(null);
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  };

  /* ── Tab bodies ── */

  const overview = (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      {error ? <Alert variant="danger">{error}</Alert> : null}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <PermissionGate permission="meetings.write">
          <Button
            variant="ghost"
            icon={<Icon name="edit" size={16} />}
            onClick={() => setEditingDetails(true)}
            disabled={busy}
          >
            Edit details
          </Button>
        </PermissionGate>
      </div>

      <DescriptionList
        columns={2}
        items={[
          { label: 'Number', value: meeting.meetingNumber },
          { label: 'Status', value: <StatusBadge statusKey={meeting.statusKey} /> },
          { label: 'Type', value: typeLabel },
          { label: 'Date', value: formatDate(meeting.meetingDate) },
          {
            label: 'Time',
            value:
              meeting.startTime || meeting.endTime
                ? `${meeting.startTime || '—'}${meeting.endTime ? ` – ${meeting.endTime}` : ''}`
                : '—',
          },
          { label: 'Venue', value: meeting.venue || '—' },
          { label: 'Conducted by', value: meeting.conductedBy || '—' },
          { label: 'Quorum required', value: meeting.quorumRequired || '—' },
          { label: 'Quorum present', value: meeting.quorumPresent || '—' },
          { label: 'Agenda', value: meeting.agenda || '—', span: 2 },
        ]}
      />

      <Card>
        <CardHeader
          title="Minutes"
          action={
            <PermissionGate permission="meetings.write">
              <Button
                variant="ghost"
                icon={<Icon name="edit" size={16} />}
                onClick={() => setEditingRecord(true)}
                disabled={busy}
              >
                Record
              </Button>
            </PermissionGate>
          }
        />
        <CardBody>
          {meeting.minutes ? (
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{meeting.minutes}</p>
          ) : (
            <EmptyState
              title="No minutes recorded"
              description="Minutes are usually written up once the meeting has taken place."
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Resolutions" />
        <CardBody>
          {meeting.resolutions ? (
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{meeting.resolutions}</p>
          ) : (
            <EmptyState title="No resolutions recorded" />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Linked documents" />
        <CardBody>
          {meeting.linkedDocuments && meeting.linkedDocuments.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 'var(--space-5)' }}>
              {meeting.linkedDocuments.map((doc) => (
                <li key={doc.fileId}>
                  {doc.name || doc.fileId}
                  {doc.mimeType ? (
                    <span style={{ color: 'var(--color-text-muted)' }}> — {doc.mimeType}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            /* SRS §8: meeting documents live in the Documents module, so this
             * panel is genuinely empty rather than a second store. */
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              No documents are linked to this meeting. Upload them in the Documents module, then
              record their ids here.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );

  const attendanceColumns: Column<DraftRow>[] = [
    {
      key: 'attendee',
      header: 'Attendee',
      render: (row) =>
        row.attendeeName || row.attendeeId ? (
          <span>{row.attendeeName || row.attendeeId}</span>
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>Not named</span>
        ),
    },
    {
      key: 'attendeeType',
      header: 'Type',
      render: (row) => attendeeTypeLabel(row.attendeeType),
    },
    {
      key: 'roleInMeeting',
      header: 'Role',
      render: (row) => row.roleInMeeting || '—',
    },
    {
      key: 'isPresent',
      header: 'Present',
      align: 'center',
      render: (row) => (
        <Checkbox
          label=""
          aria-label={`Mark ${row.attendeeName || row.attendeeId || 'attendee'} present`}
          checked={row.isPresent}
          disabled={!attendanceAllowed}
          onChange={(e) => setRow(row.key, 'isPresent', e.target.checked)}
        />
      ),
    },
    {
      key: 'remarks',
      header: 'Remarks',
      render: (row) => (
        <Input
          value={row.remarks}
          aria-label={`Remarks for ${row.attendeeName || row.attendeeId || 'attendee'}`}
          disabled={!attendanceAllowed}
          onChange={(e) => setRow(row.key, 'remarks', e.target.value)}
        />
      ),
    },
  ];

  const attendanceTab = (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      {!attendanceAllowed ? (
        <Alert variant="warning">
          Attendance can only be recorded for a scheduled or completed meeting. This meeting is{' '}
          {formatEnumKey(meeting.statusKey)}.
        </Alert>
      ) : null}

      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
        {rows.length === 0
          ? 'No attendance has been recorded yet.'
          : `${rows.length} attendee${rows.length === 1 ? '' : 's'} on the sheet · ${presentCount} marked present` +
            (meeting.quorumRequired ? ` · quorum required ${meeting.quorumRequired}` : '')}
      </p>

      {rowsMessage ? <Alert variant="warning">{rowsMessage}</Alert> : null}

      {rowsDirty ? (
        <Alert variant="info">
          These changes are not saved yet. Saving replaces the meeting&apos;s stored quorum with the
          number of attendees you have marked present.
        </Alert>
      ) : null}

      {rows.length > 0 ? (
        <div className="hs-only-desktop">
          <DataTable
            columns={attendanceColumns}
            data={rows}
            getRowId={(row) => row.key}
            emptyTitle="No attendance recorded"
          />
        </div>
      ) : null}

      {/* Mobile: a stacked card per attendee rather than a five-column table. */}
      {rows.length > 0 ? (
        <div className="hs-only-mobile" style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {rows.map((row) => (
            <div key={row.key} className="hs-card" style={{ padding: 'var(--space-3)' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}
              >
                <strong>{row.attendeeName || row.attendeeId || 'Unnamed attendee'}</strong>
                <Checkbox
                  label="Present"
                  checked={row.isPresent}
                  disabled={!attendanceAllowed}
                  onChange={(e) => setRow(row.key, 'isPresent', e.target.checked)}
                />
              </div>
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-muted)',
                  marginTop: 'var(--space-1)',
                }}
              >
                {attendeeTypeLabel(row.attendeeType)}
                {row.roleInMeeting ? ` · ${row.roleInMeeting}` : ''}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {attendanceAllowed ? (
        <PermissionGate permission="meetings.write">
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <Button
              variant="ghost"
              icon={<Icon name="plus" size={16} />}
              onClick={() =>
                setRows((prev) => [...prev, emptyDraft(attendeeTypes.options[0]?.value ?? '')])
              }
              disabled={busy}
            >
              Add attendee
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setRows(attendance.map(toDraft));
                setRowsDirty(false);
                setRowsMessage(null);
              }}
              disabled={busy || !rowsDirty}
            >
              Discard changes
            </Button>
            <Button onClick={() => void handleSaveAttendance()} loading={busy} disabled={!rowsDirty}>
              Save attendance
            </Button>
          </div>
        </PermissionGate>
      ) : null}

      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
        Rows without a name or an id are not sent to the server.
      </p>
    </div>
  );

  const history = (
    <DescriptionList
      columns={2}
      items={[
        { label: 'Meeting number', value: meeting.meetingNumber },
        { label: 'Status', value: <StatusBadge statusKey={meeting.statusKey} /> },
        { label: 'Held on', value: formatDate(meeting.meetingDate) },
        { label: 'Venue', value: meeting.venue || '—' },
        { label: 'Conducted by', value: meeting.conductedBy || '—' },
        { label: 'Quorum required', value: meeting.quorumRequired || '—' },
        { label: 'Quorum present', value: meeting.quorumPresent || '—' },
        { label: 'Attendance rows', value: String(attendance.length) },
        { label: 'Minutes recorded', value: meeting.minutes ? 'Yes' : 'No' },
        { label: 'Resolutions recorded', value: meeting.resolutions ? 'Yes' : 'No' },
        { label: 'Linked documents', value: String(meeting.linkedDocuments?.length ?? 0) },
      ]}
    />
  );

  /* ── Render ── */

  return (
    <div>
      <PageHeader
        title={meeting.title}
        subtitle={`${meeting.meetingNumber} · ${typeLabel} · ${formatDate(meeting.meetingDate)}`}
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Meetings', route: '/meetings', onClick: () => navigate('/meetings') },
              { label: meeting.meetingNumber },
            ]}
          />
        }
        actions={
          <PermissionGate permission="meetings.write">
            {reachableStatuses.length > 0 ? (
              <Button
                variant="secondary"
                icon={<Icon name="edit" size={16} />}
                onClick={() => {
                  setStatusTarget(defaultStatus);
                  setStatusOpen(true);
                }}
                disabled={busy}
              >
                Change status
              </Button>
            ) : null}
          </PermissionGate>
        }
      />

      <Card>
        <CardBody>
          <Tabs
            tabs={[
              { key: 'overview', label: 'Overview', content: overview },
              {
                key: 'attendance',
                label: `Attendance${attendance.length ? ` (${attendance.length})` : ''}`,
                content: attendanceTab,
              },
              { key: 'history', label: 'History', content: history },
            ]}
          />
        </CardBody>
      </Card>

      {/* ── Edit details ── */}
      <Modal
        open={editingDetails}
        onClose={() => setEditingDetails(false)}
        title="Edit meeting details"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingDetails(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="meeting-details-form" loading={busy}>
              Save changes
            </Button>
          </>
        }
      >
        <form id="meeting-details-form" onSubmit={(e) => void handleSaveDetails(e)} noValidate>
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <FormField label="Meeting type" required error={detailsErrors.meetingTypeKey}>
              <LookupSelect
                options={types.options}
                value={details.meetingTypeKey}
                onChange={(value) => {
                  setDetails((prev) => ({ ...prev, meetingTypeKey: value }));
                  setDetailsErrors((prev) => {
                    const next = { ...prev };
                    delete next.meetingTypeKey;
                    return next;
                  });
                }}
                placeholder="Select type"
                loading={types.loading}
                error={detailsErrors.meetingTypeKey}
              />
            </FormField>

            <FormField label="Title" required error={detailsErrors.title}>
              <Input
                value={details.title}
                onChange={(e) => {
                  setDetails((prev) => ({ ...prev, title: e.target.value }));
                  setDetailsErrors((prev) => {
                    const next = { ...prev };
                    delete next.title;
                    return next;
                  });
                }}
                error={detailsErrors.title}
              />
            </FormField>

            <FormField label="Meeting date" required error={detailsErrors.meetingDate}>
              <Input
                type="date"
                value={details.meetingDate}
                onChange={(e) => {
                  setDetails((prev) => ({ ...prev, meetingDate: e.target.value }));
                  setDetailsErrors((prev) => {
                    const next = { ...prev };
                    delete next.meetingDate;
                    return next;
                  });
                }}
                error={detailsErrors.meetingDate}
              />
            </FormField>

            <div
              className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
              style={{ gap: 'var(--space-4)' }}
            >
              <FormField label="Start time">
                <Input
                  type="time"
                  value={details.startTime}
                  onChange={(e) => setDetails((prev) => ({ ...prev, startTime: e.target.value }))}
                />
              </FormField>
              <FormField label="End time" error={detailsErrors.endTime}>
                <Input
                  type="time"
                  value={details.endTime}
                  onChange={(e) => {
                    setDetails((prev) => ({ ...prev, endTime: e.target.value }));
                    setDetailsErrors((prev) => {
                      const next = { ...prev };
                      delete next.endTime;
                      return next;
                    });
                  }}
                  error={detailsErrors.endTime}
                />
              </FormField>
            </div>

            <FormField label="Venue">
              <Input
                value={details.venue}
                onChange={(e) => setDetails((prev) => ({ ...prev, venue: e.target.value }))}
              />
            </FormField>

            <div
              className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2"
              style={{ gap: 'var(--space-4)' }}
            >
              <FormField label="Conducted by">
                <Input
                  value={details.conductedBy}
                  onChange={(e) =>
                    setDetails((prev) => ({ ...prev, conductedBy: e.target.value }))
                  }
                  placeholder="e.g. Secretary"
                />
              </FormField>
              <FormField label="Quorum required">
                <Input
                  type="number"
                  min={0}
                  value={details.quorumRequired}
                  onChange={(e) =>
                    setDetails((prev) => ({ ...prev, quorumRequired: e.target.value }))
                  }
                />
              </FormField>
            </div>

            <FormField label="Agenda">
              <Textarea
                value={details.agenda}
                onChange={(e) => setDetails((prev) => ({ ...prev, agenda: e.target.value }))}
                rows={5}
              />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* ── Record minutes / resolutions ── */}
      <Modal
        open={editingRecord}
        onClose={() => setEditingRecord(false)}
        title="Record minutes and resolutions"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingRecord(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="meeting-record-form" loading={busy}>
              Save
            </Button>
          </>
        }
      >
        <form id="meeting-record-form" onSubmit={(e) => void handleSaveRecord(e)} noValidate>
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <FormField label="Minutes">
              <Textarea
                value={record.minutes}
                onChange={(e) => setRecord((prev) => ({ ...prev, minutes: e.target.value }))}
                rows={8}
                placeholder="What was discussed and decided"
              />
            </FormField>

            <FormField label="Resolutions">
              <Textarea
                value={record.resolutions}
                onChange={(e) => setRecord((prev) => ({ ...prev, resolutions: e.target.value }))}
                rows={5}
                placeholder="Resolutions passed, one per line"
              />
            </FormField>

            <FormField
              label="Linked document ids"
              hint="Comma-separated ids of documents already uploaded to the Documents module."
            >
              <Input
                value={record.linkedDocumentIds}
                onChange={(e) =>
                  setRecord((prev) => ({ ...prev, linkedDocumentIds: e.target.value }))
                }
                placeholder="e.g. DOC-0007, DOC-0008"
              />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* ── Change status ── */}
      <Modal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="Change meeting status"
        footer={
          <>
            <Button variant="ghost" onClick={() => setStatusOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void handleStatusChange()} loading={busy}>
              Change status
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
            This meeting is currently <StatusBadge statusKey={meeting.statusKey} />.
          </p>

          <FormField label="New status" required>
            <Select
              value={statusTarget ?? ''}
              options={reachableStatuses.map((key) => ({
                value: key,
                label: formatEnumKey(key),
              }))}
              onChange={(e) => setStatusTarget(e.target.value)}
            />
          </FormField>

          {/* The status change is applied through `meetings.update`; a free-text
           * note would silently vanish, so it is not offered here. Minutes are
           * the place for that. */}

          {statusTarget === 'CANCELLED' || statusTarget === 'POSTPONED' ? (
            <Alert variant="info">
              Attendance stays on the sheet but can no longer be edited once the meeting is{' '}
              {formatEnumKey(statusTarget).toLowerCase()}.
            </Alert>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
