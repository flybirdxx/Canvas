import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { CanvasElement, Connection } from '../types/canvas';

export interface HistorySnapshot {
  elements: CanvasElement[];
  connections: Connection[];
  label: string;
  timestamp: number;
}

export interface DrawingConnection {
  fromElementId: string;
  fromPortId: string;
  fromPortType: string;
  startX: number;
  startY: number;
  toX: number;
  toY: number;
  isDisconnecting?: boolean;
  existingConnectionId?: string;
}

interface CanvasState {
  elements: CanvasElement[];
  connections: Connection[];
  drawingConnection: DrawingConnection | null;
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  currentLabel: string;
  currentTimestamp: number;
  selectedIds: string[];
  stageConfig: { scale: number; x: number; y: number };
  activeTool: 'select' | 'hand' | 'rectangle' | 'circle' | 'text' | 'image' | 'sticky' | 'video' | 'audio';
  lastSavedAt: number | null;

  // Actions
  addElement: (element: CanvasElement) => void;
  updateElement: (id: string, attrs: Partial<CanvasElement>) => void;
  updateElementPosition: (id: string, x: number, y: number) => void;
  deleteElements: (ids: string[]) => void;
  addConnection: (connection: Connection) => void;
  deleteConnections: (ids: string[]) => void;
  setSelection: (ids: string[]) => void;
  setStageConfig: (config: Partial<{ scale: number; x: number; y: number }>) => void;
  setActiveTool: (tool: CanvasState['activeTool']) => void;
  setDrawingConnection: (drawing: DrawingConnection | null) => void;
  undo: () => void;
  redo: () => void;
  jumpToHistory: (index: number) => void;
  clearHistory: () => void;

  clearCanvas: () => void;
}

const MAX_HISTORY = 50;

const typeLabelMap: Record<string, string> = {
  rectangle: '矩形',
  circle: '圆形',
  text: '文本',
  image: '图片',
  sticky: '便签',
  video: '视频',
  audio: '音频',
  aigenerating: 'AI 生成',
};

function snapshot(state: Pick<CanvasState, 'elements' | 'connections' | 'currentLabel' | 'currentTimestamp'>): HistorySnapshot {
  return {
    elements: state.elements,
    connections: state.connections,
    label: state.currentLabel,
    timestamp: state.currentTimestamp,
  };
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set) => ({
      elements: [],
      connections: [],
      drawingConnection: null,
      past: [],
      future: [],
      currentLabel: '初始状态',
      currentTimestamp: Date.now(),
      selectedIds: [],
      stageConfig: { scale: 1, x: 0, y: 0 },
      activeTool: 'select',
      lastSavedAt: null,

      addElement: (element) => set((state) => {
        if (!element.inputs) {
          element.inputs = [];
          if (element.type === 'image') element.inputs.push({ id: uuidv4(), type: 'text', label: 'Prompt' });
          if (element.type === 'video') element.inputs.push({ id: uuidv4(), type: 'image', label: 'Image' });
          if (element.type === 'audio') element.inputs.push({ id: uuidv4(), type: 'text', label: 'Prompt' });
          if (element.type === 'rectangle' || element.type === 'circle' || element.type === 'sticky') {
            element.inputs.push({ id: uuidv4(), type: 'any', label: 'In' });
          }
        }

        if (!element.outputs) {
          element.outputs = [];
          if (element.type === 'text') element.outputs.push({ id: uuidv4(), type: 'text', label: 'Text' });
          if (element.type === 'image') element.outputs.push({ id: uuidv4(), type: 'image', label: 'Image' });
          if (element.type === 'video') element.outputs.push({ id: uuidv4(), type: 'video', label: 'Video' });
          if (element.type === 'audio') element.outputs.push({ id: uuidv4(), type: 'audio', label: 'Audio' });
          if (element.type === 'rectangle' || element.type === 'circle' || element.type === 'sticky') {
            element.outputs.push({ id: uuidv4(), type: 'any', label: 'Out' });
          }
        }

        const label = `添加${typeLabelMap[element.type] ?? element.type}`;
        return {
          past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
          future: [],
          elements: [...state.elements, element],
          currentLabel: label,
          currentTimestamp: Date.now(),
        };
      }),

      updateElement: (id, attrs) => set((state) => {
        const target = state.elements.find(el => el.id === id);
        const label = target ? `修改${typeLabelMap[target.type] ?? target.type}` : '修改元素';
        const nextElements: CanvasElement[] = state.elements.map((el) =>
          el.id === id ? ({ ...el, ...attrs } as CanvasElement) : el
        );
        return {
          past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
          future: [],
          elements: nextElements,
          currentLabel: label,
          currentTimestamp: Date.now(),
        };
      }),

      updateElementPosition: (id, x, y) => set((state) => ({
        elements: state.elements.map((el) =>
          el.id === id ? ({ ...el, x, y } as CanvasElement) : el
        ),
      })),

      deleteElements: (ids) => set((state) => {
        const nextElements = state.elements.filter((el) => !ids.includes(el.id));
        const nextConnections = state.connections.filter((conn) => !ids.includes(conn.fromId) && !ids.includes(conn.toId));
        return {
          past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
          future: [],
          elements: nextElements,
          connections: nextConnections,
          selectedIds: state.selectedIds.filter((id) => !ids.includes(id)),
          currentLabel: `删除 ${ids.length} 个元素`,
          currentTimestamp: Date.now(),
        };
      }),

      addConnection: (connection) => set((state) => {
        const filteredConnections = state.connections.filter(c => c.toPortId !== connection.toPortId);
        return {
          past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
          future: [],
          connections: [...filteredConnections, connection],
          currentLabel: '添加连线',
          currentTimestamp: Date.now(),
        };
      }),

      deleteConnections: (ids) => set((state) => ({
        past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
        future: [],
        connections: state.connections.filter((conn) => !ids.includes(conn.id)),
        currentLabel: `删除 ${ids.length} 条连线`,
        currentTimestamp: Date.now(),
      })),

      setSelection: (ids) => set({ selectedIds: ids }),

      setStageConfig: (config) => set((state) => ({
        stageConfig: { ...state.stageConfig, ...config }
      })),

      setActiveTool: (tool) => set({ activeTool: tool }),

      setDrawingConnection: (drawing) => set({ drawingConnection: drawing }),

      undo: () => set((state) => {
        if (state.past.length === 0) return state;
        const newPast = [...state.past];
        const previousSnap = newPast.pop()!;
        return {
          past: newPast,
          future: [snapshot(state), ...state.future],
          elements: previousSnap.elements,
          connections: previousSnap.connections,
          currentLabel: previousSnap.label,
          currentTimestamp: previousSnap.timestamp,
          selectedIds: [],
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
          currentLabel: nextSnap.label,
          currentTimestamp: nextSnap.timestamp,
          selectedIds: [],
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
          currentLabel: target.label,
          currentTimestamp: target.timestamp,
          selectedIds: [],
        };
      }),

      clearHistory: () => set({ past: [], future: [] }),

      clearCanvas: () => set((state) => ({
        past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
        future: [],
        elements: [],
        connections: [],
        selectedIds: [],
        currentLabel: '清空画布',
        currentTimestamp: Date.now(),
      })),
    }),
    {
      name: 'ai-canvas-document',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        elements: state.elements,
        connections: state.connections,
        stageConfig: state.stageConfig,
        lastSavedAt: state.lastSavedAt,
      }),
      migrate: (persistedState: any, version: number) => {
        // v1 -> v2: image/video 默认尺寸从 320x240 提升到 400x300，
        // 将持久化的过小节点自动补齐到最小显示尺寸，避免 NodeInputBar 比节点还宽。
        if (version < 2 && persistedState && Array.isArray(persistedState.elements)) {
          const MIN_W = 340;
          const MIN_H = 260;
          persistedState.elements = persistedState.elements.map((el: any) => {
            if (!el || (el.type !== 'image' && el.type !== 'video')) return el;
            if (typeof el.width !== 'number' || typeof el.height !== 'number') return el;
            if (el.width < MIN_W || el.height < MIN_H) {
              return {
                ...el,
                width: Math.max(el.width, 400),
                height: Math.max(el.height, 300),
              };
            }
            return el;
          });
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
        }
      },
    }
  )
);

// Track auto-save timestamps whenever persisted slices change.
// Second-call reentrancy is safe because this only mutates `lastSavedAt`,
// leaving `elements`/`connections`/`stageConfig` references identical.
useCanvasStore.subscribe((state, prev) => {
  const changed =
    state.elements !== prev.elements ||
    state.connections !== prev.connections ||
    state.stageConfig !== prev.stageConfig;
  if (changed) {
    useCanvasStore.setState({ lastSavedAt: Date.now() });
  }
});
