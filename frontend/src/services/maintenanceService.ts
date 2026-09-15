/* maintenanceService.ts — FE-06
 * api-contract.md §7.4: billing periods, demands, interest and adjustments.
 * Every amount returned here is server-computed; the UI only formats it (SRS §23). */

import { apiClient } from './apiClient';
import type {
  BillingPeriod,
  Demand,
  Adjustment,
  DemandGenerationResult,
} from '@/types/domain';
import type { Paginated, PaginationParams } from '@/types/api';

/* ── Billing periods ── */

export async function listPeriods(params: PaginationParams): Promise<Paginated<BillingPeriod>> {
  return apiClient<Paginated<BillingPeriod>>({ action: 'periods.list', payload: params });
}

/** Create the period row if it does not already exist. Idempotent on the server. */
export async function ensurePeriod(
  periodKey: string,
  clientRequestId: string,
): Promise<BillingPeriod> {
  return apiClient<BillingPeriod>({
    action: 'periods.ensure',
    payload: { periodKey, clientRequestId },
  });
}

export async function lockPeriod(
  periodKey: string,
  clientRequestId: string,
): Promise<BillingPeriod> {
  return apiClient<BillingPeriod>({
    action: 'periods.lock',
    payload: { periodKey, clientRequestId },
  });
}

/** Unlock requires a reason — the server rejects the call without one (SRS §4). */
export async function unlockPeriod(
  periodKey: string,
  reason: string,
  clientRequestId: string,
): Promise<BillingPeriod> {
  return apiClient<BillingPeriod>({
    action: 'periods.unlock',
    payload: { periodKey, reason, clientRequestId },
  });
}

/* ── Demands ── */

export async function listDemands(
  params: PaginationParams & { periodKey?: string; flatId?: string; statusKey?: string },
): Promise<Paginated<Demand>> {
  return apiClient<Paginated<Demand>>({ action: 'demands.list', payload: params });
}

export async function getDemand(demandId: string): Promise<Demand> {
  return apiClient<Demand>({ action: 'demands.get', payload: { demandId } });
}

/** Raise demands for every flat × charge type in the period.
 *
 * NOTE: the backend does **not** implement `dryRun` (verified in
 * `backend/src/MaintenanceService.gs` — the flag is never read). A successful call
 * therefore always writes rows. Do not promise the user a preview that cannot exist;
 * use `demandsSummary` / `listDemands` to describe the current state instead. */
export async function generateDemands(
  periodKey: string,
  clientRequestId: string,
  flatIds?: string[],
): Promise<DemandGenerationResult> {
  return apiClient<DemandGenerationResult>({
    action: 'demands.generate',
    payload: { periodKey, flatIds, clientRequestId },
  });
}

export async function cancelDemand(
  demandId: string,
  reason: string,
  clientRequestId: string,
): Promise<Demand> {
  return apiClient<Demand>({
    action: 'demands.cancel',
    payload: { demandId, reason, clientRequestId },
  });
}

export async function demandsSummary(periodKey?: string): Promise<unknown> {
  return apiClient({ action: 'demands.summary', payload: { periodKey } });
}

/* ── Interest ── */

/** Read-only preview of interest that would be applied. Never writes. */
export async function previewInterest(periodKey: string): Promise<unknown> {
  return apiClient({ action: 'interest.preview', payload: { periodKey } });
}

export async function applyInterest(
  periodKey: string,
  clientRequestId: string,
): Promise<unknown> {
  return apiClient({ action: 'interest.apply', payload: { periodKey, clientRequestId } });
}

/* ── Adjustments ── */

export async function listAdjustments(
  params: PaginationParams & { flatId?: string; periodKey?: string },
): Promise<Paginated<Adjustment>> {
  return apiClient<Paginated<Adjustment>>({ action: 'adjustments.list', payload: params });
}

/** The server requires a reason; never call this without one (SRS §4). */
export async function createAdjustment(data: {
  flatId: string;
  adjustmentType: string;
  amount: number;
  sign: 1 | -1;
  reason: string;
  periodKey?: string;
  demandId?: string;
  clientRequestId: string;
}): Promise<Adjustment> {
  return apiClient<Adjustment>({ action: 'adjustments.create', payload: data });
}
