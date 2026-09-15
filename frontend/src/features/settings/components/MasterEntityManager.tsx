/* MasterEntityManager.tsx — FE-13 the generic master-data manager
 *
 * One component manages every one of the 24 master entities declared in
 * `SchemaMeta.MASTER_ENTITIES`. It reads the entity's descriptor from
 * `config.entityMeta` and builds the table, the form and the save calls from it
 * — so adding an entity on the backend needs no frontend work (SRS §15).
 *
 * Behavioural rules taken from the backend contract:
 * - The server returns ACTIVE rows only unless `includeInactive` is passed, so
 *   the "Show deactivated" toggle is a real server query and resets paging.
 * - `status` is the column name for master entities (not `statusKey`), and
 *   `config.entity.setStatus` accepts only ACTIVE / INACTIVE.
 * - Deactivating something still in use returns DEPENDENCY_EXISTS. That is a
 *   legitimate refusal, so it surfaces as a warning toast naming the blocker —
 *   handled in `useEntityMutations`, not here.
 * - Writes are never optimistically applied: every success re-fetches the rows.
 *
 * Write access is `config.write`. The descriptor carries the permission keys, so
 * this component does not hardcode them; it is told what the user may do
 * (`canWrite`) and renders read-only when false rather than letting the user
 * fill in a form that could only be rejected with FORBIDDEN. */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Toolbar } from '@/components/ui/Toolbar';
import { DataTable, type Column } from '@/components/data/DataTable';
import { PaginationBar } from '@/components/data/PaginationBar';
import { EntityForm } from './EntityForm';
import { useEntityRows, useEntityMutations, useReferenceLabels } from '../hooks/useSettings';
import { useDebounce } from '@/lib/useDebounce';
import * as configService from '@/services/configService';
import type { ConfigEntity, ConfigEntityField } from '@/types/domain';

/** Columns shown inline in the table before the overflow is trimmed.
 * Descriptions, remarks and notes are long-form and belong in the form, not a
 * row. Everything else up to this cap is shown. */
const LIST_COLUMN_CAP = 5;

const SKIPPED_IN_LIST: ReadonlySet<ConfigEntityField['type']> = new Set<
  ConfigEntityField['type']
>(['textarea']);

export interface MasterEntityManagerProps {
  meta: ConfigEntity;
  catalog: ConfigEntity[];
  /** Whether the caller holds `config.write`. */
  canWrite: boolean;
}

type Row = Record<string, unknown>;

export function MasterEntityManager({ meta, catalog, canWrite }: MasterEntityManagerProps) {
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);

  const {
    rows,
    page,
    loading,
    error,
    includeInactive,
    setIncludeInactive,
    setSearch,
    setPage,
    reload,
  } = useEntityRows<Row>(meta.entity, '');

  /* Keep the hook's search in step with the debounced box. `setSearch` also
   * resets to page 1, so typing never strands the user on an empty last page. */
  useEffect(() => {
    setSearch(debouncedSearch);
  }, [debouncedSearch, setSearch]);

  const mutations = useEntityMutations(meta.entity, reload);

  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [deactivating, setDeactivating] = useState<Row | null>(null);

  const idColumn = meta.idColumn;

  /* Reference columns store a raw id. Resolve them to labels in one batched
   * request per referenced entity, not per row. */
  const referenceFields = useMemo(
    () => meta.fields.filter((field) => field.type === 'reference' && field.ref),
    [meta.fields],
  );
  const resolveRef = useReferenceLabels(
    useMemo(
      () =>
        referenceFields.map((field) => {
          const target = configService.findEntityMeta(catalog, field.ref ?? '');
          return {
            entity: field.ref ?? '',
            idColumn: target?.idColumn ?? 'id',
            labelField: configService.optionLabelFieldOf(field, catalog),
          };
        }),
      [referenceFields, catalog],
    ),
  );

  const visibleFields = useMemo(() => {
    const candidates = meta.fields.filter((field) => !SKIPPED_IN_LIST.has(field.type));
    /* Always keep the entity's own label column visible — a table of ids is
     * useless — even if it would otherwise be trimmed by the cap. */
    const withLabel = candidates.some((field) => field.key === meta.labelField)
      ? candidates
      : candidates.slice(0, LIST_COLUMN_CAP - 1).concat(
          candidates.filter((field) => field.key === meta.labelField),
        );
    return withLabel.slice(0, LIST_COLUMN_CAP);
  }, [meta.fields, meta.labelField]);

  const columns: Column<Row>[] = useMemo(() => {
    const dataColumns: Column<Row>[] = visibleFields.map((field) => ({
      key: field.key,
      header: field.label,
      render: (row: Row) => renderCell(field, row, resolveRef),
    }));

    const statusColumn: Column<Row> = {
      key: 'status',
      header: 'Status',
      render: (row: Row) => {
        const statusVal = String(row.status ?? row.statusKey ?? 'ACTIVE').toUpperCase();
        const active = statusVal !== 'INACTIVE';
        return <Badge variant={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Inactive'}</Badge>;
      },
    };

    const actionsColumn: Column<Row> = {
      key: '__actions',
      header: '',
      align: 'right',
      render: (row: Row) => (
        <div className="hs-flex hs-gap-1 hs-justify-end">
          <IconButton
            icon={<Icon name="edit" size={16} />}
            label={`Edit ${labelOf(row)}`}
            disabled={!canWrite}
            onClick={() => {
              mutations.clearErrors();
              setEditing(row);
            }}
          />
          <IconButton
            icon={<Icon name={isActive(row) ? 'lock' : 'unlock'} size={16} />}
            label={isActive(row) ? `Deactivate ${labelOf(row)}` : `Activate ${labelOf(row)}`}
            disabled={!canWrite}
            onClick={() => {
              if (isActive(row)) {
                setDeactivating(row);
              } else {
                void mutations.setStatus(String(row[idColumn] ?? ''), 'ACTIVE');
              }
            }}
          />
        </div>
      ),
    };

    return [...dataColumns, statusColumn, actionsColumn];
    // `labelOf` / `isActive` are pure helpers over `meta` + `idColumn`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleFields, canWrite, mutations, idColumn, resolveRef, meta]);

  function labelOf(row: Row): string {
    return String(row[meta.labelField] ?? row[idColumn] ?? '');
  }

  const handleCreate = async (values: Record<string, unknown>) => {
    if (await mutations.create(values)) { setCreating(false); }
  };

  const handleUpdate = async (values: Record<string, unknown>) => {
    if (!editing) { return; }
    const id = String(editing[idColumn] ?? '');
    if (await mutations.update(id, values)) { setEditing(null); }
  };

  const handleDeactivate = async () => {
    if (!deactivating) { return; }
    const id = String(deactivating[idColumn] ?? '');
    const ok = await mutations.setStatus(id, 'INACTIVE');
    /* On a DEPENDENCY_EXISTS refusal the dialog stays open so the warning toast
     * and the row remain in view; only a genuine success closes it. */
    if (ok) { setDeactivating(null); }
  };

  if (error) {
    return <ErrorState message={error} onRetry={reload} />;
  }

  return (
    <>
      <Card>
        <CardBody>
          <Toolbar>
            <div className="hs-flex hs-items-center hs-gap-3 hs-flex-wrap">
              <Input
                type="search"
                value={searchInput}
                placeholder={`Search ${meta.label.toLowerCase()}…`}
                aria-label={`Search ${meta.label}`}
                onChange={(event) => setSearchInput(event.target.value)}
                style={{ minWidth: '16rem' }}
              />
              <Switch
                label="Show deactivated"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
              />
              <span className="hs-text-sm hs-text-muted">
                {page.total} {page.total === 1 ? 'record' : 'records'}
              </span>
            </div>
            <div className="hs-flex hs-gap-2">
              <Button
                variant="ghost"
                icon={<Icon name="refresh" size={16} />}
                onClick={() => void reload()}
                disabled={loading}
              >
                Refresh
              </Button>
              {canWrite && (
                <Button
                  variant="primary"
                  icon={<Icon name="plus" size={16} />}
                  onClick={() => {
                    mutations.clearErrors();
                    setCreating(true);
                  }}
                >
                  Add {singular(meta.label)}
                </Button>
              )}
            </div>
          </Toolbar>
        </CardBody>
      </Card>

      <div className="hs-mt-4">
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          emptyTitle={`No ${meta.label.toLowerCase()} found`}
          emptyDescription={
            searchInput
              ? 'No record matches this search.'
              : canWrite
                ? `Add the first ${singular(meta.label).toLowerCase()} to get started.`
                : 'Nothing has been configured yet.'
          }
        />
      </div>

      {!loading && page.totalPages > 1 && (
        <PaginationBar page={page} onPageChange={setPage} />
      )}

      {/* Create */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={`Add ${singular(meta.label)}`}
      >
        <EntityForm
          meta={meta}
          catalog={catalog}
          row={null}
          error={mutations.error}
          fieldErrors={mutations.fieldErrors}
          busy={mutations.busy}
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
        />
      </Modal>

      {/* Edit */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit ${singular(meta.label)}`}
      >
        {editing && (
          <EntityForm
            meta={meta}
            catalog={catalog}
            row={editing}
            error={mutations.error}
            fieldErrors={mutations.fieldErrors}
            busy={mutations.busy}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      {/* Deactivate — a destructive action gets a confirmation. */}
      <ConfirmDialog
        open={deactivating !== null}
        onClose={() => setDeactivating(null)}
        onConfirm={() => void handleDeactivate()}
        title={`Deactivate ${singular(meta.label)}`}
        message={
          deactivating
            ? `Deactivate "${labelOf(deactivating)}"? It will stop appearing in pickers across the app. If it is still referenced, the server will refuse and say what is holding it.`
            : ''
        }
        confirmLabel="Deactivate"
        variant="danger"
        loading={mutations.busy}
      />
    </>
  );
}

/* ── Cell rendering ──────────────────────────────────────────────────────── */

function renderCell(
  field: ConfigEntityField,
  row: Row,
  resolveRef: (entity: string, id: string) => string,
): React.ReactNode {
  const value = row[field.key];

  if (field.type === 'checkbox') {
    return configService.isTruthy(value) ? <Icon name="check" size={16} /> : '—';
  }

  if (field.type === 'reference' && field.ref) {
    const id = String(value ?? '');
    return id ? resolveRef(field.ref, id) : '—';
  }

  if (configService.isNumericField(field)) {
    const text = String(value ?? '');
    if (text === '') { return '—'; }
    return field.type === 'percent' ? `${text}%` : text;
  }

  const text = String(value ?? '');
  return text === '' ? '—' : text;
}

function isActive(row: Row): boolean {
  const statusVal = String(row.status ?? row.statusKey ?? 'ACTIVE').toUpperCase();
  return statusVal !== 'INACTIVE';
}

/** Crude singularisation for button and dialog copy ("Wings" → "Wing").
 * Entity labels are short noun phrases, so this is sufficient; a label that is
 * already singular is returned unchanged. */
function singular(label: string): string {
  if (/ies$/i.test(label)) { return label.replace(/ies$/i, 'y'); }
  if (/(ses|xes|ches|shes)$/i.test(label)) { return label.replace(/es$/i, ''); }
  if (/s$/i.test(label) && !/ss$/i.test(label)) { return label.slice(0, -1); }
  return label;
}
