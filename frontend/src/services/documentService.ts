/* documentService.ts — FE-09 documents (the single central module, SRS §9)
 * Verified against backend/src/{DocumentService,Routes,Schema}.gs.
 *
 * Server-enforced rules the UI must respect:
 * - `documents.create` requires title + categoryId + clientRequestId. It writes
 *   METADATA ONLY — `fileRef` stays '' until a file is uploaded. SRS §9: Sheets
 *   hold metadata, Drive holds the binary.
 * - `documents.update` patches only: title, description, tags, linkedEntityType,
 *   linkedEntityId, categoryId, effectiveDate, expiryDate. Everything else
 *   (versionNo, fileRef, statusKey) is server-owned.
 * - `documents.archive` requires a `reason` and sets statusKey ARCHIVED +
 *   isArchived 'TRUE'. It REJECTS an already-archived document
 *   ("Document is already archived."). There is no un-archive.
 * - `documents.upload` requires categoryId + fileName + mimeType + base64, and
 *   takes an OPTIONAL documentId: with it, the existing document gets the new
 *   fileRef and its versionNo is incremented; without it, a whole new document is
 *   created (title defaults to the file name). It returns `{ fileRef, document }`
 *   — an object, not a bare document.
 * - `documents.list` filters on categoryId, linkedEntityType, linkedEntityId and
 *   statusKey, plus a client-side `includeArchived` toggle (archived rows are
 *   removed unless it is set). There is NO server-side search box.
 * - `fileRef` is a JSON STRING on the sheet, so it must be parsed to read the
 *   Drive URL (`parseFileRef` below).
 *
 * The plan's action names `documents.read` / `documents.write` do NOT exist in
 * `Routes.gs` — only the six above. */

import { apiClient } from './apiClient';
import type { Document, DocumentDetail, DocumentFileRef } from '@/types/domain';
import type { Paginated, PaginationParams } from '@/types/api';

export interface DocumentFilters extends PaginationParams {
  categoryId?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  /** When omitted the server drops ARCHIVED rows (SRS §9 "Archive"). */
  includeArchived?: boolean;
}

export async function listDocuments(params: DocumentFilters): Promise<Paginated<Document>> {
  return apiClient<Paginated<Document>>({ action: 'documents.list', payload: params });
}

export async function getDocument(documentId: string): Promise<DocumentDetail> {
  return apiClient<DocumentDetail>({ action: 'documents.get', payload: { documentId } });
}

/** Metadata-only create. The binary arrives later via `uploadDocument`. */
export interface CreateDocumentInput {
  title: string;
  categoryId: string;
  description?: string;
  tags?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  effectiveDate?: string;
  expiryDate?: string;
  clientRequestId: string;
}

export async function createDocument(data: CreateDocumentInput): Promise<Document> {
  return apiClient<Document>({ action: 'documents.create', payload: data });
}

/** The patchable surface; the service ignores anything else. */
export interface UpdateDocumentInput {
  documentId: string;
  title?: string;
  description?: string;
  tags?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  categoryId?: string;
  effectiveDate?: string;
  expiryDate?: string;
  clientRequestId: string;
}

export async function updateDocument(data: UpdateDocumentInput): Promise<Document> {
  return apiClient<Document>({ action: 'documents.update', payload: data });
}

export interface ArchiveDocumentInput {
  documentId: string;
  /** Required by the route validator. */
  reason: string;
  clientRequestId: string;
}

export async function archiveDocument(data: ArchiveDocumentInput): Promise<Document> {
  return apiClient<Document>({ action: 'documents.archive', payload: data });
}

export interface UploadDocumentInput {
  categoryId: string;
  fileName: string;
  mimeType: string;
  /** The base64 payload, WITHOUT a `data:` URL prefix (the server writes it
   * straight to Drive). */
  base64: string;
  /** Omit to create a new document; supply to attach the file to an existing one
   * (the server then increments its `versionNo`). */
  documentId?: string;
  description?: string;
  tags?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  effectiveDate?: string;
  expiryDate?: string;
  clientRequestId: string;
}

export interface UploadDocumentResult {
  fileRef: DocumentFileRef;
  document: Document;
}

export async function uploadDocument(data: UploadDocumentInput): Promise<UploadDocumentResult> {
  return apiClient<UploadDocumentResult>({ action: 'documents.upload', payload: data });
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

/** `fileRef` is a JSON string on the sheet; '' means nothing has been uploaded.
 * A malformed value is treated as absent rather than crashing the page. */
export function parseFileRef(raw?: string): DocumentFileRef | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DocumentFileRef>;
    return parsed && typeof parsed === 'object' && parsed.fileId
      ? (parsed as DocumentFileRef)
      : null;
  } catch {
    return null;
  }
}

/** The sheet stores 'TRUE' / 'FALSE'; tolerate a real boolean too. */
export function isTrueFlag(value: unknown): boolean {
  return value === true || value === 'TRUE' || value === 'true';
}

/** ARCHIVED is terminal — `documents.archive` refuses a second call. */
export function canArchiveDocument(statusKey: string): boolean {
  return statusKey !== 'ARCHIVED';
}

export function isArchivedDocument(doc: Pick<Document, 'statusKey'>): boolean {
  return doc.statusKey === 'ARCHIVED';
}

/** Strips a `data:` URL prefix if the caller produced one, so the server gets
 * raw base64. `FileReader.readAsDataURL` includes the prefix; `readAsBinaryString`
 * or a manual slice does not — this makes either source safe. */
export function stripDataUrlPrefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return dataUrl.startsWith('data:') && comma !== -1 ? dataUrl.slice(comma + 1) : dataUrl;
}

/** Human-readable byte size for the file panel. */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
