import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * A single entry in the user's asset library. Covers both generated outputs
 * (images produced by the AI gateway) and uploaded local media. `src` is
 * normalized to something directly usable in an <img>/<video>/<audio> tag —
 * typically a data URL (for uploads + snapshotted generations) or an https
 * URL (for provider responses that return hosted URLs).
 *
 * IMPORTANT: we do NOT persist `blob:` URLs — they are session-local and
 * become dead after reload. Callers that have a blob must convert to dataURL
 * before calling addAsset.
 */
export interface AssetEntry {
  id: string;
  kind: 'image' | 'video' | 'audio';
  src: string;
  name: string;
  /** Original prompt, set only for generated images. */
  prompt?: string;
  width?: number;
  height?: number;
  source: 'generated' | 'uploaded';
  createdAt: number;
  favorited?: boolean;
}

/** Maximum number of non-favorited assets to retain. Favorites never evict. */
const SOFT_CAP = 60;

interface AssetLibraryState {
  assets: AssetEntry[];

  addAsset: (entry: Omit<AssetEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => string;
  removeAsset: (id: string) => void;
  toggleFavorite: (id: string) => void;
  renameAsset: (id: string, name: string) => void;
  clearAll: () => void;
  findAsset: (id: string) => AssetEntry | undefined;
}

function genId(): string {
  // avoid importing uuid here — tiny id is enough for local library keys
  return `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useAssetLibraryStore = create<AssetLibraryState>()(
  persist(
    (set, get) => ({
      assets: [],

      addAsset: (entry) => {
        const id = entry.id ?? genId();
        const createdAt = entry.createdAt ?? Date.now();
        // Skip persisting blob: URLs since they won't survive reload.
        if (entry.src.startsWith('blob:')) {
          console.warn('[AssetLibrary] refusing to persist blob: URL; convert to data URL first.');
          return id;
        }
        const next: AssetEntry = {
          ...entry,
          id,
          createdAt,
          favorited: entry.favorited ?? false,
        };
        set((state) => {
          const withNew = [next, ...state.assets];
          // LRU: if over cap, drop oldest non-favorited until under cap.
          if (withNew.length > SOFT_CAP) {
            const keep: AssetEntry[] = [];
            const sortedOldestLast = [...withNew].sort((a, b) => b.createdAt - a.createdAt);
            let nonFavKept = 0;
            for (const a of sortedOldestLast) {
              if (a.favorited) {
                keep.push(a);
              } else if (nonFavKept < SOFT_CAP - sortedOldestLast.filter(x => x.favorited).length) {
                keep.push(a);
                nonFavKept++;
              }
            }
            // Preserve newest-first ordering for display consistency.
            keep.sort((a, b) => b.createdAt - a.createdAt);
            return { assets: keep };
          }
          return { assets: withNew };
        });
        return id;
      },

      removeAsset: (id) =>
        set((state) => ({ assets: state.assets.filter(a => a.id !== id) })),

      toggleFavorite: (id) =>
        set((state) => ({
          assets: state.assets.map(a =>
            a.id === id ? { ...a, favorited: !a.favorited } : a,
          ),
        })),

      renameAsset: (id, name) =>
        set((state) => ({
          assets: state.assets.map(a => (a.id === id ? { ...a, name } : a)),
        })),

      clearAll: () => set({ assets: [] }),

      findAsset: (id) => get().assets.find(a => a.id === id),
    }),
    {
      name: 'canvas-asset-library',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
