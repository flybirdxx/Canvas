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

/**
 * F15 local inpainting session — transient UI state, not persisted.
 * `elementId` is the image node being repainted. `rect` is the user-drawn
 * selection in NORMALIZED [0..1] coords relative to the node's rendered
 * box. `null` rect means the mode is toggled on but nothing drawn yet.
 */
export interface InpaintMaskState {
  elementId: string;
  rect: { x: number; y: number; w: number; h: number } | null;
}

interface CanvasState {
  elements: CanvasElement[];
  connections: Connection[];
  drawingConnection: DrawingConnection | null;
  inpaintMask: InpaintMaskState | null;
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  currentLabel: string;
  currentTimestamp: number;
  selectedIds: string[];
  stageConfig: { scale: number; x: number; y: number };
  activeTool: 'select' | 'hand' | 'rectangle' | 'circle' | 'text' | 'image' | 'sticky' | 'video' | 'audio';
  lastSavedAt: number | null;
  /**
   * F17 history-coalescing hints. When two consecutive `updateElement`
   * calls share the same coalesce key within {@link COALESCE_WINDOW_MS},
   * the second replaces the current state WITHOUT pushing a new history
   * snapshot. This keeps rapid prompt typing or value-slider drags from
   * exploding the undo stack. Neither field is persisted — they reset on
   * every reload and on any non-update action.
   */
  _coalesceKey?: string;
  _coalesceAt?: number;

  // Actions
  addElement: (element: CanvasElement) => void;
  updateElement: (id: string, attrs: Partial<CanvasElement>) => void;
  updateElementPosition: (id: string, x: number, y: number) => void;
  /**
   * Batch-commit positions for several elements in a single history entry —
   * used by alignment / distribute / auto-grid so one user action undoes as
   * one. Silent no-op on elements not present in the store.
   */
  batchUpdatePositions: (updates: { id: string; x: number; y: number }[], label?: string) => void;
  deleteElements: (ids: string[]) => void;
  addConnection: (connection: Connection) => void;
  deleteConnections: (ids: string[]) => void;
  setSelection: (ids: string[]) => void;
  setStageConfig: (config: Partial<{ scale: number; x: number; y: number }>) => void;
  setActiveTool: (tool: CanvasState['activeTool']) => void;
  setDrawingConnection: (drawing: DrawingConnection | null) => void;
  /** F15: set / clear the localized inpaint target + rect. Transient. */
  setInpaintMask: (state: InpaintMaskState | null) => void;
  undo: () => void;
  redo: () => void;
  jumpToHistory: (index: number) => void;
  clearHistory: () => void;

  clearCanvas: () => void;
}

const MAX_HISTORY = 50;

/**
 * F17: two consecutive updateElement calls sharing the same `coalesceKey`
 * within this window replace the in-memory state WITHOUT pushing a new
 * snapshot. A natural typing pause of > 500ms breaks the run and the
 * next edit becomes a fresh undo step. Tuned so 4–6 chars per second of
 * prompt typing collapses to one entry, but deliberate edits separated
 * by reading/thinking pauses stay granular.
 */
const COALESCE_WINDOW_MS = 500;

/** Deterministic key so we only coalesce "like with like". */
function coalesceKey(id: string, attrs: Record<string, unknown>): string {
  return `update:${id}:${Object.keys(attrs).sort().join(',')}`;
}

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
      inpaintMask: null,
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
          if (element.type === 'image') {
            // Two input ports: a text prompt input (for upstream text nodes)
            // and an image input (for reference images via connection, F14
            // extension). Order matters — text first so it stays at the top
            // of the rendered port column.
            element.inputs.push({ id: uuidv4(), type: 'text', label: 'Prompt' });
            element.inputs.push({ id: uuidv4(), type: 'image', label: 'Ref' });
          }
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
          _coalesceKey: undefined,
          _coalesceAt: undefined,
        };
      }),

      updateElement: (id, attrs) => set((state) => {
        const target = state.elements.find(el => el.id === id);
        const label = target ? `修改${typeLabelMap[target.type] ?? target.type}` : '修改元素';
        const nextElements: CanvasElement[] = state.elements.map((el) =>
          el.id === id ? ({ ...el, ...attrs } as CanvasElement) : el
        );

        // F17: coalesce rapid successive edits to the same element + same
        // set of attribute keys into a single undo step. The history
        // snapshot captured when the run STARTED is kept untouched so
        // one Ctrl+Z still unwinds the whole run.
        const now = Date.now();
        const key = coalesceKey(id, attrs as Record<string, unknown>);
        const canCoalesce =
          state._coalesceKey === key &&
          state._coalesceAt !== undefined &&
          now - state._coalesceAt < COALESCE_WINDOW_MS &&
          // Safety: if someone emptied the past (e.g., clearHistory) we
          // can't coalesce into a nonexistent snapshot — start fresh.
          state.past.length > 0;

        if (canCoalesce) {
          return {
            elements: nextElements,
            currentLabel: label,
            currentTimestamp: now,
            _coalesceKey: key,
            _coalesceAt: now,
            // past / future are left as-is — we're merging into the
            // existing head of history.
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
        const nextConnections = state.connections.filter((conn) => !ids.includes(conn.fromId) && !ids.includes(conn.toId));
        return {
          past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
          future: [],
          elements: nextElements,
          connections: nextConnections,
          selectedIds: state.selectedIds.filter((id) => !ids.includes(id)),
          currentLabel: `删除 ${ids.length} 个元素`,
          currentTimestamp: Date.now(),
          _coalesceKey: undefined,
          _coalesceAt: undefined,
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
          _coalesceKey: undefined,
          _coalesceAt: undefined,
        };
      }),

      deleteConnections: (ids) => set((state) => ({
        past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
        future: [],
        connections: state.connections.filter((conn) => !ids.includes(conn.id)),
        currentLabel: `删除 ${ids.length} 条连线`,
        currentTimestamp: Date.now(),
        _coalesceKey: undefined,
        _coalesceAt: undefined,
      })),

      setSelection: (ids) => set({ selectedIds: ids }),

      setStageConfig: (config) => set((state) => ({
        stageConfig: { ...state.stageConfig, ...config }
      })),

      setActiveTool: (tool) => set({ activeTool: tool }),

      setDrawingConnection: (drawing) => set({ drawingConnection: drawing }),

      setInpaintMask: (state) => set({ inpaintMask: state }),

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
          currentLabel: target.label,
          currentTimestamp: target.timestamp,
          selectedIds: [],
          _coalesceKey: undefined,
          _coalesceAt: undefined,
        };
      }),

      clearHistory: () => set({ past: [], future: [], _coalesceKey: undefined, _coalesceAt: undefined }),

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
    }),
    {
      name: 'ai-canvas-document',
      version: 4,
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
        // v2 -> v3: 图像节点新增 image 输入端口（F14 延伸，支持 image→image 连线）。
        // 对既有 image 节点：若 inputs 里还没有 type==='image' 的端口，补一个。
        if (version < 3 && persistedState && Array.isArray(persistedState.elements)) {
          persistedState.elements = persistedState.elements.map((el: any) => {
            if (!el || el.type !== 'image') return el;
            const inputs = Array.isArray(el.inputs) ? el.inputs : [];
            const hasImageInput = inputs.some((p: any) => p && p.type === 'image');
            if (hasImageInput) return el;
            return {
              ...el,
              inputs: [
                ...inputs,
                { id: uuidv4(), type: 'image', label: 'Ref' },
              ],
            };
          });
        }
        // v3 -> v4: 为了让 NodeInputBar 底栏在 image/video 模式下不再挤压，
        // 节点最小宽度提升至 image=480、video=520。将既有过窄节点等比补齐，
        // 保持视觉上节点与其下方输入栏宽度一致。
        if (version < 4 && persistedState && Array.isArray(persistedState.elements)) {
          const MIN_BY_TYPE: Record<string, number> = { image: 480, video: 520 };
          persistedState.elements = persistedState.elements.map((el: any) => {
            if (!el || typeof el.width !== 'number' || typeof el.height !== 'number') return el;
            const minW = MIN_BY_TYPE[el.type];
            if (!minW || el.width >= minW) return el;
            const scale = minW / el.width;
            return {
              ...el,
              width: minW,
              height: Math.round(el.height * scale),
            };
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
          state.inpaintMask = null;
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
