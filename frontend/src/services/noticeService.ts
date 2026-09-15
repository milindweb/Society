/* noticeService.ts — FE-08 notices
 * Verified against backend/src/{CommunicationService,Routes,Schema}.gs.
 *
 * Server-enforced rules the UI must respect:
 * - `notices.create` requires title, noticeTypeId, noticeDate, description,
 *   audienceType + clientRequestId, and always creates with statusKey DRAFT.
 * - `notices.update` is DRAFT-ONLY; any other status returns
 *   "Only draft notices can be edited."
 * - `notices.publish` is DRAFT-ONLY; publishes the notice (DRAFT → PUBLISHED).
 * - `notices.unpublish` is PUBLISHED-ONLY and REQUIRES a `reason` (the route
 *   validator demands it; the service audits it).
 * - `notices.list` filters on noticeTypeId and isPublished only. It always sorts
 *   by noticeDate desc server-side. Search covers title/description/noticeNumber.
 * - `isPublished` / `isPinned` are stored as the STRINGS 'TRUE' / 'FALSE'. */

import { apiClient } from './apiClient';
import type { Notice, NoticeDetail } from '@/types/domain';
import type { Paginated, PaginationParams } from '@/types/api';

export interface NoticeFilters extends PaginationParams {
  noticeTypeId?: string;
  /** Sent to the server as 'TRUE' / 'FALSE'. */
  isPublished?: boolean;
}

export async function listNotices(params: NoticeFilters): Promise<Paginated<Notice>> {
  return apiClient<Paginated<Notice>>({ action: 'notices.list', payload: params });
}

export async function getNotice(noticeId: string): Promise<NoticeDetail> {
  return apiClient<NoticeDetail>({ action: 'notices.get', payload: { noticeId } });
}

/** `notices.create` — the five fields the route validator insists on. */
export interface CreateNoticeInput {
  title: string;
  noticeTypeId: string;
  noticeDate: string;
  description: string;
  audienceType: string;
  /** Role keys / wing ids / flat ids / member ids, comma-separated. */
  audienceRef?: string;
  expiryDate?: string;
  isPinned?: boolean;
  attachmentRef?: string;
  clientRequestId: string;
}

export async function createNotice(data: CreateNoticeInput): Promise<Notice> {
  return apiClient<Notice>({ action: 'notices.create', payload: data });
}

/** Only these fields can be patched; the service ignores anything else.
 * (`noticeTypeId` and `audienceType` are accepted too, and validated.) */
export interface UpdateNoticeInput {
  noticeId: string;
  title?: string;
  noticeTypeId?: string;
  noticeDate?: string;
  expiryDate?: string;
  description?: string;
  audienceType?: string;
  audienceRef?: string;
  isPinned?: boolean;
  attachmentRef?: string;
  clientRequestId: string;
}

export async function updateNotice(data: UpdateNoticeInput): Promise<Notice> {
  return apiClient<Notice>({ action: 'notices.update', payload: data });
}

export interface PublishNoticeInput {
  noticeId: string;
  /** Defaults to today server-side when omitted. */
  publishDate?: string;
  expiryDate?: string;
  clientRequestId: string;
}

export async function publishNotice(data: PublishNoticeInput): Promise<Notice> {
  return apiClient<Notice>({ action: 'notices.publish', payload: data });
}

export interface UnpublishNoticeInput {
  noticeId: string;
  /** Required by the route validator — an unpublish without a reason is rejected. */
  reason: string;
  clientRequestId: string;
}

export async function unpublishNotice(data: UnpublishNoticeInput): Promise<Notice> {
  return apiClient<Notice>({ action: 'notices.unpublish', payload: data });
}

/* ── Mirrors of the service's own rules, so the UI never offers an illegal action ──
 * The backend remains the authority; a rejection still surfaces its own message. */

/** DRAFT → PUBLISHED → DRAFT (unpublish). EXPIRED is applied by a backend job. */
export function canEditNotice(statusKey: string): boolean {
  return statusKey === 'DRAFT';
}

export function canPublishNotice(statusKey: string): boolean {
  return statusKey === 'DRAFT';
}

export function canUnpublishNotice(statusKey: string): boolean {
  return statusKey === 'PUBLISHED';
}

/** The sheet stores 'TRUE' / 'FALSE' strings; tolerate a real boolean too. */
export function isTrueFlag(value: unknown): boolean {
  return value === true || value === 'TRUE' || value === 'true';
}
