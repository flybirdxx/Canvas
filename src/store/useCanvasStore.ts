import { create } from 'zustand';
import { CanvasElement } from '../types/canvas';

interface CanvasState {
  elements: CanvasElement[];
  past: CanvasElement[][];
  future: CanvasElement[][];
  selectedIds: string[];
  stageConfig: { scale: number; x: number; y: number };
  activeTool: 'select' | 'hand' | 'rectangle' | 'circle' | 'text' | 'image' | 'sticky' | 'video' | 'audio';
  
  // Actions
  addElement: (element: CanvasElement) => void;
  updateElement: (id: string, attrs: Partial<CanvasElement>) => void;
  deleteElements: (ids: string[]) => void;
  setSelection: (ids: string[]) => void;
  setStageConfig: (config: Partial<{ scale: number; x: number; y: number }>) => void;
  setActiveTool: (tool: CanvasState['activeTool']) => void;
  undo: () => void;
  redo: () => void;
}

const MAX_HISTORY = 50;

export const useCanvasStore = create<CanvasState>((set) => ({
  elements: [],
  past: [],
  future: [],
  selectedIds: [],
  stageConfig: { scale: 1, x: 0, y: 0 },
  activeTool: 'select',
  
  addElement: (element) => set((state) => ({ 
    past: [...state.past, state.elements].slice(-MAX_HISTORY),
    future: [],
    elements: [...state.elements, element] 
  })),
  
  updateElement: (id, attrs) => set((state) => ({
    past: [...state.past, state.elements].slice(-MAX_HISTORY),
    future: [],
    elements: state.elements.map((el) => el.id === id ? { ...el, ...attrs } : el)
  })),

  deleteElements: (ids) => set((state) => ({
    past: [...state.past, state.elements].slice(-MAX_HISTORY),
    future: [],
    elements: state.elements.filter((el) => !ids.includes(el.id)),
    selectedIds: state.selectedIds.filter((id) => !ids.includes(id)),
  })),
  
  setSelection: (ids) => set({ selectedIds: ids }),
  
  setStageConfig: (config) => set((state) => ({ 
    stageConfig: { ...state.stageConfig, ...config } 
  })),
  
  setActiveTool: (tool) => set({ activeTool: tool }),

  undo: () => set((state) => {
    if (state.past.length === 0) return state;
    const newPast = [...state.past];
    const previousElements = newPast.pop()!;
    return {
      past: newPast,
      future: [state.elements, ...state.future],
      elements: previousElements,
      selectedIds: [], // Deselect all to prevent stale references
    };
  }),

  redo: () => set((state) => {
    if (state.future.length === 0) return state;
    const newFuture = [...state.future];
    const nextElements = newFuture.shift()!;
    return {
      past: [...state.past, state.elements],
      future: newFuture,
      elements: nextElements,
      selectedIds: [],
    };
  }),
}));
