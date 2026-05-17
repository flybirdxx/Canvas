/**
 * UISlice — transient UI state that doesn't belong to elements or history.
 *
 * Everything in here is either impermanent (selection, drawing state,
 * inpaint mask) or persisted but not part of the core domain model
 * (stageConfig, activeTool, viewMode, groups).
 */
import type { StateCreator } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { CanvasState, DrawingConnection, InpaintMaskState, GroupRecord } from '@/store/types';
import { snapshot, MAX_HISTORY } from '@/store/helpers';

export interface UISlice {
  selectedIds: string[];
  stageConfig: { scale: number; x: number; y: number };
  activeTool: CanvasState['activeTool'];
  drawingConnection: DrawingConnection | null;
  inpaintMask: InpaintMaskState | null;
  viewMode: 'canvas';
  groups: GroupRecord[];
  lastSavedAt: number | null;
  setSelection: (ids: string[]) => void;
  setStageConfig: (config: Partial<{ scale: number; x: number; y: number }>) => void;
  setActiveTool: (tool: CanvasState['activeTool']) => void;
  setDrawingConnection: (drawing: DrawingConnection | null) => void;
  setInpaintMask: (state: InpaintMaskState | null) => void;
  groupSelected: () => void;
  createGroupFromIds: (id: string, childIds: string[], label?: string) => void;
  ungroupSelected: () => void;
  setViewMode: (mode: 'canvas') => void;
}

export const createUISlice: StateCreator<CanvasState, [], [], UISlice> = (set) => ({
  selectedIds: [],
  stageConfig: { scale: 1, x: 0, y: 0 },
  activeTool: 'select',
  drawingConnection: null,
  inpaintMask: null,
  viewMode: 'canvas',
  groups: [],
  lastSavedAt: null,

  setSelection: (ids) => set({ selectedIds: ids }),

  setStageConfig: (config) => set((state) => ({
    stageConfig: { ...state.stageConfig, ...config },
  })),

  setActiveTool: (tool) => set({ activeTool: tool }),

  setDrawingConnection: (drawing) => set({ drawingConnection: drawing }),

  setInpaintMask: (state) => set({ inpaintMask: state }),

  groupSelected: () => set((state) => {
    if (state.selectedIds.length < 2) return state;

    const cleanIds = [...new Set(state.selectedIds)];
    const groupsCopy = state.groups.map(g => ({ ...g, childIds: [...g.childIds] }));
    for (const g of groupsCopy) {
      const overlap = g.childIds.filter(id => cleanIds.includes(id));
      if (overlap.length > 0) {
        g.childIds = g.childIds.filter(id => !cleanIds.includes(id));
      }
    }
    const survivingGroups = groupsCopy.filter(g => g.childIds.length >= 2);

    const newGroup: GroupRecord = { id: uuidv4(), childIds: cleanIds };

    return {
      past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
      future: [],
      groups: [...survivingGroups, newGroup],
      currentLabel: `成组 ${cleanIds.length} 个元素`,
      currentTimestamp: Date.now(),
      _coalesceKey: undefined,
      _coalesceAt: undefined,
    };
  }),

  createGroupFromIds: (id, childIds, label) => set((state) => {
    const normalizedLabel = label || undefined;
    const elementIds = new Set(state.elements.map(el => el.id));
    const cleanIds = [...new Set(childIds)].filter(childId => elementIds.has(childId));
    if (cleanIds.length < 2) return state;

    const existingGroup = state.groups.find(group => group.id === id);
    const survivingGroups = state.groups
      .filter(group => group.id !== id)
      .map(group => ({
        ...group,
        childIds: group.childIds.filter(childId => !cleanIds.includes(childId)),
      }))
      .filter(group => group.childIds.length >= 2);

    const otherGroupsUnchanged = groupsEqual(
      survivingGroups,
      state.groups.filter(group => group.id !== id),
    );
    if (
      existingGroup &&
      arraysEqual(existingGroup.childIds, cleanIds) &&
      existingGroup.label === normalizedLabel &&
      otherGroupsUnchanged
    ) {
      return state;
    }

    const newGroup: GroupRecord = normalizedLabel
      ? { id, childIds: cleanIds, label: normalizedLabel }
      : { id, childIds: cleanIds };

    return {
      past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
      future: [],
      groups: [...survivingGroups, newGroup],
      currentLabel: `成组 ${cleanIds.length} 个元素`,
      currentTimestamp: Date.now(),
      _coalesceKey: undefined,
      _coalesceAt: undefined,
    };
  }),

  ungroupSelected: () => set((state) => {
    const matchedGroups = state.groups.filter(g =>
      g.childIds.some(id => state.selectedIds.includes(id)),
    );
    if (matchedGroups.length === 0) return state;

    return {
      past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
      future: [],
      groups: state.groups.filter(g => !matchedGroups.some(m => m.id === g.id)),
      selectedIds: state.selectedIds,
      currentLabel: '解组',
      currentTimestamp: Date.now(),
      _coalesceKey: undefined,
      _coalesceAt: undefined,
    };
  }),

  setViewMode: (mode) => set({ viewMode: mode }),
});

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function groupsEqual(left: GroupRecord[], right: GroupRecord[]): boolean {
  return left.length === right.length && left.every((group, index) => {
    const other = right[index];
    return group.id === other.id &&
      group.label === other.label &&
      arraysEqual(group.childIds, other.childIds);
  });
}
