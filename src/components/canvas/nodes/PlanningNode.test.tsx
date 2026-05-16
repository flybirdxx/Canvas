import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanningElement } from '@/types/canvas';
import { useCanvasStore } from '@/store/useCanvasStore';
import { PlanningNode } from './PlanningNode';

vi.mock('react-konva', () => ({
  Group: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Rect: () => null,
}));

vi.mock('react-konva-utils', () => ({
  Html: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

function makePlanningNode(overrides: Partial<PlanningElement> = {}): PlanningElement {
  return {
    id: 'planning-plot-1',
    type: 'planning',
    kind: 'plot',
    title: '雨夜追车',
    body: '主角发现怀表上的血迹。',
    x: 0,
    y: 0,
    width: 360,
    height: 300,
    requirements: [
      {
        id: 'req-pocket-watch',
        title: '血色怀表特写',
        materialType: 'prop',
        description: '带血痕的旧怀表近景。',
        status: 'pending',
      },
    ],
    ...overrides,
  };
}

describe('PlanningNode', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      elements: [],
      selectedIds: [],
      past: [],
      future: [],
      currentLabel: '初始状态',
      currentTimestamp: 0,
      _coalesceKey: undefined,
      _coalesceAt: undefined,
    } as Partial<ReturnType<typeof useCanvasStore.getState>>);
  });

  it('renders the Chinese kind label and pending requirement', () => {
    const node = makePlanningNode();
    useCanvasStore.setState({ elements: [node] });

    render(<PlanningNode el={node} />);

    expect(screen.getByText('剧情节点')).toBeInTheDocument();
    expect(screen.getByText('血色怀表特写')).toBeInTheDocument();
    expect(screen.getAllByText(/待确认/).length).toBeGreaterThan(0);
  });

  it('confirms a pending requirement in the store', () => {
    const node = makePlanningNode();
    useCanvasStore.setState({ elements: [node] });

    render(<PlanningNode el={node} />);
    fireEvent.click(screen.getByRole('button', { name: '确认' }));

    const updated = useCanvasStore.getState().elements[0];
    expect(updated.type).toBe('planning');
    if (updated.type !== 'planning') throw new Error('expected planning node');
    expect(updated.requirements?.[0]?.status).toBe('confirmed');
    expect(useCanvasStore.getState().currentLabel).toBe('确认素材需求');
  });

  it('dispatches a conversion event for production tasks', () => {
    const node = makePlanningNode({
      id: 'production-task-1',
      kind: 'productionTask',
      recommendedTaskType: 'image',
    });
    const listener = vi.fn();
    window.addEventListener('planning:convert-task', listener);

    render(<PlanningNode el={node} />);
    fireEvent.click(screen.getByRole('button', { name: '转换为生成节点' }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({
      detail: { id: 'production-task-1' },
    });

    window.removeEventListener('planning:convert-task', listener);
  });
});
