/**
 * Canvas store shared types.
 *
 * Extracted from useCanvasStore.ts so slices can import them without
 * creating a circular dependency on the composed store.
 */
import type { CanvasElement, Connection } from '@/types/canvas';

// ── History ───────────────────────────────────────────────────────────

export interface HistorySnapshot {
  elements: CanvasElement[];
  connections: Connection[];
  label: string;
  timestamp: number;
}

// ── Transient UI ──────────────────────────────────────────────────────

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

/** F15 local inpainting session. */
export interface InpaintMaskState {
  elementId: string;
  rect: { x: number; y: number; w: number; h: number } | null;
}

/** FR1 grouping. */
export interface GroupRecord {
  id: string;
  childIds: string[];
  label?: string;
}

// ── Full store interface ──────────────────────────────────────────────

export interface CanvasState {
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
  viewMode: 'canvas' | 'storyboard';
  groups: GroupRecord[];
  lastSavedAt: number | null;
  _coalesceKey?: string;
  _coalesceAt?: number;

  // Actions
  addElement: (element: CanvasElement) => void;
  updateElement: (id: string, attrs: Partial<CanvasElement>, label?: string) => void;
  updateElementPosition: (id: string, x: number, y: number) => void;
  batchUpdatePositions: (updates: { id: string; x: number; y: number }[], label?: string) => void;
  deleteElements: (ids: string[]) => void;
  replaceElement: (oldId: string, newElement: CanvasElement, label?: string) => void;
  addConnection: (connection: Connection) => void;
  deleteConnections: (ids: string[]) => void;
  setSelection: (ids: string[]) => void;
  setStageConfig: (config: Partial<{ scale: number; x: number; y: number }>) => void;
  setActiveTool: (tool: CanvasState['activeTool']) => void;
  setDrawingConnection: (drawing: DrawingConnection | null) => void;
  setInpaintMask: (state: InpaintMaskState | null) => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  setViewMode: (mode: 'canvas' | 'storyboard') => void;
  undo: () => void;
  redo: () => void;
  jumpToHistory: (index: number) => void;
  clearHistory: () => void;
  clearCanvas: () => void;
}
