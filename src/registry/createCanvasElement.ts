import { v4 as uuidv4 } from 'uuid';
import type { CanvasElement, ElementType } from '@/types/canvas';
import { makePorts } from '@/store/portDefaults';
import { getNodeDefinition } from './nodeRegistry';

const DEFAULT_PLANNING_BODY = [
  '一句想法：',
  '',
  '题材 / 基调：',
  '',
  '短剧方向：',
].join('\n');

type ElementOverrides = Partial<CanvasElement> & Record<string, unknown>;

export function createCanvasElement(
  type: ElementType,
  position: { x: number; y: number },
  overrides: ElementOverrides = {},
): CanvasElement {
  const definition = getNodeDefinition(type);
  const base = {
    id: uuidv4(),
    type,
    x: position.x,
    y: position.y,
    width: definition.defaultSize.width,
    height: definition.defaultSize.height,
    inputs: makePorts(definition.ports.inputs),
    outputs: makePorts(definition.ports.outputs),
    ...defaultsForType(type),
    ...overrides,
  };

  return base as CanvasElement;
}

function defaultsForType(type: ElementType): Record<string, unknown> {
  switch (type) {
    case 'rectangle':
      return { fill: '#E1D7CB', cornerRadius: 12 };
    case 'circle':
      return { fill: '#DDD1C2' };
    case 'text':
      return {
        text: '',
        fontSize: 14,
        fontFamily: 'var(--font-serif)',
        fill: '#26211c',
      };
    case 'image':
      return { src: '' };
    case 'sticky':
      return { text: '点击编辑便签内容...', fill: '#F3E3A0' };
    case 'video':
    case 'audio':
      return { src: '' };
    case 'aigenerating':
      return {};
    case 'file':
      return {
        name: '未命名文件',
        mimeType: 'application/octet-stream',
        sizeBytes: 0,
        src: '',
        persistence: 'data',
      };
    case 'omniscript':
      return {
        title: 'OmniScript',
        videoUrl: '',
        notes: '',
        analysisStatus: 'idle',
        result: { segments: [], structuredScript: [], highlights: [] },
      };
    case 'planning':
      return {
        kind: 'projectSeed',
        title: '项目种子',
        body: DEFAULT_PLANNING_BODY,
        template: 'shortDrama',
      };
  }
}
