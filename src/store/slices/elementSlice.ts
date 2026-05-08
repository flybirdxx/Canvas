/**
 * ElementSlice — element CRUD + clearCanvas.
 *
 * The largest slice in the store. All element mutations push a history
 * snapshot (except updateElementPosition which is per-frame and doesn't
 * create undo entries — the batched version does).
 */
import type { StateCreator } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { CanvasElement } from '@/types/canvas';
import type { CanvasState } from '@/store/types';
import { snapshot, typeLabelMap, MAX_HISTORY, coalesceKey, COALESCE_WINDOW_MS } from '@/store/helpers';


export interface ElementSlice {
  elements: CanvasElement[];
  addElement: (element: CanvasElement) => void;
  updateElement: (id: string, attrs: Partial<CanvasElement>, label?: string) => void;
  updateElementPosition: (id: string, x: number, y: number) => void;
  batchUpdatePositions: (updates: { id: string; x: number; y: number }[], label?: string) => void;
  deleteElements: (ids: string[]) => void;
  replaceElement: (oldId: string, newElement: CanvasElement, label?: string) => void;
  clearCanvas: () => void;
}

export const createElementSlice: StateCreator<CanvasState, [], [], ElementSlice> = (set) => ({
  elements: [],

  addElement: (element) => set((state) => {
    const el = { ...element };
    if (!el.inputs) {
      el.inputs = [];
      if (el.type === 'image') {
        el.inputs.push({ id: uuidv4(), type: 'text', label: 'Prompt' });
        el.inputs.push({ id: uuidv4(), type: 'image', label: 'Ref' });
      }
      if (el.type === 'video') el.inputs.push({ id: uuidv4(), type: 'image', label: 'Image' });
      if (el.type === 'audio') el.inputs.push({ id: uuidv4(), type: 'text', label: 'Prompt' });
      if (el.type === 'rectangle' || el.type === 'circle' || el.type === 'sticky') {
        el.inputs.push({ id: uuidv4(), type: 'any', label: 'In' });
      }
    }

    if (!el.outputs) {
      el.outputs = [];
      if (el.type === 'text') el.outputs.push({ id: uuidv4(), type: 'text', label: 'Text' });
      if (el.type === 'image') el.outputs.push({ id: uuidv4(), type: 'image', label: 'Image' });
      if (el.type === 'video') el.outputs.push({ id: uuidv4(), type: 'video', label: 'Video' });
      if (el.type === 'audio') el.outputs.push({ id: uuidv4(), type: 'audio', label: 'Audio' });
      if (el.type === 'rectangle' || el.type === 'circle' || el.type === 'sticky') {
        el.outputs.push({ id: uuidv4(), type: 'any', label: 'Out' });
      }
      if (el.type === 'file') {
        const mt = String((el as any).mimeType || '').toLowerCase();
        if (mt.startsWith('image/')) {
          el.outputs.push({ id: uuidv4(), type: 'image', label: 'Image' });
        }
      }
    }

    const label = `添加${typeLabelMap[el.type] ?? el.type}`;
    return {
      past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
      future: [],
      elements: [...state.elements, el],
      currentLabel: label,
      currentTimestamp: Date.now(),
      _coalesceKey: undefined,
      _coalesceAt: undefined,
    };
  }),

  updateElement: (id, attrs, labelOverride) => set((state) => {
    const target = state.elements.find(el => el.id === id);
    const label = labelOverride ?? (target ? `修改${typeLabelMap[target.type] ?? target.type}` : '修改元素');
    const nextElements: CanvasElement[] = state.elements.map((el) =>
      el.id === id ? ({ ...el, ...attrs } as CanvasElement) : el
    );

    const now = Date.now();
    const key = coalesceKey(id, attrs as Record<string, unknown>);
    const canCoalesce =
      state._coalesceKey === key &&
      state._coalesceAt !== undefined &&
      now - state._coalesceAt < COALESCE_WINDOW_MS &&
      state.past.length > 0;

    if (canCoalesce) {
      return {
        elements: nextElements,
        currentLabel: label,
        currentTimestamp: now,
        _coalesceKey: key,
        _coalesceAt: now,
      };
    }
    return {
      past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
      future: [],
      elements: nextElements,
      currentLabel: label,
      currentTimestamp: now,
      _coalesceKey: key,
      _coalesceAt: now,
    };
  }),

  updateElementPosition: (id, x, y) => set((state) => ({
    elements: state.elements.map((el) =>
      el.id === id ? ({ ...el, x, y } as CanvasElement) : el
    ),
  })),

  batchUpdatePositions: (updates, label) => set((state) => {
    if (!updates || updates.length === 0) return state;
    const updateMap = new Map(updates.map(u => [u.id, u]));
    const nextElements: CanvasElement[] = state.elements.map((el) => {
      const u = updateMap.get(el.id);
      return u ? ({ ...el, x: u.x, y: u.y } as CanvasElement) : el;
    });
    return {
      past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
      future: [],
      elements: nextElements,
      currentLabel: label ?? `对齐 ${updates.length} 个元素`,
      currentTimestamp: Date.now(),
      _coalesceKey: undefined,
      _coalesceAt: undefined,
    };
  }),

  deleteElements: (ids) => set((state) => {
    const nextElements = state.elements.filter((el) => !ids.includes(el.id));
    const nextConnections = state.connections.filter(
      (conn) => !ids.includes(conn.fromId) && !ids.includes(conn.toId),
    );
    const nextGroups = state.groups
      .map(g => ({ ...g, childIds: g.childIds.filter(id => !ids.includes(id)) }))
      .filter(g => g.childIds.length >= 2);
    return {
      past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
      future: [],
      elements: nextElements,
      connections: nextConnections,
      groups: nextGroups,
      selectedIds: state.selectedIds.filter((id) => !ids.includes(id)),
      currentLabel: `删除 ${ids.length} 个元素`,
      currentTimestamp: Date.now(),
      _coalesceKey: undefined,
      _coalesceAt: undefined,
    };
  }),

  replaceElement: (oldId, newElement, label) => set((state) => {
    const oldEl = state.elements.find(e => e.id === oldId);
    if (!oldEl) {
      return {
        past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
        future: [],
        elements: [...state.elements, newElement],
        currentLabel: label ?? `添加${typeLabelMap[newElement.type] ?? newElement.type}`,
        currentTimestamp: Date.now(),
        _coalesceKey: undefined,
        _coalesceAt: undefined,
      };
    }

    const inheritInputs = !newElement.inputs || newElement.inputs.length === 0;
    const inheritOutputs = !newElement.outputs || newElement.outputs.length === 0;
    const finalEl: CanvasElement = {
      ...newElement,
      inputs: inheritInputs ? oldEl.inputs : newElement.inputs,
      outputs: inheritOutputs ? oldEl.outputs : newElement.outputs,
    } as CanvasElement;

    const nextElements = state.elements.map(e => (e.id === oldId ? finalEl : e));

    const nextConnections = state.connections.map(c => {
      if (c.fromId === oldId || c.toId === oldId) {
        return {
          ...c,
          fromId: c.fromId === oldId ? finalEl.id : c.fromId,
          toId: c.toId === oldId ? finalEl.id : c.toId,
        };
      }
      return c;
    });

    const nextSelected = state.selectedIds.map(id => (id === oldId ? finalEl.id : id));

    return {
      past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
      future: [],
      elements: nextElements,
      connections: nextConnections,
      selectedIds: nextSelected,
      currentLabel: label ?? `替换${typeLabelMap[finalEl.type] ?? finalEl.type}`,
      currentTimestamp: Date.now(),
      _coalesceKey: undefined,
      _coalesceAt: undefined,
    };
  }),

  clearCanvas: () => set((state) => ({
    past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
    future: [],
    elements: [],
    connections: [],
    selectedIds: [],
    currentLabel: '清空画布',
    currentTimestamp: Date.now(),
    _coalesceKey: undefined,
    _coalesceAt: undefined,
  })),
});