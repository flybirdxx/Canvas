import { describe, expect, it } from 'vitest';
import type { CanvasElement } from '@/types/canvas';
import type { GroupRecord } from '@/store/types';
import {
  clampElementPositionInGroupFrame,
  expandFrameToIncludeElement,
  resolveGroupFrame,
} from './groupFrame';

function makeText(id: string, x: number, y: number, width = 200, height = 120): CanvasElement {
  return {
    id,
    type: 'text',
    x,
    y,
    width,
    height,
    text: id,
    fontSize: 14,
    fontFamily: 'serif',
    fill: '#1f1a17',
  };
}

describe('groupFrame', () => {
  it('resolves a frame from grouped child bounds when no manual frame exists', () => {
    const group: GroupRecord = { id: 'group-1', childIds: ['a', 'b'] };
    const elements = [
      makeText('a', 100, 120, 200, 100),
      makeText('b', 380, 260, 160, 140),
    ];

    expect(resolveGroupFrame(group, elements)).toEqual({
      x: 76,
      y: 96,
      width: 488,
      height: 328,
    });
  });

  it('prefers a manually resized group frame over child bounds', () => {
    const group: GroupRecord = {
      id: 'group-1',
      childIds: ['a', 'b'],
      frame: { x: 10, y: 20, width: 900, height: 500 },
    };

    expect(resolveGroupFrame(group, [makeText('a', 100, 120), makeText('b', 380, 260)])).toEqual(group.frame);
  });

  it('clamps child movement inside the group frame without resizing the child', () => {
    const element = makeText('a', 120, 120, 200, 100);
    const frame = { x: 100, y: 100, width: 500, height: 300 };

    expect(clampElementPositionInGroupFrame(element, frame, 40, 90)).toEqual({ x: 100, y: 100 });
    expect(clampElementPositionInGroupFrame(element, frame, 700, 500)).toEqual({ x: 400, y: 300 });
    expect(element).toMatchObject({ width: 200, height: 100 });
  });

  it('expands a manual group frame to include a new generated child', () => {
    expect(
      expandFrameToIncludeElement(
        { x: 100, y: 100, width: 300, height: 240 },
        makeText('draft', 520, 420, 180, 120),
      ),
    ).toEqual({
      x: 100,
      y: 100,
      width: 624,
      height: 464,
    });
  });
});
