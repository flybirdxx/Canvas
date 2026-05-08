import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface GenHistoryEntry {
  id: string;
  /** Which element this generation produced (image/video node id). */
  elementId: string;
  /** Prompt used. */
  prompt: string;
  /** Model wire-level id. */
  model: string;
  /** Thumbnail data URL (or the result image URL itself). */
  thumbnailUrl: string;
  /** Result URLs. */
  resultUrls: string[];
  modality: 'image' | 'video' | 'text';
  /** epoch ms. */
  createdAt: number;
}

interface GenHistoryState {
  entries: GenHistoryEntry[];
  addEntry: (entry: Omit<GenHistoryEntry, 'createdAt'>) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
}

export const useGenerationHistoryStore = create<GenHistoryState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) =>
        set((s) => ({
          entries: [{ ...entry, createdAt: Date.now() }, ...s.entries].slice(0, 200),
        })),
      removeEntry: (id) =>
        set((s) => ({
          entries: s.entries.filter((e) => e.id !== id),
        })),
      clearAll: () => set({ entries: [] }),
    }),
    {
      name: 'ai-canvas-gen-history',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ entries: s.entries }),
    },
  ),
);
