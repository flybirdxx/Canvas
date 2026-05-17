import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { NodeInputBar } from './NodeInputBar';
import { useCanvasStore } from '@/store/useCanvasStore';
import { SCREENWRITING_REWRITE_PRESET_SNIPPET } from '@/services/screenwriting';
import type { TextElement } from '@/types/canvas';

function makeTextNode(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: 'text-1',
    type: 'text',
    x: 0,
    y: 0,
    width: 420,
    height: 280,
    text: '原始剧情',
    prompt: '女主在雪夜发现父亲失踪真相',
    fontSize: 14,
    fontFamily: 'var(--font-serif)',
    fill: '#26211c',
    ...overrides,
  };
}

describe('NodeInputBar screenwriting shortcut', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      elements: [],
      selectedIds: [],
      connections: [],
      groups: [],
      past: [],
      future: [],
      currentLabel: '初始状态',
      currentTimestamp: 0,
      _coalesceKey: undefined,
      _coalesceAt: undefined,
      inpaintMask: null,
    } as Partial<ReturnType<typeof useCanvasStore.getState>>);
  });

  it('adds the screenwriting rewrite preset to text node prompts', () => {
    const node = makeTextNode();
    useCanvasStore.setState({ elements: [node] });

    render(<NodeInputBar element={node} x={0} y={0} width={420} scale={1} />);

    fireEvent.click(screen.getByRole('button', { name: '剧本优化续写' }));

    const updated = useCanvasStore.getState().elements.find(element => element.id === node.id);
    expect(updated?.prompt).toContain('女主在雪夜发现父亲失踪真相');
    expect(updated?.prompt).toContain(SCREENWRITING_REWRITE_PRESET_SNIPPET);
    expect(updated?.generation?.appliedPresets).toEqual([
      {
        id: 'text-screenwriting-rewrite',
        snippet: SCREENWRITING_REWRITE_PRESET_SNIPPET,
      },
    ]);
  });

  it('applies the screenwriting preset from the node toolbar event', () => {
    const node = makeTextNode();
    useCanvasStore.setState({ elements: [node] });

    render(<NodeInputBar element={node} x={0} y={0} width={420} scale={1} />);

    window.dispatchEvent(new CustomEvent('node-toolbar:screenwriting', { detail: { id: node.id } }));

    const updated = useCanvasStore.getState().elements.find(element => element.id === node.id);
    expect(updated?.prompt).toContain(SCREENWRITING_REWRITE_PRESET_SNIPPET);
    expect(updated?.generation?.appliedPresets?.[0]?.id).toBe('text-screenwriting-rewrite');
  });

  it('keeps the prompt library panel above the node surface when open', () => {
    const node = makeTextNode();
    useCanvasStore.setState({ elements: [node] });

    const { container } = render(<NodeInputBar element={node} x={0} y={0} width={420} scale={1} />);

    fireEvent.click(screen.getByRole('button', { name: '提示词库' }));

    const searchInput = screen.getByPlaceholderText('搜索风格、关键词、标签…');
    let collapsible: HTMLElement | null = searchInput;
    while (collapsible && collapsible.style.maxHeight === '') {
      collapsible = collapsible.parentElement;
    }

    expect(container.firstElementChild).toHaveStyle({ zIndex: '45' });
    expect(collapsible).toHaveStyle({ overflow: 'visible' });
  });
});
