/* useConfigOptions.ts — config-driven select options (shared)
 * SRS §15 / frontend-architecture.md §8: the frontend holds NO hardcoded master data.
 * Every category, priority, type and status arrives from the API.
 *
 * Two sources, both already fetched by the config layer:
 *  - `config.entity.list`  -> master-data sheets (wings, complaint categories,
 *                             complaint priorities, visitor types, ...)
 *  - `config.enums`        -> Status_Config rows per domain, and SchemaMeta.ENUM_OPTIONS
 *
 * The entity tables name their id and label columns differently per sheet, so
 * `useEntityOptions` takes the candidate column names in priority order. */

import { useState, useEffect } from 'react';
import * as configService from '@/services/configService';
import { configStore } from '@/state/configStore';
import type { SelectOption } from '@/types/domain';

function mapEntityRows(
  rows: Record<string, unknown>[],
  idKeys: string[],
  labelKeys: string[],
): SelectOption[] {
  return rows
    .map((row) => {
      const value = String(idKeys.map((k) => row[k]).find((v) => v) ?? '');
      const label = String(labelKeys.map((k) => row[k]).find((v) => v) ?? value);
      return value ? { value, label } : null;
    })
    .filter((option): option is SelectOption => option !== null);
}

/** Options from a `config.entity.list` master entity.
 *
 * `idKeys` / `labelKeys` are candidate column names in priority order, because
 * the sheets disagree: `Complaint_Categories` uses `categoryId`/`categoryName`,
 * `Complaint_Priorities` uses `priorityId`/`priorityName`, `Visitor_Types` uses
 * `visitorTypeId`/`typeName`.
 *
 * @example useEntityOptions('complaintPriorities', ['priorityId'], ['priorityName'])
 */
export function useEntityOptions(
  entity: string,
  idKeys: string[],
  labelKeys: string[],
): { options: SelectOption[]; loading: boolean; error: string | null } {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Join the key arrays so the effect dependency is stable across renders. */
  const idKeySig = idKeys.join('|');
  const labelKeySig = labelKeys.join('|');

  useEffect(() => {
    let cancelled = false;
    const ids = idKeySig ? idKeySig.split('|') : [];
    const labels = labelKeySig ? labelKeySig.split('|') : [];

    setLoading(true);
    setError(null);

    configService
      /* `pageSize` is capped at 100 by the backend (`Routes.gs:70`,
       * api-contract.md §5). Asking for 200 made every master-data lookup fail
       * with VALIDATION_ERROR, which the catch below turned into an empty
       * option list — so wings, categories, priorities and types all rendered
       * as blank dropdowns. */
      .listEntity<Record<string, unknown>>(entity, { page: 1, pageSize: 100 })
      .then((result) => {
        if (cancelled) return;
        setOptions(mapEntityRows(result.items ?? [], ids, labels));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setOptions([]);
        setError(err instanceof Error ? err.message : `Could not load ${entity}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entity, idKeySig, labelKeySig]);

  return { options, loading, error };
}

/** Status options for a Status_Config domain (e.g. COMPLAINT, VISITOR).
 * Rows arrive as `{ statusKey, statusName, isOpen, isTerminal, ... }`. */
export function useStatusOptions(family: string): { options: SelectOption[]; loading: boolean } {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        let enums = configStore.enums;
        if (!enums) {
          enums = await configService.getEnums();
          configStore.setEnums(enums);
        }
        const rows = (enums.statuses?.[family] ?? []) as unknown as {
          statusKey?: string;
          statusName?: string;
          value?: string;
          label?: string;
        }[];
        if (cancelled) return;
        setOptions(
          rows
            .map((row) => ({
              value: String(row.statusKey ?? row.value ?? ''),
              label: String(row.statusName ?? row.label ?? row.statusKey ?? ''),
            }))
            .filter((option) => option.value !== ''),
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
  }, [family]);

  return { options, loading };
}

/** Options from `SchemaMeta.ENUM_OPTIONS` (e.g. ASSIGNEE_TYPE, VISITOR_SOURCE).
 * Values are SCREAMING_SNAKE keys, so they are title-cased for display. */
export function useEnumOptions(key: string): { options: SelectOption[]; loading: boolean } {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        let enums = configStore.enums;
        if (!enums) {
          enums = await configService.getEnums();
          configStore.setEnums(enums);
        }
        const raw = (enums as unknown as { enums?: Record<string, string[]> }).enums?.[key] ?? [];
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
  }, [key]);

  return { options, loading };
}

/**
 * Pick a ready-made `SelectOption[]` out of `config.enums`.
 *
 * Some lists arrive already shaped as `{value,label}` rather than as raw sheet
 * rows or SCREAMING_SNAKE values:
 *   - `paymentModes`            (ConfigService.gs:202, `{value: modeKey, label: modeName}`)
 *   - `types.employee`          (ConfigService.gs:217, employee types)
 *
 * `useEntityOptions` cannot serve these (it re-queries `config.entity.list` and
 * expects raw rows), and `useEnumOptions` cannot either (it expects bare string
 * arrays). This reads them straight off the cached enums payload.
 *
 * @example useEnumList('paymentModes')
 * @example useEnumList('types', 'employee')
 */
export function useEnumList(
  key: 'paymentModes' | 'roles',
): { options: SelectOption[]; loading: boolean };
export function useEnumList(
  key: 'types' | 'categories',
  subKey: string,
): { options: SelectOption[]; loading: boolean };
export function useEnumList(
  key: string,
  subKey?: string,
): { options: SelectOption[]; loading: boolean } {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        let enums = configStore.enums;
        if (!enums) {
          enums = await configService.getEnums();
          configStore.setEnums(enums);
        }
        const bag = enums as unknown as Record<string, unknown>;
        const node = subKey ? (bag[key] as Record<string, unknown> | undefined)?.[subKey] : bag[key];
        const rows = Array.isArray(node) ? (node as SelectOption[]) : [];
        if (cancelled) return;
        setOptions(
          rows
            .filter((row) => row && row.value)
            .map((row) => ({ value: String(row.value), label: String(row.label ?? row.value) })),
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
  }, [key, subKey]);

  return { options, loading };
}
