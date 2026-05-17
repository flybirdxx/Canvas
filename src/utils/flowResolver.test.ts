import { describe, expect, it } from 'vitest';
import {
  composeEffectivePrompt,
  getUpstreamImageContributions,
  getUpstreamTextContributions,
} from '@/utils/flowResolver';
import type { CanvasElement, Connection } from '@/types/canvas';

function conn(
  id: string,
  fromId: string,
  toId: string,
  fromPortId = 'p-out',
  toPortId = 'p-in',
): Connection {
  return { id, fromId, toId, fromPortId, toPortId };
}

function textEl(overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    id: 't1',
    type: 'text',
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    text: 'Hello world',
    outputs: [{ id: 'p-out', type: 'text', label: 'Text' }],
    inputs: [],
    ...overrides,
  } as CanvasElement;
}

function imageEl(overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    id: 'img1',
    type: 'image',
    x: 100,
    y: 100,
    width: 400,
    height: 400,
    src: 'data:image/png;base64,abc',
    prompt: 'a beautiful landscape',
    inputs: [
      { id: 'p-in-text', type: 'text', label: 'Prompt' },
      { id: 'p-in-image', type: 'image', label: 'Ref' },
    ],
    outputs: [{ id: 'p-out', type: 'image', label: 'Image' }],
    ...overrides,
  } as CanvasElement;
}

function fileImageEl(overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    id: 'f1',
    type: 'file',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    src: 'data:image/jpeg;base64,def',
    mimeType: 'image/jpeg',
    name: 'photo.jpg',
    persistence: 'data',
    sizeBytes: 1024,
    inputs: [],
    outputs: [{ id: 'p-out', type: 'image', label: 'Image' }],
    ...overrides,
  } as CanvasElement;
}

function videoEl(overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    id: 'v1',
    type: 'video',
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    prompt: 'a cinematic shot',
    inputs: [{ id: 'p-in', type: 'image', label: 'Image' }],
    outputs: [{ id: 'p-out', type: 'video', label: 'Video' }],
    ...overrides,
  } as CanvasElement;
}

function planningEl(overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    id: 'plan1',
    type: 'planning',
    kind: 'plot',
    title: '剧情节点',
    body: '主角发现红色怀表。',
    x: 0,
    y: 0,
    width: 360,
    height: 300,
    outputs: [{ id: 'p-out', type: 'text', label: 'Plan' }],
    inputs: [],
    requirements: [
      {
        id: 'req-confirmed',
        title: '红色怀表',
        materialType: 'prop',
        description: '红色旧怀表特写',
        status: 'confirmed',
      },
      {
        id: 'req-dismissed',
        title: '废弃雨伞',
        materialType: 'prop',
        description: '已被用户忽略',
        status: 'dismissed',
      },
    ],
    ...overrides,
  } as CanvasElement;
}

describe('composeEffectivePrompt', () => {
  it('returns only the local prompt when there are no upstream contributions', () => {
    expect(composeEffectivePrompt('draw a cat', [])).toBe('draw a cat');
  });

  it('prepends upstream contributions before local prompt', () => {
    const result = composeEffectivePrompt('make it blue', [
      { connectionId: 'c1', sourceId: 's1', label: 'text: Hello', content: 'a red ball' },
    ]);
    expect(result).toBe('a red ball\n\nmake it blue');
  });

  it('trims whitespace from each part', () => {
    const result = composeEffectivePrompt('  clean  ', [
      { connectionId: 'c1', sourceId: 's1', label: '', content: '  upstream  ' },
    ]);
    expect(result).toBe('upstream\n\nclean');
  });
});

describe('getUpstreamTextContributions', () => {
  it('collects text from a connected text node and keeps a readable label', () => {
    const source = textEl({ id: 't1', text: 'sunset over mountains' });
    const target = imageEl({
      id: 'img1',
      inputs: [{ id: 'p-in-text', type: 'text', label: 'Prompt' }],
    });
    const connection = conn('c1', 't1', 'img1', 'p-out', 'p-in-text');

    const result = getUpstreamTextContributions('img1', [source, target], [connection]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sourceId: 't1',
      content: 'sunset over mountains',
      label: '文本：sunset over moun...',
    });
  });

  it('accepts connections to any ports and rejects non-text ports', () => {
    const source = textEl({ id: 't1', text: 'hello' });
    const anyTarget = {
      id: 'rect',
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      inputs: [{ id: 'p-in', type: 'any', label: 'In' }],
      outputs: [{ id: 'p-out', type: 'any', label: 'Out' }],
      fill: '#ccc',
    } as CanvasElement;
    const imageTarget = imageEl({
      id: 'img1',
      inputs: [{ id: 'p-in-img', type: 'image', label: 'Ref' }],
    });

    expect(getUpstreamTextContributions('rect', [source, anyTarget], [
      conn('c1', 't1', 'rect', 'p-out', 'p-in'),
    ])).toHaveLength(1);
    expect(getUpstreamTextContributions('img1', [source, imageTarget], [
      conn('c2', 't1', 'img1', 'p-out', 'p-in-img'),
    ])).toHaveLength(0);
  });

  it('skips pendingReview planning drafts and keeps approved drafts as upstream text', () => {
    const pendingDraft = textEl({
      id: 'draft-pending',
      text: 'pending draft context',
      planningDraft: {
        sourcePlanningId: 'plan1',
        sourceRequirementId: 'req-pending',
        projectId: 'project-1',
        status: 'pendingReview',
      },
    });
    const approvedDraft = textEl({
      id: 'draft-approved',
      text: 'approved draft context',
      x: 10,
      planningDraft: {
        sourcePlanningId: 'plan1',
        sourceRequirementId: 'req-approved',
        projectId: 'project-1',
        status: 'approved',
      },
    });
    const target = imageEl({
      id: 'img1',
      inputs: [{ id: 'p-in-text', type: 'text', label: 'Prompt' }],
    });

    const result = getUpstreamTextContributions('img1', [pendingDraft, approvedDraft, target], [
      conn('c-pending', 'draft-pending', 'img1', 'p-out', 'p-in-text'),
      conn('c-approved', 'draft-approved', 'img1', 'p-out', 'p-in-text'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      connectionId: 'c-approved',
      sourceId: 'draft-approved',
      content: 'approved draft context',
    });
  });

  it('sorts contributions by source element position', () => {
    const below = textEl({ id: 't1', text: 'A', x: 100, y: 200 });
    const above = textEl({ id: 't2', text: 'B', x: 100, y: 0 });
    const target = imageEl({
      id: 'img1',
      inputs: [{ id: 'p-in-text', type: 'text', label: 'Prompt' }],
    });

    const result = getUpstreamTextContributions('img1', [below, above, target], [
      conn('c1', 't1', 'img1', 'p-out', 'p-in-text'),
      conn('c2', 't2', 'img1', 'p-out', 'p-in-text'),
    ]);

    expect(result.map(item => item.sourceId)).toEqual(['t2', 't1']);
  });

  it('collects planning text without dismissed requirements', () => {
    const planning = planningEl();
    const target = imageEl({
      id: 'img1',
      inputs: [{ id: 'p-in-text', type: 'text', label: 'Prompt' }],
    });
    const result = getUpstreamTextContributions('img1', [planning, target], [
      conn('c1', 'plan1', 'img1', 'p-out', 'p-in-text'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].content).toContain('剧情节点');
    expect(result[0].content).toContain('红色怀表');
    expect(result[0].content).not.toContain('废弃雨伞');
    expect(result[0].label).toContain('企划');
  });
});

describe('getUpstreamImageContributions', () => {
  it('collects image src from connected image and file(image) nodes', () => {
    const image = imageEl({ id: 'img-src', src: 'data:image/png;base64,xxx' });
    const file = fileImageEl({ id: 'f1' });
    const target = videoEl({
      id: 'v1',
      inputs: [{ id: 'p-in', type: 'image', label: 'Image' }],
    });

    const result = getUpstreamImageContributions('v1', [image, file, target], [
      conn('c1', 'img-src', 'v1', 'p-out', 'p-in'),
      conn('c2', 'f1', 'v1', 'p-out', 'p-in'),
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ sourceId: 'f1', src: 'data:image/jpeg;base64,def', label: 'photo.jpg' });
    expect(result[1]).toMatchObject({ sourceId: 'img-src', src: 'data:image/png;base64,xxx', label: '图像' });
  });

  it('rejects non-image files, empty image sources, and non-image ports', () => {
    const file = fileImageEl({ id: 'f1', mimeType: 'application/pdf' });
    const emptyImage = imageEl({ id: 'img-empty', src: '' });
    const image = imageEl({ id: 'img-src', src: 'data:image/png;base64,zzz' });
    const target = videoEl({
      id: 'v1',
      inputs: [{ id: 'p-in', type: 'image', label: 'Image' }],
    });
    const textTarget = imageEl({
      id: 'img1',
      inputs: [{ id: 'p-in-text', type: 'text', label: 'Prompt' }],
    });

    expect(getUpstreamImageContributions('v1', [file, emptyImage, target], [
      conn('c1', 'f1', 'v1', 'p-out', 'p-in'),
      conn('c2', 'img-empty', 'v1', 'p-out', 'p-in'),
    ])).toHaveLength(0);
    expect(getUpstreamImageContributions('img1', [image, textTarget], [
      conn('c3', 'img-src', 'img1', 'p-out', 'p-in-text'),
    ])).toHaveLength(0);
  });
});
