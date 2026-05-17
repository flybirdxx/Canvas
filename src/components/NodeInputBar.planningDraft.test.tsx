import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { NodeInputBar } from './NodeInputBar';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { ImageElement } from '@/types/canvas';

function makePendingDraftImage(overrides: Partial<ImageElement> = {}): ImageElement {
  return {
    id: 'image-draft-1',
    type: 'image',
    x: 0,
    y: 0,
    width: 400,
    height: 400,
    src: '',
    prompt: '生成一张雨夜怀表特写',
    planningDraft: {
      sourcePlanningId: 'planning-1',
      sourceRequirementId: 'req-watch',
      projectId: 'project-1',
      status: 'pendingReview',
    },
    ...overrides,
  };
}

describe('NodeInputBar planning draft review', () => {
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

  it('shows pending review state, disables submit, and approves the draft node', () => {
    const node = makePendingDraftImage();
    useCanvasStore.setState({ elements: [node] });

    render(<NodeInputBar element={node} x={0} y={0} width={420} scale={1} />);

    expect(screen.getByText('来自规划 · 待确认')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '确认可执行' }));

    const updated = useCanvasStore.getState().elements.find(element => element.id === node.id);
    expect(updated?.planningDraft?.status).toBe('approved');
  });
});
