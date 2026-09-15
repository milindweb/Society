/* parkingService.ts — FE-09 parking (SRS §10)
 * Verified against backend/src/{ParkingService,Routes,Schema}.gs.
 *
 * Server-enforced rules the UI must respect:
 * - `parking.allocations.create` requires parkingSlotId + flatId + allocationType
 *   + startDate + clientRequestId. It REFUSES a slot or a vehicle that already has
 *   an ACTIVE allocation, answering `CONFLICT_ERROR` with a message — the UI shows
 *   that message inline rather than guessing.
 * - Creating an allocation also flips the slot to statusKey ALLOCATED, and
 *   `parking.allocations.end` flips it back to AVAILABLE once no active allocation
 *   remains on that slot. The slot status is therefore server-owned; the UI never
 *   writes it.
 * - `parking.allocations.end` requires endDate + clientRequestId and refuses an
 *   allocation that is not ACTIVE ("Allocation is not active.").
 * - `parking.allocations.list` filters on parkingSlotId, flatId and statusKey.
 *   There is NO search box and NO date-range filter server-side.
 * - `monthlyCharge` is stored as a STRING (`ParkingService.gs:129`).
 *
 * ⚠️ There is NO parking-slot API. `ParkingService` exposes only the four routes
 * above plus `summary`; the `Parking_Slots` sheet is mastered through the config
 * screen (`config.entity.*` with the `parkingSlots` entity). `ParkingSlotsPage`
 * consequently reads slots via `config.entity.list` — do not look for
 * `parking.slots.list` here, it does not exist. */

import { apiClient } from './apiClient';
import type { ParkingAllocation, ParkingSummary } from '@/types/domain';
import type { Paginated, PaginationParams } from '@/types/api';

export interface AllocationFilters extends PaginationParams {
  parkingSlotId?: string;
  flatId?: string;
  statusKey?: string;
}

export async function listAllocations(
  params: AllocationFilters,
): Promise<Paginated<ParkingAllocation>> {
  return apiClient<Paginated<ParkingAllocation>>({
    action: 'parking.allocations.list',
    payload: params,
  });
}

export async function getAllocation(allocationId: string): Promise<ParkingAllocation> {
  return apiClient<ParkingAllocation>({
    action: 'parking.allocations.get',
    payload: { allocationId },
  });
}

/** The four fields the route validator insists on, plus the optional extras. */
export interface CreateAllocationInput {
  parkingSlotId: string;
  flatId: string;
  /** PERMANENT | TEMPORARY. */
  allocationType: string;
  startDate: string;
  memberId?: string;
  vehicleId?: string;
  vehicleNumber?: string;
  /** A TEMPORARY allocation is expected to carry one. */
  endDate?: string;
  monthlyCharge?: string;
  remarks?: string;
  clientRequestId: string;
}

export async function createAllocation(
  data: CreateAllocationInput,
): Promise<ParkingAllocation> {
  return apiClient<ParkingAllocation>({
    action: 'parking.allocations.create',
    payload: data,
  });
}

export interface EndAllocationInput {
  allocationId: string;
  /** Required by the route validator. */
  endDate: string;
  /** Stored in the allocation's `remarks` column. */
  reason?: string;
  clientRequestId: string;
}

export async function endAllocation(data: EndAllocationInput): Promise<ParkingAllocation> {
  return apiClient<ParkingAllocation>({
    action: 'parking.allocations.end',
    payload: data,
  });
}

/** Slot counts and the active monthly charge total — computed server-side. */
export async function getParkingSummary(): Promise<ParkingSummary> {
  return apiClient<ParkingSummary>({ action: 'parking.summary' });
}

/* ── Mirrors of the service's own rules ─────────────────────────────────── */

/** From `SchemaMeta.ENUM_OPTIONS.ALLOCATION_TYPE`.
 * Also available config-driven via `useEnumOptions('ALLOCATION_TYPE')`; declared
 * here only so the service's own validation can be mirrored without a hook. */
export const ALLOCATION_TYPES = ['PERMANENT', 'TEMPORARY'] as const;

/** `parking.allocations.end` refuses anything that is not ACTIVE. */
export function canEndAllocation(statusKey: string): boolean {
  return statusKey === 'ACTIVE';
}

/** A slot can only take a new allocation when it is free. `BLOCKED` and
 * `MAINTENANCE` are deliberate, so they are not offered. */
export function isSlotAllocatable(statusKey: string): boolean {
  return statusKey === 'AVAILABLE';
}

/** The server rejects a `parking.allocations.create` with a taken slot or
 * vehicle using this code, so the UI can anchor the message to the right field. */
export function isConflictError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === 'CONFLICT_ERROR';
}
