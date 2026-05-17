import type { CanvasElement, ElementType, Port } from '@/types/canvas';
import { PORT_DEFAULTS, type PortTemplate } from '@/store/portDefaults';
import { formatPlanningText } from '@/utils/planningText';

export type NodeExecutionMode = 'none' | 'image' | 'video' | 'audio';
export type NodeResizeMode = 'free' | 'aspect' | 'none';

export interface NodeDefinition {
  type: ElementType;
  label: string;
  defaultSize: { width: number; height: number };
  ports: { inputs: PortTemplate[]; outputs: PortTemplate[] };
  execution: NodeExecutionMode;
  resize: NodeResizeMode;
  getOutgoingText?: (element: CanvasElement) => string;
}

export const ELEMENT_TYPES: ElementType[] = [
  'rectangle',
  'circle',
  'text',
  'image',
  'sticky',
  'video',
  'audio',
  'aigenerating',
  'file',
  'omniscript',
  'planning',
];

export const NODE_DEFINITIONS: Record<ElementType, NodeDefinition> = {
  rectangle: {
    type: 'rectangle',
    label: '矩形',
    defaultSize: { width: 100, height: 100 },
    ports: PORT_DEFAULTS.rectangle,
    execution: 'none',
    resize: 'free',
  },
  circle: {
    type: 'circle',
    label: '圆形',
    defaultSize: { width: 100, height: 100 },
    ports: PORT_DEFAULTS.circle,
    execution: 'none',
    resize: 'free',
  },
  text: {
    type: 'text',
    label: '文本',
    defaultSize: { width: 420, height: 280 },
    ports: PORT_DEFAULTS.text,
    execution: 'none',
    resize: 'free',
    getOutgoingText: (element) => element.type === 'text' ? element.text.trim() : '',
  },
  image: {
    type: 'image',
    label: '图像',
    defaultSize: { width: 560, height: 560 },
    ports: PORT_DEFAULTS.image,
    execution: 'image',
    resize: 'aspect',
    getOutgoingText: (element) => element.type === 'image' ? (element.prompt ?? '').trim() : '',
  },
  sticky: {
    type: 'sticky',
    label: '便签',
    defaultSize: { width: 220, height: 220 },
    ports: PORT_DEFAULTS.sticky,
    execution: 'none',
    resize: 'free',
    getOutgoingText: (element) => element.type === 'sticky' ? element.text.trim() : '',
  },
  video: {
    type: 'video',
    label: '视频',
    defaultSize: { width: 640, height: 360 },
    ports: PORT_DEFAULTS.video,
    execution: 'video',
    resize: 'aspect',
    getOutgoingText: (element) => element.type === 'video' ? (element.prompt ?? '').trim() : '',
  },
  audio: {
    type: 'audio',
    label: '音频',
    defaultSize: { width: 360, height: 96 },
    ports: PORT_DEFAULTS.audio,
    execution: 'audio',
    resize: 'free',
    getOutgoingText: (element) => element.type === 'audio' ? (element.prompt ?? '').trim() : '',
  },
  aigenerating: {
    type: 'aigenerating',
    label: 'AI 生成',
    defaultSize: { width: 280, height: 60 },
    ports: PORT_DEFAULTS.aigenerating,
    execution: 'none',
    resize: 'none',
    getOutgoingText: (element) => element.type === 'aigenerating' ? (element.prompt ?? '').trim() : '',
  },
  file: {
    type: 'file',
    label: '文件',
    defaultSize: { width: 280, height: 160 },
    ports: PORT_DEFAULTS.file,
    execution: 'none',
    resize: 'free',
  },
  omniscript: {
    type: 'omniscript',
    label: 'OmniScript',
    defaultSize: { width: 640, height: 440 },
    ports: PORT_DEFAULTS.omniscript,
    execution: 'none',
    resize: 'free',
    getOutgoingText: (element) => {
      if (element.type !== 'omniscript') return '';
      return [
        ...(element.result?.segments ?? []).map(item => item.summary),
        ...(element.result?.structuredScript ?? []).map(item => item.copy),
        ...(element.result?.highlights ?? []).map(item => item.reason),
      ].filter(Boolean).join('\n');
    },
  },
  planning: {
    type: 'planning',
    label: '企划',
    defaultSize: { width: 340, height: 260 },
    ports: PORT_DEFAULTS.planning,
    execution: 'none',
    resize: 'free',
    getOutgoingText: (element) => element.type === 'planning' ? formatPlanningText(element) : '',
  },
};

export function getNodeDefinition(type: ElementType): NodeDefinition {
  return NODE_DEFINITIONS[type];
}

export function getDefaultNodeSize(type: ElementType): { width: number; height: number } {
  return getNodeDefinition(type).defaultSize;
}

export function getNodePortTemplates(type: ElementType): { inputs: PortTemplate[]; outputs: PortTemplate[] } {
  return getNodeDefinition(type).ports;
}

export function createDefaultPorts(templates: PortTemplate[], makePort: (template: PortTemplate) => Port): Port[] {
  return templates.map(makePort);
}
