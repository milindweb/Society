/* configService.ts — FE-13 settings & configuration
 * Verified against backend/src/{Routes,ConfigService,SchemaMeta,Repository}.gs.
 *
 * This module is the whole reason the Settings UI can stay metadata-driven:
 * the server owns the list of master entities (`SchemaMeta.MASTER_ENTITIES`,
 * 24 entries), the fields of each one, and the read/write permission keys.
 * The frontend therefore renders `config.entityMeta` output and never
 * hardcodes an entity key, a field list or a label (SRS §15).
 *
 * Server-enforced contract details the UI must respect:
 *
 * - `config.get` and `config.enums` are PUBLIC (no permission). `config.entityMeta`,
 *   `config.entity.list` and `config.entity.get` require `config.read`.
 *   `config.update` and every `config.entity.{create,update,setStatus}` require
 *   `config.write`.
 * - `config.update` accepts `payload.values` (falls back to the whole payload
 *   server-side) and REQUIRES `clientRequestId`.
 * - `config.entity.create` takes `{entity, values}` where `values` is a plain
 *   column→value bag. Required-field validation is done SERVER-side from the
 *   same field descriptors, and failures come back as `VALIDATION_ERROR` with
 *   `details: [{field, message}]` — so the form can render them per field.
 * - `config.entity.update` takes `{entity, id, values}`; only the supplied keys
 *   are patched.
 * - `config.entity.setStatus` takes `{entity, id, status}` with `status` being
 *   exactly `ACTIVE` or `INACTIVE`. Deactivating an entity that is still
 *   referenced returns `error.code === 'DEPENDENCY_EXISTS'` plus
 *   `error.details` and a top-level `error.count`. This is NOT an exception the
 *   user should see raw — the UI must explain which dependency blocks it.
 * - `config.entity.list` filters to `status === 'ACTIVE'` server-side unless the
 *   caller passes `includeInactive: true`. Master rows use the column name
 *   `status` (not `statusKey`).
 * - `config.entityMeta` with no `entity` returns an ARRAY of all descriptors;
 *   with an `entity` it returns ONE descriptor (or `null` for an unknown key).
 * - The list endpoint's rows arrive as a bare `data` array and are re-shaped
 *   into `{items, page}` by apiClient.normaliseData.
 * - `Vendors.categoryKey` declares `options: 'EXPENSE_CATEGORIES'` — a legacy
 *   marker, not an enum. Its `optionsFrom` names another entity instead. */

import { apiClient } from './apiClient';
import { generateClientId } from '@/lib/idempotency';
import { ApiClientError } from '@/types/api';
import type { Paginated, PaginationParams } from '@/types/api';
import type {
  ConfigEnums,
  ConfigEntity,
  ConfigEntityField,
  SocietyConfig,
} from '@/types/domain';

/* ── Society configuration ───────────────────────────────────────────────── */

export async function getConfig(): Promise<SocietyConfig> {
  return apiClient<SocietyConfig>({ action: 'config.get' });
}

export async function getEnums(): Promise<ConfigEnums> {
  return apiClient<ConfigEnums>({ action: 'config.enums' });
}

/** Patch society config values. `clientRequestId` is required by the route. */
export async function updateConfig(
  values: Record<string, unknown>,
): Promise<{ updated: number; config: SocietyConfig }> {
  return apiClient<{ updated: number; config: SocietyConfig }>({
    action: 'config.update',
    payload: { values, clientRequestId: generateClientId() },
  });
}

/* Marker meaning "this select's options come from another master entity".
 * SchemaMeta declares it for `Vendors.categoryKey`. */
export const EXPENSE_CATEGORIES_MARKER = 'EXPENSE_CATEGORIES';

/* ── Entity metadata ─────────────────────────────────────────────────────── */

/** Descriptors for every master entity. Drives the generic Settings UI. */
export async function getAllEntityMeta(): Promise<ConfigEntity[]> {
  const data = await apiClient<ConfigEntity[] | null>({ action: 'config.entityMeta' });
  return Array.isArray(data) ? data : [];
}

/** Descriptor for one entity, or `null` when the server does not know the key. */
export async function getEntityMeta(entity: string): Promise<ConfigEntity | null> {
  return apiClient<ConfigEntity | null>({ action: 'config.entityMeta', payload: { entity } });
}

/** Convenience: cache-friendly lookup of a single descriptor out of the catalog. */
export function findEntityMeta(
  catalog: ConfigEntity[],
  entity: string,
): ConfigEntity | undefined {
  return catalog.find((meta) => meta.entity === entity);
}

/* ── Entity rows ─────────────────────────────────────────────────────────── */

/** Filters accepted by `config.entity.list`, on top of the generic pagination.
 * The backend passes `filter` straight through to `Repository.readSheet`, which
 * matches every key with strict string equality. */
export interface EntityListParams extends PaginationParams {
  /** Without this the server returns ACTIVE rows only. */
  includeInactive?: boolean;
}

export async function listEntity<T = Record<string, unknown>>(
  entity: string,
  params?: EntityListParams,
): Promise<Paginated<T>> {
  return apiClient<Paginated<T>>({
    action: 'config.entity.list',
    payload: { entity, ...params },
  });
}

export async function getEntity<T = Record<string, unknown>>(
  entity: string,
  id: string,
): Promise<T> {
  return apiClient<T>({ action: 'config.entity.get', payload: { entity, id } });
}

export async function createEntity<T = Record<string, unknown>>(
  entity: string,
  values: Record<string, unknown>,
): Promise<T> {
  return apiClient<T>({
    action: 'config.entity.create',
    payload: { entity, values, clientRequestId: generateClientId() },
  });
}

export async function updateEntity<T = Record<string, unknown>>(
  entity: string,
  id: string,
  values: Record<string, unknown>,
): Promise<T> {
  return apiClient<T>({
    action: 'config.entity.update',
    payload: { entity, id, values, clientRequestId: generateClientId() },
  });
}

export async function setEntityStatus<T = Record<string, unknown>>(
  entity: string,
  id: string,
  status: 'ACTIVE' | 'INACTIVE',
): Promise<T> {
  return apiClient<T>({
    action: 'config.entity.setStatus',
    payload: { entity, id, status, clientRequestId: generateClientId() },
  });
}

/* ── Field descriptor interpretation ─────────────────────────────────────── */

/** Inputs that carry free text (used for max-length hints and `type` attr). */
const TEXTUAL_TYPES: ReadonlySet<ConfigEntityField['type']> = new Set<
  ConfigEntityField['type']
>(['text', 'textarea', 'phone', 'email']);

export function isTextField(field: ConfigEntityField): boolean {
  return TEXTUAL_TYPES.has(field.type);
}

/** `number` and `percent` are both numeric inputs; `percent` adds a `%` suffix. */
export function isNumericField(field: ConfigEntityField): boolean {
  return field.type === 'number' || field.type === 'percent';
}

/** True when the field's options come from a system enum (`options: 'ENUM'`),
 * i.e. `SchemaMeta.ENUM_OPTIONS[field.optionsFrom]`. */
export function isEnumField(field: ConfigEntityField): boolean {
  return field.type === 'select' && field.options === 'ENUM' && !!field.optionsFrom;
}

/** True when the field's options come from another master entity — either via
 * the legacy `EXPENSE_CATEGORIES` marker or a plain `optionsFrom` entity key. */
export function isEntityBackedField(field: ConfigEntityField): boolean {
  if (field.type === 'reference') { return !!field.ref; }
  if (field.type !== 'select') { return false; }
  return !!field.optionsFrom && !isEnumField(field);
}

/** The entity key a `select`/`reference` field draws its options from. */
export function optionEntityOf(field: ConfigEntityField): string | null {
  if (field.type === 'reference') { return field.ref ?? null; }
  if (isEntityBackedField(field)) { return field.optionsFrom ?? null; }
  return null;
}

/** The enum key a field draws its options from, e.g. `COMPOUND_METHOD`. */
export function enumKeyOf(field: ConfigEntityField): string | null {
  return isEnumField(field) ? (field.optionsFrom ?? null) : null;
}

/** The column of the referenced entity to show in the picker. */
export function optionLabelFieldOf(
  field: ConfigEntityField,
  catalog: ConfigEntity[],
): string {
  if (field.refLabel) { return field.refLabel; }
  const target = field.ref ?? field.optionsFrom;
  const meta = target ? findEntityMeta(catalog, target) : undefined;
  return meta?.labelField ?? 'name';
}

/** Fields the server will refuse to create a row without (`field.required`). */
export function requiredFields(meta: ConfigEntity): ConfigEntityField[] {
  return meta.fields.filter((field) => field.required === true);
}

/* ── Writing rows ────────────────────────────────────────────────────────── */

/** Booleans travel to the sheet as the strings Sheets understands. The backend
 * casts on read, but sending a real boolean through `text/plain` JSON is fine —
 * `Repository` stringifies. Normalise anyway so an unchecked box is an explicit
 * `false` rather than `undefined` (which the server would treat as "missing"). */
function normaliseValue(field: ConfigEntityField, raw: unknown): unknown {
  if (field.type === 'checkbox') { return raw === true; }
  if (isNumericField(field)) {
    if (raw === '' || raw === undefined || raw === null) { return ''; }
    const num = Number(raw);
    return Number.isFinite(num) ? num : '';
  }
  if (raw === undefined || raw === null) { return ''; }
  return raw;
}

/** Build the `values` bag for create/update from a form model.
 *
 * Only keys present in the entity's descriptors are sent — the server would
 * ignore extras anyway, but dropping them keeps the request honest and prevents
 * a stray UI-only field from ever reaching the sheet. */
export function toEntityValues(
  meta: ConfigEntity,
  model: Record<string, unknown>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of meta.fields) {
    if (!(field.key in model)) { continue; }
    values[field.key] = normaliseValue(field, model[field.key]);
  }
  return values;
}

/** Seed a form model from an existing row (edit mode) or from defaults (create). */
export function toFormModel(
  meta: ConfigEntity,
  row?: Record<string, unknown> | null,
): Record<string, unknown> {
  const model: Record<string, unknown> = {};
  for (const field of meta.fields) {
    const current = row ? row[field.key] : undefined;
    if (current !== undefined && current !== null && current !== '') {
      model[field.key] = field.type === 'checkbox' ? truthy(current) : current;
      continue;
    }
    model[field.key] = field.type === 'checkbox' ? false : '';
  }
  return model;
}

/** Sheets store booleans as `'TRUE'`/`'FALSE'` strings (and sometimes `1`). */
function truthy(value: unknown): boolean {
  if (typeof value === 'boolean') { return value; }
  const text = String(value).trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes';
}

/** Exposed for the list renderer, which shows a tick for booleans. */
export function isTruthy(value: unknown): boolean {
  return truthy(value);
}

/* ── Error interpretation ────────────────────────────────────────────────── */

/** Per-field messages from a `VALIDATION_ERROR` rejection, keyed by column.
 * Returns an empty object for any other failure so callers can fall back to a
 * banner with `error.message`. */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  if (!(error instanceof ApiClientError)) { return {}; }
  if (error.code !== 'VALIDATION_ERROR' || !error.details) { return {}; }
  const map: Record<string, string> = {};
  for (const detail of error.details) {
    if (detail.field) { map[detail.field] = detail.message; }
  }
  return map;
}

/** A deactivation blocked by live references.
 *
 * `ConfigService.setEntityStatus` returns `{ok:false, error:'DEPENDENCY_EXISTS',
 * details:[...], count:N}` and `ApiRouter` surfaces `count` on the error body.
 * `details` is a list of `"Sheet: n"` strings — we keep the raw text because it
 * is the only thing that names the blocking rows, and present `count` as the
 * headline number. Returns `null` for any other error. */
export interface DependencyBlock {
  count: number;
  details: string[];
}

export function dependencyBlockOf(error: unknown): DependencyBlock | null {
  if (!(error instanceof ApiClientError)) { return null; }
  if (error.code !== 'DEPENDENCY_EXISTS') { return null; }

  const raw = (error as ApiClientError & { count?: unknown }).count;
  const count = typeof raw === 'number' ? raw : 0;

  const details: string[] = [];
  if (error.details) {
    for (const detail of error.details) {
      /* The backend pushes plain strings here; `detail.message` is the shape
       * used by validation errors, so accept either. */
      const message = detail.message || detail.field;
      if (message) { details.push(message); }
    }
  }
  return { count, details };
}

/** Server-side status filter default — handy for the list header copy. */
export const ENTITY_DEFAULT_STATUS = 'ACTIVE';

/** The only two statuses `config.entity.setStatus` accepts. */
export type EntityStatus = 'ACTIVE' | 'INACTIVE';

export function statusAfterToggle(current: unknown): EntityStatus {
  return truthy(current) || String(current).toUpperCase() === 'ACTIVE'
    ? 'INACTIVE'
    : 'ACTIVE';
}
