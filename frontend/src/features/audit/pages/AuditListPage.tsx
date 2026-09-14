/* AuditListPage.tsx — FE-14: Audit trail list with filters */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/data/DataTable';
import { PaginationBar } from '@/components/data/PaginationBar';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAuditList } from '../hooks/useAudit';
import type { AuditEntry } from '@/types/domain';

const ENTITY_OPTIONS = [
  { value: '', label: 'All entities' },
  { value: 'Payment', label: 'Payments' },
  { value: 'Demand', label: 'Demands' },
  { value: 'Member', label: 'Members' },
  { value: 'Flat', label: 'Flats' },
  { value: 'Expense', label: 'Expenses' },
  { value: 'User', label: 'Users' },
  { value: 'Role', label: 'Roles' },
  { value: 'Complaint', label: 'Complaints' },
];

const columns: Column<AuditEntry>[] = [
  { key: 'auditId', header: 'ID', render: (row) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{row.auditId}</span> },
  { key: 'entity', header: 'Entity' },
  { key: 'entityId', header: 'Record ID', render: (row) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{row.entityId}</span> },
  { key: 'action', header: 'Action' },
  { key: 'actorName', header: 'Actor', render: (row) => row.actorName ?? row.actorUserId },
  { key: 'timestamp', header: 'When', render: (row) => new Date(row.timestamp).toLocaleString() },
];

export default function AuditListPage() {
  const navigate = useNavigate();
  const { entries, page, loading, error, fetchEntries } = useAuditList();
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actorUserId, setActorUserId] = useState('');

  const load = (p = 1) => {
    fetchEntries({
      page: p,
      pageSize: 25,
      entity: entity || undefined,
      action: action || undefined,
      from: from || undefined,
      to: to || undefined,
      actorUserId: actorUserId || undefined,
    });
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilter = () => load(1);

  return (
    <div>
      <PageHeader title="Audit Trail" subtitle="Track who changed what and when" />

      <Card style={{ marginBottom: 'var(--space-4)' }}>
        <CardBody>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 150 }}>
              <FormField label="Entity">
                <Select options={ENTITY_OPTIONS} value={entity} onChange={(e) => setEntity(e.target.value)} />
              </FormField>
            </div>
            <div style={{ minWidth: 150 }}>
              <FormField label="Action">
                <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. PAYMENT_RECORDED" />
              </FormField>
            </div>
            <div style={{ minWidth: 140 }}>
              <FormField label="From">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </FormField>
            </div>
            <div style={{ minWidth: 140 }}>
              <FormField label="To">
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </FormField>
            </div>
            <div style={{ minWidth: 150 }}>
              <FormField label="Actor User ID">
                <Input value={actorUserId} onChange={(e) => setActorUserId(e.target.value)} />
              </FormField>
            </div>
            <button type="button" className="hs-btn hs-btn--primary hs-btn--md" onClick={handleFilter}>
              Filter
            </button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          {error && <div className="hs-alert hs-alert--danger" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}
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
              onPageChange={(p) => load(p)}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
