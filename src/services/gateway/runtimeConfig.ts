import { useSettingsStore } from '@/store/useSettingsStore';
import type { ProviderRuntimeConfig } from './types';

export function readProviderConfig(providerId: string): ProviderRuntimeConfig {
  const config = useSettingsStore.getState().providers[providerId];
  if (!config) return { apiKey: '', baseUrl: '' };
  return { apiKey: config.apiKey, baseUrl: config.baseUrl };
}
