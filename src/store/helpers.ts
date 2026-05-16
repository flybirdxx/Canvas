import type { CanvasState, HistorySnapshot } from './types';

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
  omniscript: 'OmniScript',
  planning: '企划',
};

export const MAX_HISTORY = 50;
export const COALESCE_WINDOW_MS = 500;

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

export function coalesceKey(id: string, attrs: Record<string, unknown>): string {
  return `update:${id}:${Object.keys(attrs).sort().join(',')}`;
}
