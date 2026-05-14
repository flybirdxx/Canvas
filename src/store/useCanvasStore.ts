import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import type { CanvasState } from './types';
import { createElementSlice } from './slices/elementSlice';
import { createConnectionSlice } from './slices/connectionSlice';
import { createHistorySlice } from './slices/historySlice';
import { createUISlice } from './slices/uiSlice';
import { migrateCanvasPersistedState } from './migrations';

export type { HistorySnapshot, DrawingConnection, InpaintMaskState, GroupRecord, CanvasState } from './types';

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
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
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
      version: 11,
      storage: createJSONStorage(() => createThrottledLocalStorage(300)),
      partialize: (state) => ({
        elements: state.elements,
        connections: state.connections,
        stageConfig: state.stageConfig,
        lastSavedAt: state.lastSavedAt,
        viewMode: state.viewMode,
        groups: state.groups,
      }),
      migrate: migrateCanvasPersistedState,
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

useCanvasStore.subscribe((state, prev) => {
  const changed =
    state.elements !== prev.elements ||
    state.connections !== prev.connections ||
    state.stageConfig !== prev.stageConfig;
  if (changed) {
    useCanvasStore.setState({ lastSavedAt: Date.now() });
  }
});
