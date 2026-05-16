import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { PlanningElement } from '@/types/canvas';
import { PropertiesPanel } from './PropertiesPanel';

function makeProductionTask(overrides: Partial<PlanningElement> = {}): PlanningElement {
  return {
    id: 'production-task-1',
    type: 'planning',
    kind: 'productionTask',
    title: '雨夜怀表特写',
    body: '生成怀表道具的关键画面。',
    x: 20,
    y: 30,
    width: 340,
    height: 260,
    recommendedTaskType: 'image',
    propStates: [{ visibility: 'markOnly' }],
    acceptanceCriteria: '怀表标识清晰可见。',
    ...overrides,
  };
}

describe('PropertiesPanel planning node', () => {
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

  it('shows production task planning fields and updates title/task metadata', () => {
    const node = makeProductionTask();
    useCanvasStore.setState({ elements: [node], selectedIds: [node.id] });

    render(<PropertiesPanel />);

    expect(screen.getByText('属性')).toBeInTheDocument();
    expect(screen.getByLabelText('类型')).toHaveValue('productionTask');
    expect(screen.getByLabelText('任务类型')).toHaveValue('image');
    expect(screen.getByLabelText('道具可见程度')).toHaveValue('markOnly');

    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '新的生产任务标题' } });
    let updated = useCanvasStore.getState().elements[0];
    expect(updated.type).toBe('planning');
    if (updated.type !== 'planning') throw new Error('expected planning node');
    expect(updated.title).toBe('新的生产任务标题');

    fireEvent.change(screen.getByLabelText('任务类型'), { target: { value: 'video' } });
    updated = useCanvasStore.getState().elements[0];
    expect(updated.type).toBe('planning');
    if (updated.type !== 'planning') throw new Error('expected planning node');
    expect(updated.recommendedTaskType).toBe('video');

    fireEvent.change(screen.getByLabelText('道具可见程度'), { target: { value: 'partial' } });
    updated = useCanvasStore.getState().elements[0];
    expect(updated.type).toBe('planning');
    if (updated.type !== 'planning') throw new Error('expected planning node');
    expect(updated.propStates?.[0]).toMatchObject({ visibility: 'partial', userConfirmed: true });
  });
});
