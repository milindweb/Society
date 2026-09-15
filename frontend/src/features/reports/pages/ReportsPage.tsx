/* ReportsPage.tsx — FE-12
 * design.md §6 list-page pattern adapted: this is a CATALOG, not a table, so it
 * renders a grid of report cards rather than DataTable + Pagination.
 *
 * SRS §14: the six standard society reports. Every report is defined
 * server-side in `REPORT_CATALOG` (`ReportService.gs:279`) and served by
 * `reports.catalog`. Nothing about a report — its title, which filters it
 * accepts, which columns it returns — is hardcoded here (SRS §15). If the
 * backend adds a seventh report it appears on this page automatically.
 *
 * Permissions: the catalog needs `reports.read`. Export needs `reports.export`,
 * a SEPARATE key, so the export affordance is gated on that and not on read. */

import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { PermissionGate } from '@/app/PermissionGate';
import { useReportCatalog } from '../hooks/useReports';
import type { ReportDefinition } from '@/types/domain';

/** Icon per report family. Keyed by the backend's reportKey.
 *
 * This is presentation only — a report with no entry here still renders, using
 * the generic reports icon, so a new backend report is never hidden by a
 * missing icon mapping. */
const REPORT_ICONS: Record<string, IconName> = {
  'demand-summary': 'maintenance',
  'payment-register': 'payments',
  'outstanding': 'alert',
  'complaint-summary': 'complaints',
  'visitor-log': 'visitors',
  'expense-summary': 'expenses',
};

/** One-line description per report family, since the catalog serves only a
 *  title. Falls back to the declared filter list, which is always present. */
const REPORT_BLURBS: Record<string, string> = {
  'demand-summary': 'Charges raised per flat, with collected and outstanding amounts.',
  'payment-register': 'Every payment received, with receipt, mode and reference.',
  'outstanding': 'Flats with a balance still due, including overdue positions.',
  'complaint-summary': 'Complaints raised in a period, with priority and resolution.',
  'visitor-log': 'Gate entries and exits for a period or a specific flat.',
  'expense-summary': 'Society expenses recorded in a period or category.',
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const { definitions, loading, error, reload } = useReportCatalog();

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Generate, view and export the standard society reports"
        actions={
          <Button variant="secondary" onClick={reload} disabled={loading}>
            <Icon name="refresh" size={16} />
            Refresh
          </Button>
        }
      />

      {error && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}

      {loading && !error && (
        <div
          style={{
            display: 'grid',
            gap: 'var(--space-4)',
            gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))',
          }}
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardBody>
                <Skeleton height={18} width="60%" />
                <div style={{ height: 'var(--space-3)' }} />
                <Skeleton height={14} width="90%" />
                <div style={{ height: 'var(--space-2)' }} />
                <Skeleton height={14} width="75%" />
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && definitions.length === 0 && (
        <EmptyState
          title="No reports available"
          description="The report catalog is empty. Contact an administrator if this is unexpected."
          icon={<Icon name="reports" size={32} />}
        />
      )}

      {!loading && !error && definitions.length > 0 && (
        <div
          style={{
            display: 'grid',
            gap: 'var(--space-4)',
            gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))',
          }}
        >
          {definitions.map((def) => (
            <ReportCard
              key={def.key}
              definition={def}
              onOpen={() => navigate(`/reports/${encodeURIComponent(def.key)}`)}
            />
          ))}
        </div>
      )}

      <PermissionGate permission="reports.export">
        <p
          style={{
            marginTop: 'var(--space-5)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-xs)',
          }}
        >
          Exports are written to Google Drive as CSV and opened from the report view.
        </p>
      </PermissionGate>
    </div>
  );
}

function ReportCard({
  definition,
  onOpen,
}: {
  definition: ReportDefinition;
  onOpen: () => void;
}) {
  const icon = REPORT_ICONS[definition.key] ?? 'reports';
  const blurb = REPORT_BLURBS[definition.key];

  return (
    <Card>
      <CardBody>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-2)',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'grid',
              placeItems: 'center',
              width: '2.25rem',
              height: '2.25rem',
              flexShrink: 0,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface-sunken)',
              color: 'var(--color-brand)',
            }}
          >
            <Icon name={icon} size={18} />
          </span>
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--color-text)',
            }}
          >
            {definition.title}
          </h2>
        </div>

        <p
          style={{
            margin: '0 0 var(--space-3)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
            minHeight: '2.5rem',
          }}
        >
          {blurb ?? `Filters: ${definition.filters.join(', ') || 'none'}.`}
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <Badge variant="neutral">{definition.columns.length} columns</Badge>
          {definition.filters.length > 0 && (
            <Badge variant="neutral">
              {definition.filters.length} filter{definition.filters.length === 1 ? '' : 's'}
            </Badge>
          )}
        </div>

        <Button variant="primary" onClick={onOpen}>
          Open report
        </Button>
      </CardBody>
    </Card>
  );
}
