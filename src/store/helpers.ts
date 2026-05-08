/**
 * Canvas store shared helpers — pure functions used by multiple slices.
 *
 * Extracted from useCanvasStore.ts to keep slices focused and avoid
 * circular imports across the composed store.
 */
import type { CanvasState, HistorySnapshot } from './types';

// ── Labels ────────────────────────────────────────────────────────────

export const typeLabelMap: Record<string, string> = {
  rectangle: '矩形',
  circle: '圆形',
  text: '文本',
  image: '图片',
  sticky: '便签',
  video: '视频',
  audio: '音频',
  aigenerating: 'AI 生成',
  file: '文件',
  script: '剧本',
  scene: '分镜',
};

// ── Constants ─────────────────────────────────────────────────────────

export const MAX_HISTORY = 50;

/**
 * F17: two consecutive updateElement calls sharing the same coalesceKey
 * within this window (ms) replace the in-memory state WITHOUT pushing a
 * new snapshot.
 */
export const COALESCE_WINDOW_MS = 500;

// ── Snapshot ──────────────────────────────────────────────────────────

export function snapshot(
  state: Pick<CanvasState, 'elements' | 'connections' | 'currentLabel' | 'currentTimestamp'>,
): HistorySnapshot {
  return {
    elements: state.elements,
    connections: state.connections,
    label: state.currentLabel,
    timestamp: state.currentTimestamp,
  };
}

// ── Coalescing ────────────────────────────────────────────────────────

/** Deterministic key so we only coalesce "like with like". */
export function coalesceKey(id: string, attrs: Record<string, unknown>): string {
  return `update:${id}:${Object.keys(attrs).sort().join(',')}`;
}
