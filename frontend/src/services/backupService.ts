/* backupService.ts — Backup, Archive & Audit API actions (api-contract.md §7.9)
 *
 * Contract source: `Routes.gs:1033-1072`, `BackupService.gs`.
 * Route gate / idempotency notes that are easy to get wrong:
 *  - `backup.create` requires `scope` **and** `clientRequestId` (`Routes.gs:1035`).
 *  - `archive.run` requires `clientRequestId` only — it takes no other required
 *    field, and `entity` is optional (absent = every archivable sheet).
 *  - `archive.list` / `audit.list` are paginated reads gated on `archive.read` /
 *    `audit.read`; neither takes `clientRequestId`.
 *  - `backup.list` is gated on `backup.run` (there is no `backup.read`).
 */

import { apiClient } from './apiClient';
import { generateClientId } from '@/lib/idempotency';
import type { Paginated, PaginationParams } from '@/types/api';
import type { Backup, BackupCreateResult, AuditEntry, ArchiveEntry } from '@/types/domain';

/* ── Backup ── */

/** Scopes accepted by `backup.create`; the UI sources these from
 *  `config.enums.enums.BACKUP_SCOPE` rather than hardcoding them (SRS §15). */
export interface BackupCreatePayload {
  scope: string;
  notes?: string;
}

/** `backup.create` returns a **summary**, not the stored `Backups` row:
 *  `{backupId, scope, totalRows, sheets, checksum}` (`BackupService.gs:133`).
 *  Anything else the list view needs comes from `listBackups`. */
export async function createBackup(payload: BackupCreatePayload): Promise<BackupCreateResult> {
  return apiClient<BackupCreateResult>({
    action: 'backup.create',
    payload: { ...payload, clientRequestId: generateClientId() },
  });
}

export async function listBackups(params?: PaginationParams): Promise<Paginated<Backup>> {
  return apiClient<Paginated<Backup>>({
    action: 'backup.list',
    payload: params,
  });
}

/* ── Archive ── */

export interface ArchiveRunPayload {
  /** Source sheet name. Omit to walk every archivable sheet. */
  entity?: string;
  /** Defaults server-side to the `archiveAfterMonths` config value (24). */
  olderThanMonths?: number;
  /** When true nothing is copied and no index rows are written. */
  dryRun?: boolean;
  /** Free-text reason recorded on each `Archive_Index` row. */
  reason?: string;
}

/** One entry per sheet walked. The field is **`sheet`**, not `entity`
 *  (`BackupService.gs:311` pushes `{ sheet: sheetName, moved, skipped }`). */
export interface ArchiveRunJob {
  sheet: string;
  moved: number;
  skipped: number;
}

export interface ArchiveRunResult {
  movedCount: number;
  skippedCount: number;
  dryRun: boolean;
  jobs: ArchiveRunJob[];
}

/** Run an archive pass.
 *
 * IMPORTANT — this is the only genuinely mutating action in FE-14. When
 * `dryRun` is falsy the service copies matching rows into `Archive_<sheet>`,
 * writes an `Archive_Index` row, and deletes the source row **for non-immutable
 * sheets only** (`BackupService.gs:273`). Today every archivable sheet
 * (`Sessions`, `Auth_Audit`, `Audit_Log` — `Schema.gs:71,75,280`) is declared
 * `immutable`, so no deletion occurs; callers must still pass `dryRun: true`
 * explicitly to preview, and the UI confirms before a real run. */
export async function runArchive(payload: ArchiveRunPayload): Promise<ArchiveRunResult> {
  return apiClient<ArchiveRunResult>({
    action: 'archive.run',
    payload: { ...payload, clientRequestId: generateClientId() },
  });
}

export async function listArchives(
  params?: PaginationParams & { entity?: string; originalId?: string },
): Promise<Paginated<ArchiveEntry>> {
  return apiClient<Paginated<ArchiveEntry>>({
    action: 'archive.list',
    payload: params,
  });
}

/* ── Audit ── */

export interface AuditListParams extends PaginationParams {
  entity?: string;
  entityId?: string;
  action?: string;
  /** Inclusive lower bound compared against the `ts` column (`BackupService.gs:431`). */
  from?: string;
  /** Inclusive upper bound compared against the `ts` column. */
  to?: string;
  actorUserId?: string;
}

export async function listAuditEntries(params?: AuditListParams): Promise<Paginated<AuditEntry>> {
  return apiClient<Paginated<AuditEntry>>({
    action: 'audit.list',
    payload: params,
  });
}

/** Single audit row. `beforeJson` / `afterJson` arrive as JSON **strings** with
 *  secrets already replaced by `[REDACTED]` and long payloads truncated. */
export async function getAuditEntry(auditId: string): Promise<AuditEntry> {
  return apiClient<AuditEntry>({
    action: 'audit.get',
    payload: { auditId },
  });
}
