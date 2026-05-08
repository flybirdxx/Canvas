import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { CanvasState } from './types';
import { createElementSlice } from './slices/elementSlice';
import { createConnectionSlice } from './slices/connectionSlice';
import { createHistorySlice } from './slices/historySlice';
import { createUISlice } from './slices/uiSlice';

// Re-export shared types for backward compat — all consumers import from
// 'src/store/useCanvasStore' directly. These re-exports keep existing
// imports (like InfiniteCanvas importing HistorySnapshot) working.
export type { HistorySnapshot, DrawingConnection, InpaintMaskState, GroupRecord, CanvasState } from './types';

/**
 * Throttled localStorage adapter.
 *
 * Background: zustand persist defaults to `JSON.stringify` + `localStorage.setItem`
 * after every `set()`, which, when elements contain multi-MB data URLs
 * (images/videos/file nodes), can cause frame drops during drag operations.
 *
 * Last-write-wins debounce strategy:
 * - `setItem` records the pending write and starts a 300ms timer
 * - subsequent writes overwrite the pending data within the window
 * - timer fires → real `localStorage.setItem` + clears pending
 * - `removeItem` runs synchronously and cancels any pending write
 * - `beforeunload` + `pagehide` force-flush to avoid data loss on tab close
 */
function createThrottledLocalStorage(delayMs: number): StateStorage {
  let pending: { key: string; value: string } | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (pending) {
      try {
        localStorage.setItem(pending.key, pending.value);
      } catch (err) {
        console.warn('[canvas-store] persist flush failed', err);
      }
      pending = null;
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
  }

  return {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => {
      pending = { key, value };
      if (timerId !== null) clearTimeout(timerId);
      timerId = setTimeout(flush, delayMs);
    },
    removeItem: (key) => {
      if (timerId !== null) { clearTimeout(timerId); timerId = null; }
      pending = null;
      localStorage.removeItem(key);
    },
  };
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (...args) => ({
      ...createElementSlice(...args),
      ...createConnectionSlice(...args),
      ...createHistorySlice(...args),
      ...createUISlice(...args),
    }),
    {
      name: 'ai-canvas-document',
      version: 9,
      storage: createJSONStorage(() => createThrottledLocalStorage(300)),
      partialize: (state) => ({
        elements: state.elements,
        connections: state.connections,
        stageConfig: state.stageConfig,
        lastSavedAt: state.lastSavedAt,
        viewMode: state.viewMode,
        groups: state.groups,
      }),
      migrate: (persistedState: any, version: number) => {
        // v1 -> v2: bump image/video node minimum dimensions
        if (version < 2 && persistedState && Array.isArray(persistedState.elements)) {
          const MIN_W = 340;
          const MIN_H = 260;
          persistedState.elements = persistedState.elements.map((el: any) => {
            if (!el || (el.type !== 'image' && el.type !== 'video')) return el;
            if (typeof el.width !== 'number' || typeof el.height !== 'number') return el;
            if (el.width < MIN_W || el.height < MIN_H) {
              return { ...el, width: Math.max(el.width, 400), height: Math.max(el.height, 300) };
            }
            return el;
          });
        }
        // v2 -> v3: add image input port to existing image nodes (F14)
        if (version < 3 && persistedState && Array.isArray(persistedState.elements)) {
          persistedState.elements = persistedState.elements.map((el: any) => {
            if (!el || el.type !== 'image') return el;
            const inputs = Array.isArray(el.inputs) ? el.inputs : [];
            const hasImageInput = inputs.some((p: any) => p && p.type === 'image');
            if (hasImageInput) return el;
            return { ...el, inputs: [...inputs, { id: uuidv4(), type: 'image', label: 'Ref' }] };
          });
        }
        // v4 -> v5: 'file' type introduced — no migration needed
        if (version < 5 && persistedState) { /* no-op */ }
        // v5 -> v6: FileElement extended fields (thumbnail/duration/pageCount) — no backfill
        if (version < 6 && persistedState) { /* no-op */ }
        // v6 -> v7: blob persistence migration (large files → IndexedDB)
        if (version < 7 && persistedState && Array.isArray(persistedState.elements)) {
          const toMigrate: Array<{ id: string; dataUrl: string }> = [];
          persistedState.elements.forEach((el: any) => {
            if (
              el?.type === 'file' &&
              el?.persistence === 'data' &&
              el?.src &&
              el?.sizeBytes > 1 * 1024 * 1024
            ) {
              toMigrate.push({ id: el.id, dataUrl: el.src });
            }
          });
          if (toMigrate.length > 0) {
            window.__canvasBlobMigration = toMigrate;
          }
        }
        // v3 -> v4 (executed after v2→v3 in migrate chain): widen narrow nodes
        if (version < 4 && persistedState && Array.isArray(persistedState.elements)) {
          const MIN_BY_TYPE: Record<string, number> = { image: 480, video: 520 };
          persistedState.elements = persistedState.elements.map((el: any) => {
            if (!el || typeof el.width !== 'number' || typeof el.height !== 'number') return el;
            const minW = MIN_BY_TYPE[el.type];
            if (!minW || el.width >= minW) return el;
            const scale = minW / el.width;
            return { ...el, width: minW, height: Math.round(el.height * scale) };
          });
        }
        // v7 -> v8: AD2 viewMode — default to 'canvas' for old saves
        if (version < 8 && persistedState) {
          if (typeof persistedState.viewMode !== 'string') {
            persistedState.viewMode = 'canvas';
          }
        }
        // v8 -> v9: FR1 grouping — init empty groups array
        if (version < 9 && persistedState) {
          if (!Array.isArray(persistedState.groups)) {
            persistedState.groups = [];
          }
        }
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.past = [];
          state.future = [];
          state.currentLabel = '初始状态';
          state.currentTimestamp = Date.now();
          state.drawingConnection = null;
          state.selectedIds = [];
          state.inpaintMask = null;
        }
      },
    },
  ),
);

// Track auto-save timestamps whenever persisted slices change.
// Safe for re-entrant calls: only mutates lastSavedAt, leaving
// elements/connections/stageConfig references identical.
useCanvasStore.subscribe((state, prev) => {
  const changed =
    state.elements !== prev.elements ||
    state.connections !== prev.connections ||
    state.stageConfig !== prev.stageConfig;
  if (changed) {
    useCanvasStore.setState({ lastSavedAt: Date.now() });
  }
});
