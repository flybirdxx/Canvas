import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { TextElement } from '@/types/canvas';
import { useSnapCallbacks } from './useSnapCallbacks';

function makeText(id: string, x: number, y: number): TextElement {
  return {
    id,
    type: 'text',
    x,
    y,
    width: 200,
    height: 120,
    text: id,
    fontSize: 14,
    fontFamily: 'serif',
    fill: '#1f1a17',
  };
}

describe('useSnapCallbacks', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      elements: [],
      connections: [],
      groups: [],
      selectedIds: [],
      past: [],
      future: [],
      currentLabel: '初始状态',
      currentTimestamp: 0,
      _coalesceKey: undefined,
      _coalesceAt: undefined,
    } as Partial<ReturnType<typeof useCanvasStore.getState>>);
  });

  it('moves only the dragged child when a node inside a group is dragged', () => {
    const story = makeText('story', 100, 120);
    const note = makeText('note', 420, 120);
    useCanvasStore.setState({
      elements: [story, note],
      groups: [
        {
          id: 'group-1',
          childIds: [story.id, note.id],
          frame: { x: 80, y: 100, width: 640, height: 260 },
        },
      ],
    });

    const altRef = { current: false };
    const { result } = renderHook(() => useSnapCallbacks(altRef));

    act(() => {
      result.current.snapCallbacks.onDragEnd(story.id, 180, 160);
    });

    expect(useCanvasStore.getState().elements).toEqual([
      { ...story, x: 180, y: 160 },
      note,
    ]);
  });
});
