import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TextElement } from '@/types/canvas';
import { NodeInputBarOverlay } from './NodeInputBarOverlay';
import { clearGroupDragOffsets, setGroupDragOffsets } from '../dragOffsets';

vi.mock('@/components/input-bar/NodeInputBar', () => ({
  NodeInputBar: ({ x, y }: { x: number; y: number }) => (
    <div data-testid="node-input-bar" data-x={x} data-y={y} />
  ),
}));

function makeTextNode(): TextElement {
  return {
    id: 'text-1',
    type: 'text',
    x: 100,
    y: 120,
    width: 300,
    height: 180,
    text: '剧情',
    fontSize: 14,
    fontFamily: 'serif',
    fill: '#1f1a17',
  };
}

describe('NodeInputBarOverlay', () => {
  it('rerenders selected node input bars while group drag offsets change', () => {
    const text = makeTextNode();
    const { getByTestId } = render(
      <NodeInputBarOverlay
        elements={[text]}
        selectedIds={[text.id]}
        stageConfig={{ x: 10, y: 20, scale: 1 }}
      />,
    );

    expect(getByTestId('node-input-bar')).toHaveAttribute('data-x', '110');
    expect(getByTestId('node-input-bar')).toHaveAttribute('data-y', '326');

    act(() => {
      setGroupDragOffsets([{ id: text.id, dx: 80, dy: 40 }]);
    });

    expect(getByTestId('node-input-bar')).toHaveAttribute('data-x', '190');
    expect(getByTestId('node-input-bar')).toHaveAttribute('data-y', '366');

    act(() => {
      clearGroupDragOffsets([text.id]);
    });
  });
});
