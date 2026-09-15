/* ComplaintTimeline.tsx — FE-07
 * SRS §5: "Keep a complete history of who handled the complaint and what
 * corrective action was taken." Complaint_Updates is append-only, so this
 * timeline is the authoritative record of the complaint's life.
 *
 * Rows arrive already sorted ascending by `actionTakenAt` from the server
 * (ComplaintService.get sorts before returning), and the caller renders them in
 * that order so the newest state is always at the bottom. */

import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/dates';
import { formatEnumKey } from '@/lib/format';
import type { ComplaintUpdate } from '@/types/domain';

interface ComplaintTimelineProps {
  updates: ComplaintUpdate[];
}

/** The server stores an id, not a name, for the actor. Show what we have. */
function actorLabel(update: ComplaintUpdate): string {
  const type = update.actionTakenByType ? formatEnumKey(update.actionTakenByType) : '';
  if (type && update.actionTakenById) return `${type} · ${update.actionTakenById}`;
  return update.actionTakenById || type || 'System';
}

export function ComplaintTimeline({ updates }: ComplaintTimelineProps) {
  if (updates.length === 0) {
    return (
      <EmptyState
        title="No updates yet"
        description="Status changes and corrective actions will appear here."
      />
    );
  }

  return (
    <ol className="hs-timeline">
      {updates.map((update) => (
        <li key={update.complaintUpdateId} className="hs-timeline__item">
          <div className="hs-timeline__marker" aria-hidden="true" />
          <div className="hs-timeline__body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <StatusBadge statusKey={update.statusKey} />
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                {formatDateTime(update.actionTakenAt)}
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                {actorLabel(update)}
              </span>
            </div>

            {update.remarks ? (
              <p style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-sm)' }}>
                {update.remarks}
              </p>
            ) : null}

            {update.correctiveAction ? (
              <p
                style={{
                  margin: 'var(--space-2) 0 0',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-muted)',
                }}
              >
                <strong>Corrective action:</strong> {update.correctiveAction}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
