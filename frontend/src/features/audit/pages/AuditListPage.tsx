/* AuditListPage.tsx — FE-14: Audit trail list with filters */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/data/DataTable';
import { PaginationBar } from '@/components/data/PaginationBar';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Alert } from '@/components/ui/Alert';
import { useAuditList } from '../hooks/useAudit';
import { formatDateTime } from '@/lib/dates';
import type { AuditEntry } from '@/types/domain';

const mono = { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' } as const;

/** `Audit_Log.ts` is the timestamp column — there is no `timestamp` column
 *  (`Schema.gs:278`). Rendering `row.timestamp` produced an empty column. */
const columns: Column<AuditEntry>[] = [
  { key: 'auditId', header: 'ID', render: (row) => <span style={mono}>{row.auditId}</span> },
  { key: 'ts', header: 'When', render: (row) => (row.ts ? formatDateTime(row.ts) : '—') },
  { key: 'entity', header: 'Entity' },
  {
    key: 'entityId',
    header: 'Record ID',
    render: (row) => <span style={mono}>{row.entityId || '—'}</span>,
  },
  { key: 'action', header: 'Action' },
  { key: 'actor', header: 'Actor', render: (row) => row.actorName || row.actorUserId || '—' },
  { key: 'result', header: 'Result', render: (row) => <StatusBadge statusKey={row.result} /> },
];

interface Filters {
  entity: string;
  action: string;
  from: string;
  to: string;
  actorUserId: string;
}

const EMPTY_FILTERS: Filters = { entity: '', action: '', from: '', to: '', actorUserId: '' };

export default function AuditListPage() {
  const navigate = useNavigate();
  const { entries, page, loading, error, fetchEntries } = useAuditList();

  /* `draft` holds what the user is typing; `applied` is what the last search
   * used. Splitting them keeps the query from firing on every keystroke while
   * still reloading when the filter is actually submitted. */
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [pageNo, setPageNo] = useState(1);

  useEffect(() => {
    fetchEntries({
      page: pageNo,
      pageSize: 25,
      entity: applied.entity || undefined,
      action: applied.action || undefined,
      from: applied.from || undefined,
      to: applied.to || undefined,
      actorUserId: applied.actorUserId || undefined,
    });
  }, [fetchEntries, pageNo, applied]);

  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((prev) => ({ ...prev, [key]: e.target.value }));

  const handleFilter = () => {
    setPageNo(1);
    setApplied(draft);
  };

  const handleReset = () => {
    setDraft(EMPTY_FILTERS);
    setPageNo(1);
    setApplied(EMPTY_FILTERS);
  };

  return (
    <div>
      <PageHeader title="Audit Trail" subtitle="Track who changed what and when" />

      <Card style={{ marginBottom: 'var(--space-4)' }}>
        <CardBody>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 150 }}>
              <FormField
                label="Entity"
                hint="Source sheet, e.g. Payments"
              >
                {/* Free text, not a dropdown: `Audit_Log.entity` stores whatever
                 *  label the writer passed (sheet names such as `Payments`, plus
                 *  `SYSTEM` and `Reports`), and the filter is an exact match.
                 *  A hardcoded list would silently hide the labels it omits. */}
                <Input
                  value={draft.entity}
                  onChange={set('entity')}
                  placeholder="e.g. Payments"
                />
              </FormField>
            </div>
            <div style={{ minWidth: 150 }}>
              <FormField label="Action">
                <Input
                  value={draft.action}
                  onChange={set('action')}
                  placeholder="e.g. PAYMENT_RECORDED"
                />
              </FormField>
            </div>
            <div style={{ minWidth: 140 }}>
              <FormField label="From">
                <Input type="date" value={draft.from} onChange={set('from')} />
              </FormField>
            </div>
            <div style={{ minWidth: 140 }}>
              <FormField label="To">
                <Input type="date" value={draft.to} onChange={set('to')} />
              </FormField>
            </div>
            <div style={{ minWidth: 150 }}>
              <FormField label="Actor User ID">
                <Input value={draft.actorUserId} onChange={set('actorUserId')} />
              </FormField>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button onClick={handleFilter}>Filter</Button>
              <Button variant="ghost" onClick={handleReset}>
                Reset
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          {error && <Alert variant="danger">{error}</Alert>}
          <DataTable
            columns={columns}
            data={entries}
            loading={loading}
            emptyTitle="No audit entries found"
            emptyDescription="No audit records match your filters."
            onRowClick={(row) => navigate(`/settings/audit/${row.auditId}`)}
            getRowId={(row) => row.auditId}
          />
          {page.totalPages > 1 && (
            <PaginationBar
              page={page}
              onPageChange={(p) => setPageNo(p)}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
