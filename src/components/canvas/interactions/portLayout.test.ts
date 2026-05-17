import { describe, expect, it } from 'vitest';
import type { CanvasElement } from '@/types/canvas';
import { findPortLayoutHit, getPortLayout } from './portLayout';

const element = {
  id: 'node-1',
  type: 'image',
  x: 100,
  y: 200,
  width: 300,
  height: 180,
  src: '',
  inputs: [
    { id: 'prompt', type: 'text', label: 'Prompt' },
    { id: 'ref', type: 'image', label: 'Ref' },
  ],
  outputs: [
    { id: 'image', type: 'image', label: 'Image' },
  ],
} as CanvasElement;

describe('portLayout', () => {
  it('uses the same local and canvas positions for rendered ports', () => {
    const layout = getPortLayout(element);

    expect(layout.inputs.map(item => ({
      id: item.port.id,
      localX: item.localX,
      localY: item.localY,
      canvasX: item.canvasX,
      canvasY: item.canvasY,
    }))).toEqual([
      { id: 'prompt', localX: 0, localY: 60, canvasX: 100, canvasY: 260 },
      { id: 'ref', localX: 0, localY: 120, canvasX: 100, canvasY: 320 },
    ]);

    expect(layout.outputs.map(item => ({
      id: item.port.id,
      localX: item.localX,
      localY: item.localY,
      canvasX: item.canvasX,
      canvasY: item.canvasY,
    }))).toEqual([
      { id: 'image', localX: 300, localY: 90, canvasX: 400, canvasY: 290 },
    ]);
  });

  it('finds compatible input ports by visible port position', () => {
    const hit = findPortLayoutHit({
      element,
      x: 103,
      y: 263,
      isDrawingFromOutput: true,
      fromPortType: 'text',
      threshold: 20,
    });

    expect(hit).toMatchObject({
      port: { id: 'prompt' },
      isInput: true,
    });
  });

  it('falls back to compatible ports inside the node body', () => {
    const hit = findPortLayoutHit({
      element,
      x: 240,
      y: 260,
      isDrawingFromOutput: true,
      fromPortType: 'image',
      threshold: 20,
    });

    expect(hit).toMatchObject({
      port: { id: 'ref' },
      isInput: true,
    });
  });
});
