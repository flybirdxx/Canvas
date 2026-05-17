import { describe, expect, it } from 'vitest';
import type { ElementType } from '@/types/canvas';
import { ELEMENT_TYPES, getNodeDefinition, NODE_DEFINITIONS } from './nodeRegistry';
import { createCanvasElement } from './createCanvasElement';

const EXPECTED_TYPES: ElementType[] = [
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

describe('nodeRegistry', () => {
  it('declares every canvas element type exactly once', () => {
    expect(ELEMENT_TYPES).toEqual(EXPECTED_TYPES);
    expect(Object.keys(NODE_DEFINITIONS).sort()).toEqual([...EXPECTED_TYPES].sort());
  });

  it('exposes default size and port templates for each node type', () => {
    for (const type of ELEMENT_TYPES) {
      const definition = getNodeDefinition(type);

      expect(definition.defaultSize.width).toBeGreaterThan(0);
      expect(definition.defaultSize.height).toBeGreaterThan(0);
      expect(definition.ports.inputs).toBeDefined();
      expect(definition.ports.outputs).toBeDefined();
    }
  });

  it('creates legal default elements with generated ports', () => {
    for (const type of ELEMENT_TYPES) {
      const element = createCanvasElement(type, { x: 10, y: 20 });
      const definition = getNodeDefinition(type);

      expect(element).toMatchObject({
        type,
        x: 10,
        y: 20,
        width: definition.defaultSize.width,
        height: definition.defaultSize.height,
      });
      expect(element.inputs ?? []).toHaveLength(definition.ports.inputs.length);
      expect(element.outputs ?? []).toHaveLength(definition.ports.outputs.length);
    }
  });

  it('preserves overrides while keeping type-specific defaults', () => {
    const element = createCanvasElement('planning', { x: 0, y: 0 }, {
      id: 'fixed-id',
      title: '角色生产包',
      width: 480,
    });

    expect(element).toMatchObject({
      id: 'fixed-id',
      type: 'planning',
      title: '角色生产包',
      width: 480,
      height: 260,
      kind: 'projectSeed',
      template: 'shortDrama',
    });
  });

  it('keeps user-facing registry labels and factory defaults readable', () => {
    expect(getNodeDefinition('sticky').label).toBe('便签');
    expect(getNodeDefinition('image').label).toBe('图像');
    expect(getNodeDefinition('planning').label).toBe('企划');

    expect(createCanvasElement('sticky', { x: 0, y: 0 })).toMatchObject({
      text: '点击编辑便签内容...',
    });
    expect(createCanvasElement('file', { x: 0, y: 0 })).toMatchObject({
      name: '未命名文件',
    });
    expect(createCanvasElement('planning', { x: 0, y: 0 })).toMatchObject({
      title: '项目种子',
      body: expect.stringContaining('一句想法：'),
    });
  });

  it('uses registry outgoing text adapters for rich node types', () => {
    const planning = createCanvasElement('planning', { x: 0, y: 0 }, {
      title: '故事圣经',
      body: '人物关系',
    });
    const omniscript = createCanvasElement('omniscript', { x: 0, y: 0 }, {
      result: {
        segments: [{ summary: '前三秒强钩子' }],
        structuredScript: [{ copy: '角色看向镜头' }],
        highlights: [{ reason: '冲突明确' }],
      },
    });

    expect(getNodeDefinition('planning').getOutgoingText?.(planning)).toContain('人物关系');
    expect(getNodeDefinition('omniscript').getOutgoingText?.(omniscript)).toContain('前三秒强钩子');
  });
});
