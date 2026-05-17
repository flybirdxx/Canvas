import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeNode } from '@/services/executionEngine';
import { runGeneration } from '@/services/imageGeneration';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useExecutionStore } from '@/store/useExecutionStore';
import type { ImageElement } from '@/types/canvas';

vi.mock('@/services/imageGeneration', () => ({
  runGeneration: vi.fn().mockResolvedValue(undefined),
}));

const execId = 'exec-planning-draft';
const nodeId = 'draft-image';

function makeImageNode(status: 'pendingReview' | 'approved'): ImageElement {
  return {
    id: nodeId,
    type: 'image',
    x: 0,
    y: 0,
    width: 512,
    height: 512,
    src: '',
    prompt: '生成一张测试图',
    generation: {
      model: 'test-model',
    },
    planningDraft: {
      sourcePlanningId: 'planning-1',
      status,
    },
  };
}

function startRun(node: ImageElement): void {
  useCanvasStore.setState({
    elements: [node],
    connections: [],
  });
  useExecutionStore.getState().initRun(execId, [node.id]);
  useExecutionStore.getState().commitExecutionOrder(execId, [[node.id]]);
}

describe('executeNode planning draft guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useExecutionStore.getState().clearRuns();
    useCanvasStore.setState({
      elements: [],
      connections: [],
    });
  });

  it('blocks pendingReview image drafts before generation', async () => {
    startRun(makeImageNode('pendingReview'));

    await executeNode(nodeId, execId);

    expect(runGeneration).not.toHaveBeenCalled();
    const nodeState = useExecutionStore.getState().getRun(execId)?.nodeStates[nodeId];
    expect(nodeState?.status).toBe('failed');
    expect(nodeState?.errorMessage).toBe('此节点来自规划，确认后才能执行');
  });

  it('allows approved image drafts to enter generation', async () => {
    startRun(makeImageNode('approved'));

    await executeNode(nodeId, execId);

    expect(runGeneration).toHaveBeenCalledTimes(1);
  });
});
