/* visitorService.ts — FE-07 visitors
 * Verified against backend/src/{VisitorService,Routes}.gs.
 *
 * Server-enforced rules the UI must respect:
 * - `visitors.create` requires visitorName, mobile, visitorTypeId, purpose,
 *   flatId + clientRequestId, and sets statusKey INSIDE with a generated passNumber.
 * - `visitors.exit` requires visitorId + clientRequestId, and REJECTS a visitor
 *   that has already exited ("Visitor has already exited.").
 * - `visitors.list` accepts statusKey / flatId / typeKey only — there is no
 *   server-side date-range filter, so any date range is applied client-side. */

import { apiClient } from './apiClient';
import type { Visitor, VisitorSummary } from '@/types/domain';
import type { Paginated, PaginationParams } from '@/types/api';

export interface VisitorFilters extends PaginationParams {
  statusKey?: string;
  flatId?: string;
  /** The server maps this to `visitorTypeId`. */
  typeKey?: string;
}

export async function listVisitors(params: VisitorFilters): Promise<Paginated<Visitor>> {
  return apiClient<Paginated<Visitor>>({ action: 'visitors.list', payload: params });
}

export async function getVisitor(visitorId: string): Promise<Visitor> {
  return apiClient<Visitor>({ action: 'visitors.get', payload: { visitorId } });
}

export interface CreateVisitorInput {
  visitorName: string;
  mobile: string;
  visitorTypeId: string;
  purpose: string;
  flatId: string;
  memberId?: string;
  residentName?: string;
  vehicleNumber?: string;
  /** Coerced to a string server-side; send a number. */
  personCount?: number;
  entryGate?: string;
  remarks?: string;
  loggedByEmployeeId?: string;
  clientRequestId: string;
}

export async function createVisitor(data: CreateVisitorInput): Promise<Visitor> {
  return apiClient<Visitor>({ action: 'visitors.create', payload: data });
}

export interface ExitVisitorInput {
  visitorId: string;
  exitGate?: string;
  remarks?: string;
  clientRequestId: string;
}

export async function exitVisitor(data: ExitVisitorInput): Promise<Visitor> {
  return apiClient<Visitor>({ action: 'visitors.exit', payload: data });
}

export async function visitorSummary(): Promise<VisitorSummary> {
  return apiClient<VisitorSummary>({ action: 'visitors.summary', payload: {} });
}
