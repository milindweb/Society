/* backupService.ts — Backup, Archive & Audit API actions (api-contract.md §7.9) */

import { apiClient } from './apiClient';
import { generateClientId } from '@/lib/idempotency';
import type { Paginated, PaginationParams } from '@/types/api';
import type { Backup, AuditEntry, ArchiveEntry } from '@/types/domain';

/* ── Backup ── */

export type BackupScope = 'FULL' | 'CONFIG' | 'FINANCE' | 'OPERATIONS';

export interface BackupCreatePayload {
  scope: BackupScope;
  notes?: string;
}

export async function createBackup(payload: BackupCreatePayload): Promise<Backup> {
  return apiClient<Backup>({
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
  entity?: string;
  olderThanMonths?: number;
  dryRun?: boolean;
}

export interface ArchiveRunResult {
  movedCount: number;
  skippedCount: number;
  jobs: ArchiveRunJob[];
}

export interface ArchiveRunJob {
  entity: string;
  moved: number;
  skipped: number;
}

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

export async function listAuditEntries(
  params?: PaginationParams & {
    entity?: string;
    entityId?: string;
    action?: string;
    from?: string;
    to?: string;
    actorUserId?: string;
  },
): Promise<Paginated<AuditEntry>> {
  return apiClient<Paginated<AuditEntry>>({
    action: 'audit.list',
    payload: params,
  });
}

export async function getAuditEntry(auditId: string): Promise<AuditEntry> {
  return apiClient<AuditEntry>({
    action: 'audit.get',
    payload: { auditId },
  });
}
