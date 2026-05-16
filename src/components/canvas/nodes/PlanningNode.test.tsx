import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanningElement } from '@/types/canvas';
import { useCanvasStore } from '@/store/useCanvasStore';
import { listModels } from '@/services/gateway';
import { generateShortDramaPlanning } from '@/services/planning';
import { PlanningNode } from './PlanningNode';

vi.mock('react-konva', () => ({
  Group: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Rect: () => null,
}));

vi.mock('react-konva-utils', () => ({
  Html: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/gateway', () => ({
  listModels: vi.fn(),
}));

vi.mock('@/services/planning', () => ({
  generateShortDramaPlanning: vi.fn(),
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
    vi.clearAllMocks();
    useCanvasStore.setState({
      elements: [],
      selectedIds: [],
      past: [],
      future: [],
      currentLabel: '初始状态',
      currentTimestamp: 0,
      _coalesceKey: undefined,
      _coalesceAt: undefined,
      connections: [],
    } as Partial<ReturnType<typeof useCanvasStore.getState>>);
    vi.mocked(listModels).mockReturnValue([{
      id: 'text-model-1',
      providerId: 'test-provider',
      label: 'Text Model',
      capability: 'text',
    }]);
    vi.mocked(generateShortDramaPlanning).mockResolvedValue({
      storyBible: { id: 'story-bible-source', title: '故事圣经', body: '主线设定' },
      characters: [],
      plots: [],
    });
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

  it('creates one production task from a confirmed plot requirement and prevents duplicates', () => {
    const node = makePlanningNode({
      outputs: [{ id: 'plot-output-1', type: 'text', label: 'Plan' }],
      requirements: [
        {
          id: 'req-scene',
          title: '雨夜仓库场景图',
          materialType: 'scene',
          description: '仓库外景，雨夜，破损霓虹灯。',
          status: 'confirmed',
        },
      ],
    });
    useCanvasStore.setState({ elements: [node], connections: [] });

    render(<PlanningNode el={node} />);
    const button = screen.getByRole('button', { name: '创建任务节点' });

    fireEvent.click(button);
    fireEvent.click(button);

    const productionTasks = useCanvasStore.getState().elements.filter(element =>
      element.type === 'planning' &&
      element.kind === 'productionTask' &&
      element.sourcePlanningId === node.id &&
      element.title === '雨夜仓库场景图',
    );
    expect(productionTasks).toHaveLength(1);
    expect(productionTasks[0].x).toBe(node.x + node.width + 80);
    expect(productionTasks[0].inputs?.[0]?.id).toBeTruthy();
    expect(useCanvasStore.getState().connections).toHaveLength(1);
    expect(useCanvasStore.getState().connections[0]).toMatchObject({
      fromId: node.id,
      fromPortId: 'plot-output-1',
      toId: productionTasks[0].id,
      toPortId: productionTasks[0].inputs?.[0]?.id,
    });
  });

  function convertProductionTask(recommendedTaskType: NonNullable<PlanningElement['recommendedTaskType']>) {
    const node = makePlanningNode({
      id: `production-task-${recommendedTaskType}`,
      kind: 'productionTask',
      recommendedTaskType,
      outputs: [{ id: 'task-output-1', type: 'text', label: 'Plan' }],
    });
    useCanvasStore.setState({ elements: [node], connections: [] });

    render(<PlanningNode el={node} />);
    fireEvent.click(screen.getByRole('button', { name: '转换为生成节点' }));

    const state = useCanvasStore.getState();
    const originalTask = state.elements.find(element => element.id === node.id);
    const executionNode = state.elements.find(element => element.id !== node.id);

    return { executionNode, node, originalTask, state };
  }

  it('copy-converts image production tasks into selected execution nodes and connects text-compatible inputs', () => {
    const { executionNode, node, originalTask, state } = convertProductionTask('image');

    expect(originalTask).toMatchObject({
      id: 'production-task-image',
      type: 'planning',
      kind: 'productionTask',
    });
    expect(executionNode).toMatchObject({
      type: 'image',
      x: node.x + node.width + 80,
      y: node.y,
    });
    expect(state.selectedIds).toEqual([executionNode?.id]);
    expect(state.connections).toHaveLength(1);
    expect(state.connections[0]).toMatchObject({
      fromId: node.id,
      fromPortId: 'task-output-1',
      toId: executionNode?.id,
      toPortId: executionNode?.inputs?.[0]?.id,
    });
    expect(state.connections[0].fromPortId).not.toBe('');
    expect(state.connections[0].toPortId).not.toBe('');
  });

  it('does not connect video production tasks to image-only execution inputs', () => {
    const { executionNode, node, originalTask, state } = convertProductionTask('video');

    expect(originalTask).toMatchObject({
      id: 'production-task-video',
      type: 'planning',
      kind: 'productionTask',
    });
    expect(executionNode).toMatchObject({
      type: 'video',
      x: node.x + node.width + 80,
      y: node.y,
    });
    expect(executionNode?.inputs?.[0]).toMatchObject({ type: 'image' });
    expect(state.selectedIds).toEqual([executionNode?.id]);
    expect(state.connections).toEqual([]);
  });

  it('connects audio production tasks to text-compatible execution inputs', () => {
    const { executionNode, node, state } = convertProductionTask('audio');

    expect(executionNode).toMatchObject({
      type: 'audio',
      x: node.x + node.width + 80,
      y: node.y,
    });
    expect(state.selectedIds).toEqual([executionNode?.id]);
    expect(state.connections).toHaveLength(1);
    expect(state.connections[0]).toMatchObject({
      fromId: node.id,
      fromPortId: 'task-output-1',
      toId: executionNode?.id,
      toPortId: executionNode?.inputs?.find(input => input.type === 'text')?.id,
    });
  });

  it('copy-converts text production tasks without creating a connection when the execution node has no inputs', () => {
    const { executionNode, node, originalTask, state } = convertProductionTask('text');

    expect(originalTask).toMatchObject({
      id: 'production-task-text',
      type: 'planning',
      kind: 'productionTask',
    });
    expect(executionNode).toMatchObject({
      type: 'text',
      x: node.x + node.width + 80,
      y: node.y,
    });
    expect(executionNode?.inputs ?? []).toEqual([]);
    expect(state.selectedIds).toEqual([executionNode?.id]);
    expect(state.connections).toEqual([]);
  });

  it('renders a story bible generation button for project seeds', () => {
    const node = makePlanningNode({
      id: 'project-seed-1',
      kind: 'projectSeed',
      title: '短剧项目种子',
      body: '一句短剧想法',
      requirements: [],
    });

    render(<PlanningNode el={node} />);

    expect(screen.getByRole('button', { name: '生成故事圣经' })).toBeInTheDocument();
  });

  it('generates planning nodes and connections from a project seed', async () => {
    const node = makePlanningNode({
      id: 'project-seed-1',
      kind: 'projectSeed',
      title: '短剧项目种子',
      body: '一句短剧想法',
      requirements: [],
      outputs: [{ id: 'seed-output-1', type: 'text', label: 'Plan' }],
    });
    useCanvasStore.setState({ elements: [node], connections: [] });

    render(<PlanningNode el={node} />);
    fireEvent.click(screen.getByRole('button', { name: '生成故事圣经' }));

    await waitFor(() => {
      expect(generateShortDramaPlanning).toHaveBeenCalledWith('一句短剧想法', 'text-model-1');
      expect(useCanvasStore.getState().elements).toHaveLength(2);
    });

    const generated = useCanvasStore.getState().elements[1];
    expect(generated.type).toBe('planning');
    if (generated.type !== 'planning') throw new Error('expected generated planning node');
    expect(generated.kind).toBe('storyBible');
    expect(generated.title).toBe('故事圣经');
    expect(useCanvasStore.getState().connections).toHaveLength(1);
    expect(useCanvasStore.getState().connections[0]).toMatchObject({
      fromId: 'project-seed-1',
      fromPortId: 'seed-output-1',
      toId: generated.id,
      toPortId: generated.inputs?.[0]?.id,
    });
  });

  it('shows a visible error when no text model is available', async () => {
    vi.mocked(listModels).mockReturnValue([]);
    const node = makePlanningNode({
      id: 'project-seed-1',
      kind: 'projectSeed',
      title: '短剧项目种子',
      body: '一句短剧想法',
      requirements: [],
    });

    render(<PlanningNode el={node} />);
    fireEvent.click(screen.getByRole('button', { name: '生成故事圣经' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('没有可用的文本模型');
    expect(generateShortDramaPlanning).not.toHaveBeenCalled();
  });
});
