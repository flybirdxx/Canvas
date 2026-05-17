import { describe, expect, it, vi } from 'vitest';
import type { TextElement } from '@/types/canvas';
import {
  getFrameDragDelta,
  getGroupChildDragOffsets,
  getNodeDragDelta,
  resolveNodeVisualPosition,
  resolveNodeDragBound,
  resolveNodeDragBoundAbsolute,
} from './dragController';

function makeText(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: 'text-1',
    type: 'text',
    x: 100,
    y: 120,
    width: 200,
    height: 100,
    text: 'Story',
    fontSize: 14,
    fontFamily: 'serif',
    fill: '#1f1a17',
    ...overrides,
  };
}

describe('dragController', () => {
  it('keeps nodes fixed while a connection is being drawn', () => {
    const element = makeText();

    expect(resolveNodeDragBound({
      element,
      proposed: { x: 500, y: 600 },
      drawingConnection: true,
    })).toEqual({ x: 100, y: 120 });
  });

  it('applies snapping before group-frame clamping', () => {
    const element = makeText();
    const computeSnap = vi.fn(() => ({ x: 480, y: 360 }));

    expect(resolveNodeDragBound({
      element,
      proposed: { x: 470, y: 350 },
      origin: { x: 100, y: 120 },
      drawingConnection: false,
      groupFrame: { x: 80, y: 90, width: 420, height: 300 },
      computeSnap,
    })).toEqual({ x: 300, y: 290 });
    expect(computeSnap).toHaveBeenCalledWith('text-1', 470, 350, 100, 120, 200, 100);
  });

  it('returns proposed canvas coordinates when no group frame applies', () => {
    expect(resolveNodeDragBound({
      element: makeText(),
      proposed: { x: -300, y: 800 },
      drawingConnection: false,
    })).toEqual({ x: -300, y: 800 });
  });

  it('computes drag delta from store position to visual position', () => {
    expect(getNodeDragDelta(makeText(), { x: 160, y: 90 })).toEqual({ x: 60, y: -30 });
  });

  it('clamps grouped node visual positions in canvas coordinates', () => {
    expect(resolveNodeVisualPosition({
      element: makeText(),
      visualPosition: { x: 500, y: 40 },
      groupFrame: { x: 80, y: 90, width: 420, height: 300 },
    })).toEqual({ x: 300, y: 90 });
  });

  it('computes group frame drag delta from the drag-start frame', () => {
    expect(getFrameDragDelta(
      { x: 80, y: 90, width: 420, height: 300 },
      { x: 140, y: 40 },
    )).toEqual({ x: 60, y: -50 });
  });

  it('creates live drag offsets for existing group children only', () => {
    const story = makeText({ id: 'story' });
    const note = makeText({ id: 'note' });

    expect(getGroupChildDragOffsets(['story', 'missing', 'note'], [story, note], { x: 32, y: 12 })).toEqual([
      { id: 'story', dx: 32, dy: 12 },
      { id: 'note', dx: 32, dy: 12 },
    ]);
  });

  it('converts Konva absolute dragBound coordinates before applying canvas-space group bounds', () => {
    const element = makeText({ x: 1000, y: 1200 });
    const coordinates = {
      toCanvas: (point: { x: number; y: number }) => ({
        x: (point.x - 40) / 0.1,
        y: (point.y - 20) / 0.1,
      }),
      toAbsolute: (point: { x: number; y: number }) => ({
        x: point.x * 0.1 + 40,
        y: point.y * 0.1 + 20,
      }),
    };

    expect(resolveNodeDragBoundAbsolute({
      element,
      proposedAbsolute: { x: 900, y: 920 },
      origin: { x: 1000, y: 1200 },
      drawingConnection: false,
      groupFrame: { x: 900, y: 1100, width: 500, height: 400 },
      coordinates,
    })).toEqual({ x: 160, y: 160 });
  });
});
