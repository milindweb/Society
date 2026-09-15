/* useParkingLookups.ts — config-driven parking options (FE-09)
 * SRS §10 / §15: parking information is configurable and links to the Flat/Member
 * master. Nothing about slots, types or vehicles is hardcoded here.
 *
 * Sources, verified against backend/src/{Schema,SchemaMeta,ConfigService}.gs:
 *   parkingSlots   -> Parking_Slots   (parkingSlotId, slotNumber, parkingTypeId,
 *                                      wingId, floorLevel, location, statusKey)
 *   parkingTypes   -> Parking_Types   (parkingTypeId, typeKey, typeName)
 *   vehicles       -> Vehicles        (vehicleId, vehicleNumber, makeModel)
 *   ALLOCATION_TYPE enum              -> PERMANENT, TEMPORARY
 *   Status_Config PARKING_ALLOCATION  -> ACTIVE, ENDED
 *
 * ⚠️ Slots come from the CONFIG entity endpoint, not a parking route: the backend
 * has no `parking.slots.list`. See the note in `parkingService.ts`. */

import { useState, useEffect, useCallback } from 'react';
import { useEntityOptions, useStatusOptions, useEnumOptions } from '@/lib/useConfigOptions';
import * as configService from '@/services/configService';
import type { ParkingSlot, SelectOption } from '@/types/domain';

/** Parking slots, from `config.entity.list('parkingSlots')`.
 * The label shows the slot number and its location so a duplicate number in
 * another wing is still distinguishable. */
export function useParkingSlotOptions(): { options: SelectOption[]; loading: boolean } {
  const { options, loading } = useEntityOptions(
    'parkingSlots',
    ['parkingSlotId'],
    ['slotNumber'],
  );
  return { options, loading };
}

/** Parking types (SRS §10 "parking information should be configurable"). */
export function useParkingTypeOptions(): { options: SelectOption[]; loading: boolean } {
  const { options, loading } = useEntityOptions('parkingTypes', ['parkingTypeId'], ['typeName']);
  return { options, loading };
}

/** Vehicles, from `config.entity.list('vehicles')`. The vehicle number is the
 * only label a user recognises, so it is preferred over the row id. */
export function useVehicleOptions(): { options: SelectOption[]; loading: boolean } {
  const { options, loading } = useEntityOptions(
    'vehicles',
    ['vehicleId'],
    ['vehicleNumber', 'makeModel'],
  );
  return { options, loading };
}

/** PERMANENT | TEMPORARY, from `SchemaMeta.ENUM_OPTIONS.ALLOCATION_TYPE`. */
export function useAllocationTypeOptions(): { options: SelectOption[]; loading: boolean } {
  return useEnumOptions('ALLOCATION_TYPE');
}

/** Allocation statuses, from Status_Config domain **ALLOCATION**
 * (`Setup.gs:70` → ACTIVE, ENDED, CANCELLED). */
export function useAllocationStatusOptions(): { options: SelectOption[]; loading: boolean } {
  return useStatusOptions('ALLOCATION');
}

/** Slot statuses, from Status_Config domain **PARKING**
 * (`Setup.gs:69` → AVAILABLE, ALLOCATED, BLOCKED, MAINTENANCE). There is no
 * separate slot domain — `PARKING` is the slot lifecycle. */
export function useParkingSlotStatusOptions(): { options: SelectOption[]; loading: boolean } {
  return useStatusOptions('PARKING');
}

export interface UseParkingSlotsReturn {
  slots: ParkingSlot[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const SLOT_PAGE_SIZE = 200;

/** The slot master as ROWS, for the read-only slots screen.
 *
 * ⚠️ Read through `config.entity.list('parkingSlots')`, not a parking route:
 * `ParkingService` has no slot list (see the header of `parkingService.ts`).
 * `statusKey` is server-owned — `parking.allocations.create`/`.end` flip it — so
 * this hook only ever reads. */
export function useParkingSlots(): UseParkingSlotsReturn {
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await configService.listEntity<ParkingSlot>('parkingSlots', {
        page: 1,
        pageSize: SLOT_PAGE_SIZE,
      });
      setSlots(result.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the parking slots');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { slots, loading, error, reload: load };
}
