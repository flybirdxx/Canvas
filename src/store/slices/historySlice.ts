/**
 * HistorySlice — undo/redo stack + coalescing internals.
 */
import type { StateCreator } from 'zustand';
import type { CanvasState, HistorySnapshot } from '@/store/types';
import { snapshot } from '@/store/helpers';

export interface HistorySlice {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  currentLabel: string;
  currentTimestamp: number;
  _coalesceKey?: string;
  _coalesceAt?: number;
  undo: () => void;
  redo: () => void;
  jumpToHistory: (index: number) => void;
  clearHistory: () => void;
}

export const createHistorySlice: StateCreator<CanvasState, [], [], HistorySlice> = (set) => ({
  past: [],
  future: [],
  currentLabel: '初始状态',
  currentTimestamp: Date.now(),

  undo: () => set((state) => {
    if (state.past.length === 0) return state;
    const newPast = [...state.past];
    const previousSnap = newPast.pop()!;
    return {
      past: newPast,
      future: [snapshot(state), ...state.future],
      elements: previousSnap.elements,
      connections: previousSnap.connections,
      groups: previousSnap.groups,
      currentLabel: previousSnap.label,
      currentTimestamp: previousSnap.timestamp,
      selectedIds: [],
      _coalesceKey: undefined,
      _coalesceAt: undefined,
    };
  }),

  redo: () => set((state) => {
    if (state.future.length === 0) return state;
    const newFuture = [...state.future];
    const nextSnap = newFuture.shift()!;
    return {
      past: [...state.past, snapshot(state)],
      future: newFuture,
      elements: nextSnap.elements,
      connections: nextSnap.connections,
      groups: nextSnap.groups,
      currentLabel: nextSnap.label,
      currentTimestamp: nextSnap.timestamp,
      selectedIds: [],
      _coalesceKey: undefined,
      _coalesceAt: undefined,
    };
  }),

  jumpToHistory: (index) => set((state) => {
    const total = state.past.length + 1 + state.future.length;
    if (index < 0 || index >= total) return state;
    const currentIdx = state.past.length;
    if (index === currentIdx) return state;

    const currentSnap = snapshot(state);
    const allSnaps: HistorySnapshot[] = [...state.past, currentSnap, ...state.future];
    const target = allSnaps[index];
    const newPast = allSnaps.slice(0, index);
    const newFuture = allSnaps.slice(index + 1);

    return {
      past: newPast,
      future: newFuture,
      elements: target.elements,
      connections: target.connections,
      groups: target.groups,
      currentLabel: target.label,
      currentTimestamp: target.timestamp,
      selectedIds: [],
      _coalesceKey: undefined,
      _coalesceAt: undefined,
    };
  }),

  clearHistory: () => set({
    past: [],
    future: [],
    _coalesceKey: undefined,
    _coalesceAt: undefined,
  }),
});
