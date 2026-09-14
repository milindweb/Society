/* configService.ts — config API actions (api-contract.md §7.2) */

import { apiClient } from './apiClient';
import type { SocietyConfig, ConfigEnums, ConfigEntity } from '@/types/domain';

export async function getConfig(): Promise<SocietyConfig> {
  return apiClient<SocietyConfig>({ action: 'config.get' });
}

export async function getEnums(): Promise<ConfigEnums> {
  return apiClient<ConfigEnums>({ action: 'config.enums' });
}

export async function getEntityMeta(entity?: string): Promise<ConfigEntity | ConfigEntity[]> {
  return apiClient<ConfigEntity | ConfigEntity[]>({
    action: 'config.entityMeta',
    payload: entity ? { entity } : undefined,
  });
}

export async function updateConfig(values: Record<string, unknown>): Promise<{ updated: number; config: SocietyConfig }> {
  return apiClient({ action: 'config.update', payload: { values } });
}
