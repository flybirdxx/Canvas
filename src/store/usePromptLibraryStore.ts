import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { BUILTIN_PRESETS, PromptPreset } from '../data/promptLibrary';

const RECENT_LIMIT = 12;

interface PromptLibraryState {
  /** Preset IDs (built-in or custom) marked as favorite. */
  favorites: string[];
  /** User-created presets. */
  customPresets: PromptPreset[];
  /** Recently applied preset IDs, most-recent first. */
  recent: string[];

  toggleFavorite: (id: string) => void;
  addCustom: (preset: Omit<PromptPreset, 'isCustom'>) => void;
  removeCustom: (id: string) => void;
  pushRecent: (id: string) => void;

  /** Lookup a preset by id across built-in and custom. */
  findPreset: (id: string) => PromptPreset | undefined;
  /** All presets (built-in + custom). */
  getAllPresets: () => PromptPreset[];
}

export const usePromptLibraryStore = create<PromptLibraryState>()(
  persist(
    (set, get) => ({
      favorites: [],
      customPresets: [],
      recent: [],

      toggleFavorite: (id) =>
        set((state) => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter((f) => f !== id)
            : [...state.favorites, id],
        })),

      addCustom: (preset) =>
        set((state) => ({
          customPresets: [
            ...state.customPresets.filter((p) => p.id !== preset.id),
            { ...preset, isCustom: true },
          ],
        })),

      removeCustom: (id) =>
        set((state) => ({
          customPresets: state.customPresets.filter((p) => p.id !== id),
          favorites: state.favorites.filter((f) => f !== id),
          recent: state.recent.filter((r) => r !== id),
        })),

      pushRecent: (id) =>
        set((state) => ({
          recent: [id, ...state.recent.filter((r) => r !== id)].slice(0, RECENT_LIMIT),
        })),

      findPreset: (id) => {
        const { customPresets } = get();
        return (
          customPresets.find((p) => p.id === id) ||
          BUILTIN_PRESETS.find((p) => p.id === id)
        );
      },

      getAllPresets: () => {
        const { customPresets } = get();
        return [...BUILTIN_PRESETS, ...customPresets];
      },
    }),
    {
      name: 'canvas-prompt-library',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        favorites: state.favorites,
        customPresets: state.customPresets,
        recent: state.recent,
      }),
    }
  )
);
