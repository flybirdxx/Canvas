import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { CanvasElement, Connection } from '../types/canvas';
// [telemetry] file-node discovery（2 周观察窗，结束后删这一行 + 3 处 bumpTelemetry）
import { bumpTelemetry } from '../services/fileNodeTelemetry';

/**
 * Throttled localStorage 适配器。
 *
 * 背景：zustand persist 默认会在每次 set() 后同步把整份持久化切片
 * `JSON.stringify` 再 `localStorage.setItem`。拖拽节点时 `updateElementPosition`
 * 每一帧都在 set，一旦 `elements` 里含 data URL（图像 / 视频 / file 节
 * 点，通常 MB 级 base64 字符串），每帧都要序列化几 MB 再写磁盘，很容易
 * 让主线程一次 stop-the-world 几十 ms，表现就是拖动节点卡顿。
 *
 * 这里用"最后一次胜出"的防抖策略：
 * - `setItem` 只记待写内容，起 300ms 定时器，期间新写入会覆盖上一次
 * - 定时器触发时才真正 `localStorage.setItem` 并清空待写
 * - `removeItem` 同步执行（删除不频繁，直接落盘），并取消待写
 * - 页面 `beforeunload` 强制 flush，避免关闭标签页时丢最后几百 ms 编辑
 *
 * 不会改变 persist 的语义（读仍是同步 `localStorage.getItem`），只是把
 * 高频写批量化。对用户而言：拖拽丝滑；离手后 ≤300ms 自动落盘；关闭
 * 标签时 flush 兜底。
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
    // 标签关闭 / 刷新时确保最后一次 set 被写入。
    window.addEventListener('beforeunload', flush);
    // 页面切后台时浏览器会冻结定时器，pagehide 是比 beforeunload 更可靠
    // 的保底（移动端 / bfcache 场景）。
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
  /**
   * 原子地把 `oldId` 节点换成 `newEl`，并把所有指向 `oldId` 的连线
   * `fromId`/`toId` 改写成 `newEl.id`。关键语义：
   *   1. 如果 `newEl.inputs`/`outputs` 没给（或为空数组），**继承**老节点的
   *      端口对象（连同它们的 `id`）。连接里记的是 portId 而非 index，
   *      所以只要 portId 不变，连线就仍落在合法端口上。
   *   2. 数组位置原地替换（elements.map），不会把节点挪到 z-order 顶端。
   *   3. 一次推入 past，整个替换作为单步可 undo。
   *
   * 之所以需要它：生成 / 重绘 / "in-place" 替换锚点时，老路径是
   * `deleteElements + addElement`，但 `deleteElements` 会**连带删掉**所有
   * 与老节点相连的 connection，导致 img2img 的连线在点击生成那一刻就蒸发。
   */
  replaceElement: (oldId: string, newElement: CanvasElement, label?: string) => void;
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
  file: '文件',
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
          // 'file' 不接 input —— 它本身是"素材源"，只输出不消费。
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
          // file(image)：按 MIME 暴露 image output，让上传的图能直接连到生成节点
          // 的 image 输入槽（img2img / 参考图）。非图类型（PDF / 音频 / 压缩包等）
          // 当前没有合适的 AI 管道消费路径，暂不开放 output —— Phase 2 再考虑为
          // text-like MIME 加 'text' 输出。
          if (element.type === 'file') {
            const mt = String((element as any).mimeType || '').toLowerCase();
            if (mt.startsWith('image/')) {
              element.outputs.push({ id: uuidv4(), type: 'image', label: 'Image' });
            }
          }
        }

        // [telemetry] 观察：file 节点创建频次（上传 / 拖入 / Replace 重建都会过这里）
        if (element.type === 'file') bumpTelemetry('fileNodeCreated');

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

      replaceElement: (oldId, newElement, label) => set((state) => {
        const oldEl = state.elements.find(e => e.id === oldId);
        if (!oldEl) {
          // 老节点已经不在（可能被 undo / 用户手动删了）——降级成 addElement
          // 的等价语义，避免丢事件。不走 addElement 是因为要自己管 history label。
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

        // 端口承继：调用方没显式给或者给了空数组时，直接复用老节点的端口
        // 对象（包括它们的 id）。这一步是连线存活的关键——connections 里
        // 记的是 portId，只要 portId 不换，下面的 fromId/toId 改写就能让
        // 连接整体落到新节点同一组端口上。
        const inheritInputs = !newElement.inputs || newElement.inputs.length === 0;
        const inheritOutputs = !newElement.outputs || newElement.outputs.length === 0;
        const finalEl: CanvasElement = {
          ...newElement,
          inputs: inheritInputs ? oldEl.inputs : newElement.inputs,
          outputs: inheritOutputs ? oldEl.outputs : newElement.outputs,
        } as CanvasElement;

        const nextElements = state.elements.map(e => (e.id === oldId ? finalEl : e));

        // 连线改写：仅改 fromId / toId，不动 portId。self-loop（同一节点自连）
        // 用三元连续 spread 兼容 from / to 都是 oldId 的情况。
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

      addConnection: (connection) => set((state) => {
        // 环形检测：从 toId 出发沿所有连线 DFS，如果能回到 fromId，说明添加
        // 这条连线会形成有向环。拒绝创建——环在视觉和语义（flowResolver 上游
        // 收集）上都可能让用户困惑，而且递归收集上游内容时可能陷入无限循环。
        {
          const allCons = [
            ...state.connections.filter(c => c.toPortId !== connection.toPortId),
            connection,
          ];
          const visited = new Set<string>();
          const stack = [connection.toId];
          while (stack.length > 0) {
            const cur = stack.pop()!;
            if (cur === connection.fromId) return state; // ← 检测到环，拒绝
            if (visited.has(cur)) continue;
            visited.add(cur);
            for (const c of allCons) {
              if (c.fromId === cur && !visited.has(c.toId)) {
                stack.push(c.toId);
              }
            }
          }
        }

        const filteredConnections = state.connections.filter(c => c.toPortId !== connection.toPortId);

        // [telemetry] 观察：file(image) 有没有被真的连到"图生"节点上。
        // 判定条件：source 是 file 且 MIME 起步于 image/；target 的输入口是
        // image 或 any（AIGeneratingElement 的 image 输入口 / shape 的 any 都算）。
        // 只有满足这两个条件，这根连线才代表"我真的想拿上传的图做 img2img / 参考"。
        try {
          const src = state.elements.find(e => e.id === connection.fromId);
          if (src && src.type === 'file') {
            const mt = String((src as any).mimeType || '').toLowerCase();
            if (mt.startsWith('image/')) {
              const target = state.elements.find(e => e.id === connection.toId);
              const toPort = target?.inputs?.find(p => p.id === connection.toPortId);
              if (toPort && (toPort.type === 'image' || toPort.type === 'any')) {
                bumpTelemetry('fileNodeConnectedAsImageSource');
              }
            }
          }
        } catch {
          // 埋点不得影响主流程，静默吞掉
        }

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
      version: 6,
      // 拖拽帧写入会触发高频 JSON.stringify + setItem；用 300ms 防抖把
      // 连续写合并为一次，消除拖动卡顿。语义见 createThrottledLocalStorage。
      storage: createJSONStorage(() => createThrottledLocalStorage(300)),
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
        // v4 -> v5: 引入 'file' 附件节点类型。老数据里没有这个 type，
        // 所以不需要改写任何元素；bump 版本只是为了让 migrate 链条可追溯，
        // 也方便未来 v6+ 时在这里做 file 结构迁移（比如 v2 的 blob 降级）。
        // 留一个显式的 no-op 分支，签个到就走。
        if (version < 5 && persistedState) {
          // no-op
        }
        // v5 -> v6: FileElement 扩展了 thumbnailDataUrl / durationMs / pageCount
        // 三个可选字段。老 file 节点没有它们，渲染层自动回退到"通用附件卡"路径，
        // 不需要回填；用户下次重新上传就会走新抽取链路，给出真正的预览。
        if (version < 6 && persistedState) {
          // no-op
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
