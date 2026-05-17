import { describe, it, expect } from 'vitest';
import {
  composeEffectivePrompt,
  getUpstreamTextContributions,
  getUpstreamImageContributions,
} from '@/utils/flowResolver';
import type { CanvasElement, Connection } from '@/types/canvas';

// ─── helpers ────────────────────────────────────────────────────────

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
  } as any;
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

// ─── composeEffectivePrompt ──────────────────────────────────────────

describe('composeEffectivePrompt', () => {
  it('should return only the local prompt when there are no upstream contributions', () => {
    const result = composeEffectivePrompt('draw a cat', []);
    expect(result).toBe('draw a cat');
  });

  it('should prepend upstream contributions before local prompt', () => {
    const result = composeEffectivePrompt('make it blue', [
      {
        connectionId: 'c1',
        sourceId: 's1',
        label: 'text: Hello',
        content: 'a red ball',
      },
    ]);
    expect(result).toBe('a red ball\n\nmake it blue');
  });

  it('should join multiple upstream contributions', () => {
    const result = composeEffectivePrompt('', [
      {
        connectionId: 'c1',
        sourceId: 's1',
        label: 'text: Hello',
        content: 'first context',
      },
      {
        connectionId: 'c2',
        sourceId: 's2',
        label: 'text: World',
        content: 'second context',
      },
    ]);
    expect(result).toBe('first context\n\nsecond context');
  });

  it('should trim whitespace from each part', () => {
    const result = composeEffectivePrompt('  clean  ', [
      {
        connectionId: 'c1',
        sourceId: 's1',
        label: '',
        content: '  upstream  ',
      },
    ]);
    expect(result).toBe('upstream\n\nclean');
  });

  it('should handle empty local prompt and empty upstream gracefully', () => {
    const result = composeEffectivePrompt('', []);
    expect(result).toBe('');
  });
});

// ─── getUpstreamTextContributions ────────────────────────────────────

describe('getUpstreamTextContributions', () => {
  it('should return an empty array if the target does not exist', () => {
    const result = getUpstreamTextContributions('ghost', [], []);
    expect(result).toEqual([]);
  });

  it('should collect text from a connected text node', () => {
    const tn = textEl({ id: 't1', text: 'sunset over mountains' });
    const target = imageEl({
      id: 'img1',
      inputs: [{ id: 'p-in-text', type: 'text', label: 'Prompt' }],
    });
    const c = conn('c1', 't1', 'img1', 'p-out', 'p-in-text');

    const result = getUpstreamTextContributions('img1', [tn, target], [c]);
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe('t1');
    expect(result[0].content).toBe('sunset over mountains');
  });

  it('should accept connections to "any" ports', () => {
    const tn = textEl({ id: 't1', text: 'hello' });
    const target: CanvasElement = {
      id: 'rect',
      type: 'rectangle',
      x: 0, y: 0, width: 100, height: 100,
      inputs: [{ id: 'p-in', type: 'any', label: 'In' }],
      outputs: [{ id: 'p-out', type: 'any', label: 'Out' }],
      fill: '#ccc',
    } as CanvasElement;
    const c = conn('c1', 't1', 'rect', 'p-out', 'p-in');

    const result = getUpstreamTextContributions('rect', [tn, target], [c]);
    expect(result).toHaveLength(1);
  });

  it('should reject connections to non-text / non-any ports', () => {
    const tn = textEl({ id: 't1', text: 'hello' });
    const target = imageEl({
      id: 'img1',
      inputs: [{ id: 'p-in-img', type: 'image', label: 'Ref' }],
    });
    // Connect a TEXT output to an IMAGE input — should not be a text contribution
    const c = conn('c1', 't1', 'img1', 'p-out', 'p-in-img');

    const result = getUpstreamTextContributions('img1', [tn, target], [c]);
    expect(result).toHaveLength(0);
  });

  it('should filter out empty upstream content', () => {
    const tn = textEl({ id: 't1', text: '  ' }); // whitespace only
    const target = imageEl({
      id: 'img1',
      inputs: [{ id: 'p-in-text', type: 'text', label: 'Prompt' }],
    });
    const c = conn('c1', 't1', 'img1', 'p-out', 'p-in-text');

    const result = getUpstreamTextContributions('img1', [tn, target], [c]);
    expect(result).toHaveLength(0);
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
    const connections = [
      conn('c-pending', 'draft-pending', 'img1', 'p-out', 'p-in-text'),
      conn('c-approved', 'draft-approved', 'img1', 'p-out', 'p-in-text'),
    ];

    const result = getUpstreamTextContributions('img1', [pendingDraft, approvedDraft, target], connections);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      connectionId: 'c-approved',
      sourceId: 'draft-approved',
      content: 'approved draft context',
    });
  });

  it('should sort contributions by source element position (top-to-bottom, left-to-right)', () => {
    const tn1 = textEl({ id: 't1', text: 'A', x: 100, y: 200 });  // below
    const tn2 = textEl({ id: 't2', text: 'B', x: 100, y: 0 });    // above
    const target = imageEl({
      id: 'img1',
      inputs: [{ id: 'p-in-text', type: 'text', label: 'Prompt' }],
    });
    const c1 = conn('c1', 't1', 'img1', 'p-out', 'p-in-text');
    const c2 = conn('c2', 't2', 'img1', 'p-out', 'p-in-text');

    const result = getUpstreamTextContributions('img1', [tn1, tn2, target], [c1, c2]);
    expect(result).toHaveLength(2);
    // B (y=0) should come before A (y=200)
    expect(result[0].sourceId).toBe('t2');
    expect(result[1].sourceId).toBe('t1');
  });

  it('should only consider connections targeting the given targetId', () => {
    const tn = textEl({ id: 't1', text: 'hello' });
    const target = imageEl({
      id: 'img1',
      inputs: [{ id: 'p-in-text', type: 'text', label: 'Prompt' }],
    });
    const otherTarget = imageEl({ id: 'img2' });
    const c1 = conn('c1', 't1', 'img1', 'p-out', 'p-in-text');
    const c2 = conn('c2', 't1', 'img2', 'p-out', 'p-in-text');

    const result = getUpstreamTextContributions('img1', [tn, target, otherTarget], [c1, c2]);
    // Only c1 targets img1
    expect(result).toHaveLength(1);
  });

  it('collects planning text without dismissed requirements', () => {
    const planning = planningEl();
    const target = imageEl({
      id: 'img1',
      inputs: [{ id: 'p-in-text', type: 'text', label: 'Prompt' }],
    });
    const c = conn('c1', 'plan1', 'img1', 'p-out', 'p-in-text');

    const result = getUpstreamTextContributions('img1', [planning, target], [c]);

    expect(result).toHaveLength(1);
    expect(result[0].content).toContain('剧情节点');
    expect(result[0].content).toContain('红色怀表');
    expect(result[0].content).not.toContain('废弃雨伞');
    expect(result[0].label).toContain('企划');
  });
});

// ─── getUpstreamImageContributions ───────────────────────────────────

describe('getUpstreamImageContributions', () => {
  it('should return an empty array if the target does not exist', () => {
    const result = getUpstreamImageContributions('ghost', [], []);
    expect(result).toEqual([]);
  });

  it('should collect an image src from a connected image node', () => {
    const src = imageEl({ id: 'img-src', src: 'data:image/png;base64,xxx' });
    const target = videoEl({
      id: 'v1',
      inputs: [{ id: 'p-in', type: 'image', label: 'Image' }],
    });
    const c = conn('c1', 'img-src', 'v1', 'p-out', 'p-in');

    const result = getUpstreamImageContributions('v1', [src, target], [c]);
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe('img-src');
    expect(result[0].src).toBe('data:image/png;base64,xxx');
  });

  it('should collect an image src from a connected file(image) node', () => {
    const file = fileImageEl({ id: 'f1' });
    const target = videoEl({
      id: 'v1',
      inputs: [{ id: 'p-in', type: 'image', label: 'Image' }],
    });
    const c = conn('c1', 'f1', 'v1', 'p-out', 'p-in');

    const result = getUpstreamImageContributions('v1', [file, target], [c]);
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe('f1');
    expect(result[0].src).toBe('data:image/jpeg;base64,def');
  });

  it('should reject a file node whose MIME type is not image/*', () => {
    const file = fileImageEl({ id: 'f1', mimeType: 'application/pdf' });
    const target = videoEl({
      id: 'v1',
      inputs: [{ id: 'p-in', type: 'image', label: 'Image' }],
    });
    const c = conn('c1', 'f1', 'v1', 'p-out', 'p-in');

    const result = getUpstreamImageContributions('v1', [file, target], [c]);
    expect(result).toHaveLength(0);
  });

  it('should accept connections to "any" ports', () => {
    const src = imageEl({ id: 'img-src', src: 'data:image/png;base64,yyy' });
    const target: CanvasElement = {
      id: 'rect',
      type: 'rectangle',
      x: 0, y: 0, width: 100, height: 100,
      inputs: [{ id: 'p-in', type: 'any', label: 'In' }],
      outputs: [{ id: 'p-out', type: 'any', label: 'Out' }],
      fill: '#ccc',
    } as CanvasElement;
    const c = conn('c1', 'img-src', 'rect', 'p-out', 'p-in');

    const result = getUpstreamImageContributions('rect', [src, target], [c]);
    expect(result).toHaveLength(1);
    expect(result[0].src).toBe('data:image/png;base64,yyy');
  });

  it('should filter out image sources without a valid src', () => {
    const src = imageEl({ id: 'img-src', src: '' }); // empty src
    const target = videoEl({
      id: 'v1',
      inputs: [{ id: 'p-in', type: 'image', label: 'Image' }],
    });
    const c = conn('c1', 'img-src', 'v1', 'p-out', 'p-in');

    const result = getUpstreamImageContributions('v1', [src, target], [c]);
    expect(result).toHaveLength(0);
  });

  it('should reject connections to non-image / non-any ports', () => {
    const src = imageEl({ id: 'img-src', src: 'data:image/png;base64,zzz' });
    const target = imageEl({
      id: 'img1',
      inputs: [{ id: 'p-in-text', type: 'text', label: 'Prompt' }],
    });
    const c = conn('c1', 'img-src', 'img1', 'p-out', 'p-in-text');

    const result = getUpstreamImageContributions('img1', [src, target], [c]);
    expect(result).toHaveLength(0);
  });
});
