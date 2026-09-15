/* ComplaintDetailPage.tsx — FE-07
 * SRS §5: "Raise Complaint → Assign → Corrective Action → Status → Remarks →
 * Close", and "complaint work status can be updated many times before close".
 *
 * Two server rules drive this screen:
 *  1. Only the statuses legal from the current one may be offered. The map lives
 *     in the backend (ComplaintService.TRANSITIONS) and is mirrored by
 *     `nextStatuses()` — an illegal choice is never rendered, so the user cannot
 *     make a request the server would reject.
 *  2. Resolving requires BOTH a corrective action and resolution remarks.
 *  3. Every transition requires remarks (route validator: requireField('remarks')).
 *
 * The timeline is fed by `complaints.get`, which returns the complaint and its
 * updates together — no second request. */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { FormField } from '@/components/ui/FormField';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { PermissionGate } from '@/app/PermissionGate';
import { ComplaintTimeline } from '../components/ComplaintTimeline';
import { useComplaint } from '../hooks/useComplaints';
import {
  useComplaintCategoryOptions,
  useComplaintPriorityOptions,
  useAssigneeTypeOptions,
} from '../hooks/useComplaintLookups';
import { nextStatuses, requiresResolutionDetail } from '@/services/complaintService';
import { formatDateTime } from '@/lib/dates';
import { formatEnumKey } from '@/lib/format';

export default function ComplaintDetailPage() {
  const { complaintId } = useParams<{ complaintId: string }>();
  const navigate = useNavigate();

  const { complaint, updates, loading, error, busy, reload, transition, assign } =
    useComplaint(complaintId);

  const categories = useComplaintCategoryOptions();
  const priorities = useComplaintPriorityOptions();
  const assigneeTypes = useAssigneeTypeOptions();

  const [transitionTarget, setTransitionTarget] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [touched, setTouched] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignedToType, setAssignedToType] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [assignTouched, setAssignTouched] = useState(false);

  if (loading) return <Skeleton height={320} variant="rect" />;

  if (error && !complaint) {
    return (
      <div>
        <PageHeader title="Complaint" />
        <ErrorState message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  if (!complaint) {
    return (
      <div>
        <PageHeader title="Complaint" />
        <Alert variant="warning">This complaint could not be found.</Alert>
      </div>
    );
  }

  const allowed = nextStatuses(complaint.statusKey);
  const isTerminal = allowed.length === 0;
  const closeTransition = () => {
    setTransitionTarget(null);
    setRemarks('');
    setCorrectiveAction('');
    setTouched(false);
  };

  const submitTransition = async () => {
    if (!transitionTarget) return;
    setTouched(true);

    const needsDetail = requiresResolutionDetail(transitionTarget);
    if (!remarks.trim()) return;
    if (needsDetail && !correctiveAction.trim()) return;

    await transition({
      statusKey: transitionTarget,
      remarks: remarks.trim(),
      correctiveAction: correctiveAction.trim() || undefined,
    });
    closeTransition();
  };

  const submitAssign = async () => {
    setAssignTouched(true);
    if (!assignedToType || !assignedToId.trim()) return;

    await assign({
      assignedToType,
      assignedToId: assignedToId.trim(),
      targetDate: targetDate || undefined,
      remarks: `Assigned to ${assignedToType}`,
    });
    setAssignOpen(false);
    setAssignedToType('');
    setAssignedToId('');
    setTargetDate('');
    setAssignTouched(false);
  };

  const categoryName =
    complaint.categoryName ||
    categories.options.find((option) => option.value === complaint.categoryId)?.label ||
    '—';
  const priorityName =
    complaint.priorityName ||
    priorities.options.find((option) => option.value === complaint.priorityKey)?.label ||
    complaint.priorityKey ||
    '—';

  const overview = (
    <DescriptionList
      columns={2}
      items={[
        { label: 'Number', value: complaint.complaintNumber },
        { label: 'Status', value: <StatusBadge statusKey={complaint.statusKey} /> },
        { label: 'Category', value: categoryName },
        { label: 'Priority', value: priorityName },
        { label: 'Raised', value: formatDateTime(complaint.raisedAt) },
        { label: 'Flat', value: complaint.flatNumber ?? '—' },
        { label: 'Raised by', value: complaint.raisedByName ?? complaint.raisedByMemberId ?? '—' },
        { label: 'Source', value: complaint.source ? formatEnumKey(complaint.source) : '—' },
        {
          label: 'Assigned to',
          value: complaint.assignedToType
            ? `${formatEnumKey(complaint.assignedToType)}${
                complaint.assignedToId ? ` · ${complaint.assignedToId}` : ''
              }`
            : 'Not assigned',
        },
        { label: 'Target date', value: complaint.targetDate || '—' },
        { label: 'Resolved', value: complaint.resolvedAt ? formatDateTime(complaint.resolvedAt) : '—' },
        { label: 'Closed', value: complaint.closedAt ? formatDateTime(complaint.closedAt) : '—' },
        { label: 'Reopened', value: `${Number(complaint.reopenCount) || 0} time(s)` },
        { label: 'Description', value: complaint.description || '—', span: 2 },
        {
          label: 'Corrective action',
          value: complaint.correctiveAction || '—',
          span: 2,
        },
        {
          label: 'Resolution remarks',
          value: complaint.resolutionRemarks || '—',
          span: 2,
        },
      ]}
    />
  );

  return (
    <div>
      <PageHeader
        title={complaint.title}
        subtitle={`${complaint.complaintNumber} · ${categoryName}`}
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Complaints', onClick: () => navigate('/complaints') },
              { label: complaint.complaintNumber },
            ]}
          />
        }
        actions={
          <PermissionGate permission="complaints.write">
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {/* Assign is a transition to ASSIGNED, so it is only legal when the
                  current status allows it (OPEN / IN_PROGRESS / REOPENED). */}
              {allowed.includes('ASSIGNED') ? (
                <Button variant="secondary" onClick={() => setAssignOpen(true)} disabled={busy}>
                  Assign
                </Button>
              ) : null}
              {/* Every other legal next status gets its own action. */}
              {allowed
                .filter((status) => status !== 'ASSIGNED')
                .map((status) => (
                  <Button
                    key={status}
                    variant={status === 'CLOSED' || status === 'CANCELLED' ? 'ghost' : 'primary'}
                    onClick={() => setTransitionTarget(status)}
                    disabled={busy}
                  >
                    {formatEnumKey(status)}
                  </Button>
                ))}
            </div>
          </PermissionGate>
        }
      />

      {isTerminal ? (
        <Alert variant="info">
          This complaint is <strong>{formatEnumKey(complaint.statusKey)}</strong> and has no further
          transitions.
        </Alert>
      ) : null}

      {error ? (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Alert variant="danger">{error}</Alert>
        </div>
      ) : null}

      <div style={{ marginTop: 'var(--space-4)' }}>
        <Tabs
          defaultKey="overview"
          tabs={[
            { key: 'overview', label: 'Overview', content: <Card><CardBody>{overview}</CardBody></Card> },
            {
              key: 'history',
              label: `History (${updates.length})`,
              content: (
                <Card>
                  <CardHeader title="Complaint history" />
                  <CardBody>
                    <ComplaintTimeline updates={updates} />
                  </CardBody>
                </Card>
              ),
            },
          ]}
        />
      </div>

      {/* ── Status transition ── */}
      <Modal
        open={transitionTarget !== null}
        onClose={closeTransition}
        title={transitionTarget ? `Mark as ${formatEnumKey(transitionTarget)}` : 'Update status'}
        footer={
          <>
            <Button variant="ghost" onClick={closeTransition} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void submitTransition()} loading={busy}>
              Save
            </Button>
          </>
        }
      >
        {transitionTarget && requiresResolutionDetail(transitionTarget) ? (
          <Alert variant="info">
            Resolving needs both a corrective action and resolution remarks — the server rejects the
            update without them.
          </Alert>
        ) : null}

        {transitionTarget && requiresResolutionDetail(transitionTarget) ? (
          <FormField
            label="Corrective action"
            required
            error={touched && !correctiveAction.trim() ? 'Corrective action is required' : undefined}
          >
            <Textarea
              value={correctiveAction}
              onChange={(e) => setCorrectiveAction(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="What was done to fix the issue?"
            />
          </FormField>
        ) : null}

        <FormField
          label="Remarks"
          required
          error={touched && !remarks.trim() ? 'Remarks are required' : undefined}
        >
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Notes for the complaint history"
          />
        </FormField>
      </Modal>

      {/* ── Assignment ── */}
      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign complaint"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssignOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void submitAssign()} loading={busy}>
              Assign
            </Button>
          </>
        }
      >
        <FormField
          label="Assign to"
          required
          error={assignTouched && !assignedToType ? 'Choose a target type' : undefined}
          hint="Committee member, society employee or external vendor"
        >
          <Select
            options={assigneeTypes.options}
            value={assignedToType}
            onChange={(e) => setAssignedToType(e.target.value)}
            placeholder={assigneeTypes.loading ? 'Loading...' : 'Select a type'}
            disabled={assigneeTypes.loading}
          />
        </FormField>

        <FormField
          label="Assignee id"
          required
          error={assignTouched && !assignedToId.trim() ? 'Assignee is required' : undefined}
          hint="The member, employee or vendor record this complaint goes to"
        >
          <Input
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
            placeholder="Assignee reference"
          />
        </FormField>

        <FormField label="Target date">
          <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </FormField>
      </Modal>
    </div>
  );
}
