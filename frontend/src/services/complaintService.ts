/* complaintService.ts — FE-07 */

import { apiClient } from './apiClient';
import type { Complaint, ComplaintUpdate } from '@/types/domain';
import type { PaginationParams } from '@/types/api';

interface PaginatedResponse<T> {
  items: T[];
  page: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}

export async function listComplaints(params: PaginationParams & { statusKey?: string; categoryId?: string; priorityKey?: string; flatId?: string }): Promise<PaginatedResponse<Complaint>> {
  return apiClient({ action: 'complaints.list', payload: params });
}

export async function getComplaint(complaintId: string): Promise<Complaint & { updates: ComplaintUpdate[] }> {
  return apiClient({ action: 'complaints.get', payload: { complaintId } });
}

export async function createComplaint(data: Record<string, unknown>): Promise<Complaint> {
  return apiClient({ action: 'complaints.create', payload: data });
}

export async function assignComplaint(complaintId: string, data: Record<string, unknown>): Promise<Complaint> {
  return apiClient({ action: 'complaints.assign', payload: { complaintId, ...data } });
}

export async function transitionComplaint(complaintId: string, statusKey: string, remarks: string, correctiveAction?: string): Promise<Complaint> {
  return apiClient({ action: 'complaints.transition', payload: { complaintId, statusKey, remarks, correctiveAction } });
}
