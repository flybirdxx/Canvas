import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ApiProvider {
  apiKey: string;
  baseUrl: string;
}

interface SettingsState {
  providers: Record<string, ApiProvider>;
  updateProvider: (providerId: string, settings: Partial<ApiProvider>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      providers: {
        t8star: {
          apiKey: '',
          baseUrl: 'https://ai.t8star.cn',
        },
        openai: {
          apiKey: '',
          baseUrl: 'https://api.openai.com/v1',
        },
        anthropic: {
          apiKey: '',
          baseUrl: 'https://api.anthropic.com',
        },
      },
      updateProvider: (providerId, settings) =>
        set((state) => ({
          providers: {
            ...state.providers,
            [providerId]: {
              ...state.providers[providerId],
              ...settings,
            },
          },
        })),
    }),
    {
      name: 'canvas-api-settings', // unique name for localStorage key
    }
  )
);
