/* complaintService.ts — FE-07 complaints
 * Verified against backend/src/{ComplaintService,Routes}.gs.
 *
 * Server-enforced rules the UI must respect:
 * - `complaints.create` requires categoryId, priorityKey, title + clientRequestId.
 * - `complaints.get` returns `{ complaint, updates }` — NOT a bare complaint.
 * - `complaints.transition` only allows the legal next statuses in the backend's
 *   TRANSITIONS map, and additionally requires `correctiveAction` AND `remarks`
 *   when the target is RESOLVED.
 * - `complaints.assign` requires assignedToType + assignedToId + clientRequestId.
 * - `COMPLAINT_TRANSITIONS` below mirrors the server map so the UI can offer only
 *   what the server will accept. It is a *mirror*, not the authority — a rejected
 *   transition still surfaces the server's own message. */

import { apiClient } from './apiClient';
import type {
  Complaint,
  ComplaintDetail,
  ComplaintSummary,
  ComplaintUpdate,
} from '@/types/domain';
import type { Paginated, PaginationParams } from '@/types/api';

export interface ComplaintFilters extends PaginationParams {
  statusKey?: string;
  categoryId?: string;
  priorityKey?: string;
  flatId?: string;
}

/** Mirror of ComplaintService.gs TRANSITIONS (statusKey -> legal next statuses). */
export const COMPLAINT_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  IN_PROGRESS: ['ASSIGNED', 'RESOLVED', 'REOPENED', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  CANCELLED: [],
};

/** Legal next statuses for the current status. Empty for terminal states.
 *
 * Returns a fresh array and never `undefined`, so callers can safely do
 * `.length` / `.includes` without a guard — an unknown or missing statusKey
 * yields "no transitions", which is the safe default (the server remains the
 * authority and would reject anything illegal anyway). */
export function nextStatuses(currentStatusKey: string): string[] {
  return COMPLAINT_TRANSITIONS[currentStatusKey] ?? [];
}

/** Resolving additionally needs a corrective action and resolution remarks. */
export function requiresResolutionDetail(statusKey: string): boolean {
  return statusKey === 'RESOLVED';
}

export async function listComplaints(params: ComplaintFilters): Promise<Paginated<Complaint>> {
  return apiClient<Paginated<Complaint>>({ action: 'complaints.list', payload: params });
}

export async function getComplaint(complaintId: string): Promise<ComplaintDetail> {
  return apiClient<ComplaintDetail>({ action: 'complaints.get', payload: { complaintId } });
}

export interface CreateComplaintInput {
  categoryId: string;
  priorityKey: string;
  title: string;
  description?: string;
  flatId?: string;
  memberId?: string;
  source?: string;
  attachmentRef?: string;
  clientRequestId: string;
}

export async function createComplaint(data: CreateComplaintInput): Promise<Complaint> {
  return apiClient<Complaint>({ action: 'complaints.create', payload: data });
}

/** Whitelisted server-side: description, priorityKey, categoryId, title, attachmentRef. */
export interface UpdateComplaintInput {
  complaintId: string;
  description?: string;
  priorityKey?: string;
  categoryId?: string;
  title?: string;
  attachmentRef?: string;
  clientRequestId: string;
}

export async function updateComplaint(data: UpdateComplaintInput): Promise<Complaint> {
  return apiClient<Complaint>({ action: 'complaints.update', payload: data });
}

export interface AssignComplaintInput {
  complaintId: string;
  assignedToType: string;
  assignedToId: string;
  targetDate?: string;
  remarks?: string;
  clientRequestId: string;
}

export async function assignComplaint(data: AssignComplaintInput): Promise<Complaint> {
  return apiClient<Complaint>({ action: 'complaints.assign', payload: data });
}

export interface TransitionComplaintInput {
  complaintId: string;
  statusKey: string;
  /** `remarks` is required by the route validator for every transition. */
  remarks: string;
  /** Required by the service when statusKey is RESOLVED. */
  correctiveAction?: string;
  clientRequestId: string;
}

export async function transitionComplaint(data: TransitionComplaintInput): Promise<Complaint> {
  return apiClient<Complaint>({ action: 'complaints.transition', payload: data });
}

export async function complaintHistory(
  complaintId: string,
  params: PaginationParams = {},
): Promise<Paginated<ComplaintUpdate>> {
  return apiClient<Paginated<ComplaintUpdate>>({
    action: 'complaints.history',
    payload: { complaintId, ...params },
  });
}

export async function complaintSummary(): Promise<ComplaintSummary> {
  return apiClient<ComplaintSummary>({ action: 'complaints.summary', payload: {} });
}
