/* useSettings.ts — FE-13 settings & configuration data access
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 *
 * Everything here is driven by the server's own metadata. `config.entityMeta`
 * returns 24 master-entity descriptors (SchemaMeta.MASTER_ENTITIES) each with
 * its fields, so the Settings UI can render — and validate, and save — a master
 * entity it has never heard of. Nothing in this module names a specific entity
 * or column (SRS §15).
 *
 * No optimistic UI (SRS §23): after every write the rows are re-fetched from the
 * server, because the server owns `status`, the generated id and every coercion
 * applied on the way into the sheet. */

import { useState, useEffect, useCallback } from 'react';
import * as configService from '@/services/configService';
import { configStore } from '@/state/configStore';
import { toastStore } from '@/state/toastStore';
import type { ConfigEntity, ConfigEntityField, SocietyConfig } from '@/types/domain';
import type { PageMeta } from '@/types/api';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

/** Master entities are small reference tables; page generously so one request
 * covers a realistic society without the user having to page. */
const ENTITY_PAGE_SIZE = 50;

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/* ---------------------------------------------------------------------------
 * Society configuration values
 * ------------------------------------------------------------------------- */

export interface UseSocietyConfigReturn {
  config: SocietyConfig | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  /** Server message from the last failed save; cleared on the next attempt. */
  saveError: string | null;
  reload: () => Promise<void>;
  /** Patch config keys. Resolves `true` only when the server accepted the write. */
  save: (values: Record<string, unknown>) => Promise<boolean>;
}

/** Read `config.get` and write through `config.update`.
 *
 * `config.get` carries no permission (it is needed before login to brand the
 * app), but `config.update` requires `config.write`, so the form is rendered
 * read-only for everyone else rather than failing on submit.
 *
 * The update response already carries the fresh config, so it is stored
 * directly — and the shared `configStore` is refreshed too, since currency,
 * society name and page size are read from it across the app. */
export function useSocietyConfig(): UseSocietyConfigReturn {
  const [config, setConfig] = useState<SocietyConfig | null>(configStore.config);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await configService.getConfig();
      setConfig(data);
      configStore.setConfig(data);
    } catch (err) {
      setError(messageOf(err, 'Failed to load society configuration'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (values: Record<string, unknown>) => {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await configService.updateConfig(values);
      /* The server echoes the persisted config — trust it over the typed values. */
      if (result?.config) {
        setConfig(result.config);
        configStore.setConfig(result.config);
      } else {
        await load();
      }
      return true;
    } catch (err) {
      setSaveError(messageOf(err, 'Could not save the configuration'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [load]);

  return { config, loading, error, saving, saveError, reload: load, save };
}

/* ---------------------------------------------------------------------------
 * Entity catalog (the descriptor list that drives the whole Settings UI)
 * ------------------------------------------------------------------------- */

export interface UseEntityCatalogReturn {
  catalog: ConfigEntity[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** All master-entity descriptors, loaded once.
 *
 * A module-level cache keeps this to a single request per session: the
 * descriptors are schema metadata and only change when the backend is
 * redeployed, and every Settings tab needs them. */
let catalogCache: ConfigEntity[] | null = null;
let catalogPromise: Promise<ConfigEntity[]> | null = null;

function loadCatalogOnce(): Promise<ConfigEntity[]> {
  if (catalogCache) { return Promise.resolve(catalogCache); }
  if (!catalogPromise) {
    catalogPromise = configService
      .getAllEntityMeta()
      .then((list) => {
        catalogCache = list;
        catalogPromise = null;
        return list;
      })
      .catch((err) => {
        catalogPromise = null;
        throw err;
      });
  }
  return catalogPromise;
}

/** Drop the descriptor cache — used after a failed load so Retry re-requests. */
export function clearEntityCatalogCache(): void {
  catalogCache = null;
  catalogPromise = null;
}

export function useEntityCatalog(): UseEntityCatalogReturn {
  const [catalog, setCatalog] = useState<ConfigEntity[]>(catalogCache ?? []);
  const [loading, setLoading] = useState(catalogCache === null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (catalogCache === null) { setLoading(true); }
    setError(null);

    loadCatalogOnce()
      .then((list) => {
        if (cancelled) return;
        setCatalog(list);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(messageOf(err, 'Could not load the configuration catalog'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  const reload = useCallback(async () => {
    clearEntityCatalogCache();
    setTick((n) => n + 1);
  }, []);

  return { catalog, loading, error, reload };
}

/* ---------------------------------------------------------------------------
 * Entity rows
 * ------------------------------------------------------------------------- */

export interface UseEntityRowsReturn<T = Record<string, unknown>> {
  rows: T[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  /** True when the last load included INACTIVE rows. */
  includeInactive: boolean;
  setIncludeInactive: (next: boolean) => void;
  search: string;
  setSearch: (next: string) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
}

/** Paginated rows for one master entity.
 *
 * `includeInactive` is passed through to the server, which filters to
 * `status === 'ACTIVE'` unless told otherwise — so "show deactivated" is a real
 * server query, not a client-side filter over a partial page. */
export function useEntityRows<T = Record<string, unknown>>(
  entity: string,
  initialSearch = '',
): UseEntityRowsReturn<T> {
  const [rows, setRows] = useState<T[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactiveState] = useState(false);
  const [search, setSearchState] = useState(initialSearch);
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    if (!entity) {
      setRows([]);
      setPageState(EMPTY_PAGE);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await configService.listEntity<T>(entity, {
        page: pageNumber,
        pageSize: ENTITY_PAGE_SIZE,
        search: search || undefined,
        includeInactive: includeInactive || undefined,
      });
      setRows(result.items ?? []);
      setPageState(result.page ?? EMPTY_PAGE);
    } catch (err) {
      setRows([]);
      setPageState(EMPTY_PAGE);
      setError(messageOf(err, 'Failed to load this list'));
    } finally {
      setLoading(false);
    }
  }, [entity, pageNumber, search, includeInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  const setSearch = useCallback((next: string) => {
    setSearchState(next);
    setPageNumber(1);
  }, []);

  const setIncludeInactive = useCallback((next: boolean) => {
    setIncludeInactiveState(next);
    setPageNumber(1);
  }, []);

  return {
    rows,
    page,
    loading,
    error,
    includeInactive,
    setIncludeInactive,
    search,
    setSearch,
    setPage: setPageNumber,
    reload: load,
  };
}

/* ---------------------------------------------------------------------------
 * Entity mutation
 * ------------------------------------------------------------------------- */

export interface UseEntityMutationsReturn {
  busy: boolean;
  /** Server message from the last failed write. */
  error: string | null;
  /** Per-field messages from a `VALIDATION_ERROR`, keyed by column. */
  fieldErrors: Record<string, string>;
  clearErrors: () => void;
  create: (values: Record<string, unknown>) => Promise<boolean>;
  update: (id: string, values: Record<string, unknown>) => Promise<boolean>;
  /** Activate/deactivate. `DEPENDENCY_EXISTS` is surfaced as a toast, not an
   * error banner, because it is a legitimate business refusal rather than a
   * failure — see `configService.dependencyBlockOf`. */
  setStatus: (id: string, status: configService.EntityStatus) => Promise<boolean>;
}

/** Create / update / deactivate one master row.
 *
 * Every method returns a boolean. A refusal (a missing required field, a
 * duplicate key, live dependants) must keep the caller's dialog open and show
 * the server's own message, never close on a lie.
 *
 * `reload` is injected rather than owned so the caller decides what to refresh
 * — the row list, and nothing else. */
export function useEntityMutations(
  entity: string,
  reload: () => Promise<void> | void,
): UseEntityMutationsReturn {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearErrors = useCallback(() => {
    setError(null);
    setFieldErrors({});
  }, []);

  const create = useCallback(
    async (values: Record<string, unknown>) => {
      setBusy(true);
      clearErrors();
      try {
        await configService.createEntity(entity, values);
        await reload();
        return true;
      } catch (err) {
        const perField = configService.fieldErrorsOf(err);
        setFieldErrors(perField);
        setError(
          Object.keys(perField).length > 0
            ? 'Please correct the highlighted fields.'
            : messageOf(err, 'Could not save this record'),
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [entity, reload, clearErrors],
  );

  const update = useCallback(
    async (id: string, values: Record<string, unknown>) => {
      setBusy(true);
      clearErrors();
      try {
        await configService.updateEntity(entity, id, values);
        await reload();
        return true;
      } catch (err) {
        const perField = configService.fieldErrorsOf(err);
        setFieldErrors(perField);
        setError(
          Object.keys(perField).length > 0
            ? 'Please correct the highlighted fields.'
            : messageOf(err, 'Could not save this record'),
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [entity, reload, clearErrors],
  );

  const setStatus = useCallback(
    async (id: string, status: configService.EntityStatus) => {
      setBusy(true);
      clearErrors();
      try {
        await configService.setEntityStatus(entity, id, status);
        await reload();
        return true;
      } catch (err) {
        const block = configService.dependencyBlockOf(err);
        if (block) {
          /* A blocked deactivation is expected behaviour, not a bug: the row is
           * in use. Say so plainly and name what is holding it. */
          const detail = block.details.length > 0 ? ` (${block.details.join(', ')})` : '';
          toastStore.add(
            'warning',
            `Cannot deactivate — still in use by ${block.count} record${
              block.count === 1 ? '' : 's'
            }${detail}.`,
          );
          return false;
        }
        toastStore.add('error', messageOf(err, 'Could not change the status'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [entity, reload, clearErrors],
  );

  return { busy, error, fieldErrors, clearErrors, create, update, setStatus };
}

/* ---------------------------------------------------------------------------
 * Field option sources
 * ------------------------------------------------------------------------- */

/** Options for one `select`/`reference` field descriptor.
 *
 * Three sources, resolved by the descriptor:
 *   - `reference`                     → the `ref` entity's rows, labelled with `refLabel`
 *   - `select` + `options: 'ENUM'`    → `SchemaMeta.ENUM_OPTIONS[optionsFrom]`
 *   - `select` + an entity `optionsFrom` → that entity's ACTIVE rows
 *
 * Enum values are SCREAMING_SNAKE keys and are title-cased for display; entity
 * rows fall back to the target entity's `labelField` when `refLabel` is absent.
 * Both `config.enums` and `config.entity.list` are read through the same
 * permission (`config.read`) the Settings page already needs. */
export function useFieldOptions(
  field: ConfigEntityField,
  catalog: ConfigEntity[],
): { options: { value: string; label: string }[]; loading: boolean } {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const entityKey = configService.optionEntityOf(field);
  const enumKey = configService.enumKeyOf(field);
  const labelField = entityKey
    ? configService.optionLabelFieldOf(field, catalog)
    : '';
  const idField = entityKey
    ? configService.findEntityMeta(catalog, entityKey)?.idColumn ?? ''
    : '';

  useEffect(() => {
    let cancelled = false;

    if (enumKey) {
      setLoading(true);
      (async () => {
        try {
          let enums = configStore.enums;
          if (!enums) {
            enums = await configService.getEnums();
            configStore.setEnums(enums);
          }
          const raw = (enums as unknown as { enums?: Record<string, string[]> }).enums?.[enumKey] ?? [];
          if (cancelled) return;
          setOptions(
            raw.map((value) => ({
              value,
              label: value
                .split('_')
                .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
                .join(' '),
            })),
          );
        } catch {
          if (!cancelled) setOptions([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (entityKey && idField) {
      setLoading(true);
      configService
        /* Backend caps `pageSize` at 100 (Routes.gs:70). */
        .listEntity<Record<string, unknown>>(entityKey, { page: 1, pageSize: 100 })
        .then((result) => {
          if (cancelled) return;
          setOptions(
            (result.items ?? [])
              .map((row) => {
                const value = String(row[idField] ?? '');
                const label = String(row[labelField] ?? row[idField] ?? '');
                return value ? { value, label } : null;
              })
              .filter((option): option is { value: string; label: string } => option !== null),
          );
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    setOptions([]);
    setLoading(false);
    return undefined;
  }, [enumKey, entityKey, idField, labelField]);

  return { options, loading };
}

/* ---------------------------------------------------------------------------
 * Record resolution (showing a reference as a name, not an id)
 * ------------------------------------------------------------------------- */

/** Resolve `id` → display label for one referenced entity.
 *
 * A `reference` column stores a bare id (`chargeTypeId`, `flatId`, …). The list
 * shows the human label instead. Rows are fetched once per entity and cached,
 * so a table with three reference columns makes three requests, not three per
 * row. Returns the raw id while loading, so the cell is never blank. */
const labelCache = new Map<string, Map<string, string>>();

export function useReferenceLabels(
  refs: { entity: string; idColumn: string; labelField: string }[],
): (entity: string, id: string) => string {
  const [version, setVersion] = useState(0);

  const signature = refs
    .map((ref) => `${ref.entity}:${ref.idColumn}:${ref.labelField}`)
    .join('|');

  useEffect(() => {
    let cancelled = false;

    const pending = refs.filter((ref) => !labelCache.has(ref.entity));
    if (pending.length === 0) { return undefined; }

    Promise.all(
      pending.map((ref) =>
        configService
          /* Backend caps `pageSize` at 100 (Routes.gs:70). */
          .listEntity<Record<string, unknown>>(ref.entity, { page: 1, pageSize: 100 })
          .then((result) => {
            const map = new Map<string, string>();
            for (const row of result.items ?? []) {
              const id = String(row[ref.idColumn] ?? '');
              if (id) { map.set(id, String(row[ref.labelField] ?? id)); }
            }
            labelCache.set(ref.entity, map);
          })
          .catch(() => {
            /* Leave uncached so a later render retries. */
          }),
      ),
    ).then(() => {
      if (!cancelled) { setVersion((n) => n + 1); }
    });

    return () => {
      cancelled = true;
    };
    // `signature` captures every ref field; the array identity is not stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  /* `version` is read so React re-renders once the labels arrive. */
  void version;

  return useCallback((entity: string, id: string) => {
    if (!id) { return ''; }
    return labelCache.get(entity)?.get(id) ?? id;
  }, []);
}

/** Drop cached reference labels — used after a referenced entity is edited, so
 * a renamed row does not keep showing its old label. */
export function clearReferenceLabelCache(): void {
  labelCache.clear();
}
