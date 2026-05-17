import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasElement, PlanningElement } from '@/types/canvas';
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
      groups: [],
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
      plots: [
        {
          id: 'plot-source-1',
          title: '第一幕反转',
          body: '主角发现新线索',
          requirements: [],
        },
      ],
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

  it('shows a restrained prompt for conflicting prop visuals', () => {
    const node = makePlanningNode({
      title: '红色怀表线索',
      body: '主角必须看见红色怀表上的家族标识。',
      requirements: [
        {
          id: 'req-pocket-watch',
          title: '银色怀表特写',
          materialType: 'prop',
          description: '银色旧怀表，带蓝宝石标记。',
          status: 'pending',
        },
      ],
    });
    useCanvasStore.setState({ elements: [node] });

    render(<PlanningNode el={node} />);

    expect(screen.getByText('视觉设定可能不一致，由用户自行分辨')).toBeInTheDocument();
  });

  it('does not show the prop visual prompt for non-conflicting props or non-prop requirements', () => {
    const prompt = '视觉设定可能不一致，由用户自行分辨';

    const nonConflictingProp = makePlanningNode({
      title: '红色怀表线索',
      body: '主角必须看见红色怀表。',
      requirements: [
        {
          id: 'req-red-watch',
          title: '红色怀表特写',
          materialType: 'prop',
          description: '红色旧怀表近景。',
          status: 'pending',
        },
      ],
    });
    const { unmount } = render(<PlanningNode el={nonConflictingProp} />);

    expect(screen.queryByText(prompt)).not.toBeInTheDocument();
    unmount();

    const nonProp = makePlanningNode({
      title: '红色仓库线索',
      body: '主角必须看见红色仓库门。',
      requirements: [
        {
          id: 'req-silver-scene',
          title: '银色仓库门',
          materialType: 'scene',
          description: '银色仓库门远景。',
          status: 'pending',
        },
      ],
    });
    render(<PlanningNode el={nonProp} />);

    expect(screen.queryByText(prompt)).not.toBeInTheDocument();
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

  it('keeps confirmation available when a prop visual prompt is shown', () => {
    const node = makePlanningNode({
      title: '红色怀表线索',
      body: '主角必须看见红色怀表。',
      requirements: [
        {
          id: 'req-pocket-watch',
          title: '银色怀表特写',
          materialType: 'prop',
          description: '银色旧怀表近景。',
          status: 'pending',
        },
      ],
    });
    useCanvasStore.setState({ elements: [node] });

    render(<PlanningNode el={node} />);
    expect(screen.getByText('视觉设定可能不一致，由用户自行分辨')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认' }));

    const updated = useCanvasStore.getState().elements[0];
    expect(updated.type).toBe('planning');
    if (updated.type !== 'planning') throw new Error('expected planning node');
    expect(updated.requirements?.[0]?.status).toBe('confirmed');
  });

  it('creates one selected draft execution node from a confirmed plot requirement and prevents duplicates', () => {
    const node = makePlanningNode({
      projectId: 'project-1',
      outputs: [{ id: 'plot-output-1', type: 'text', label: 'Plan' }],
      requirements: [
        {
          id: 'req-prop',
          title: '血色怀表特写',
          materialType: 'prop',
          description: '带血痕的旧怀表近景。',
          status: 'confirmed',
        },
      ],
    });
    useCanvasStore.setState({ elements: [node], connections: [] });

    render(<PlanningNode el={node} />);
    const button = screen.getByRole('button', { name: '创建执行节点' });

    fireEvent.click(button);
    fireEvent.click(button);

    const state = useCanvasStore.getState();
    const draftNodes = state.elements.filter(element =>
      element.planningDraft?.sourcePlanningId === node.id &&
      element.planningDraft?.sourceRequirementId === 'req-prop',
    );
    expect(draftNodes).toHaveLength(1);
    expect(draftNodes[0]).toMatchObject({
      type: 'image',
      x: node.x + node.width + 80,
      y: node.y,
      planningDraft: {
        sourcePlanningId: node.id,
        sourceRequirementId: 'req-prop',
        projectId: 'project-1',
        status: 'pendingReview',
      },
    });
    expect(state.elements.some(element =>
      element.type === 'planning' &&
      element.kind === 'productionTask' &&
      element.sourcePlanningId === node.id,
    )).toBe(false);
    expect(state.selectedIds).toEqual([draftNodes[0].id]);
    const compatibleInput = draftNodes[0].inputs?.find(input =>
      input.type === 'text' || input.type === 'any',
    );
    expect(compatibleInput?.id).toBeTruthy();
    expect(state.connections).toHaveLength(1);
    expect(state.connections[0]).toMatchObject({
      fromId: node.id,
      fromPortId: 'plot-output-1',
      toId: draftNodes[0].id,
      toPortId: compatibleInput?.id,
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

  it('labels legacy production task planning nodes while keeping conversion available', () => {
    const node = makePlanningNode({
      id: 'production-task-legacy',
      kind: 'productionTask',
      recommendedTaskType: 'image',
    });
    useCanvasStore.setState({ elements: [node], connections: [] });

    render(<PlanningNode el={node} />);

    expect(screen.getByText('旧版任务卡')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '转换为生成节点' })).toBeInTheDocument();
  });

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

  it('renders a planning structure generation button for project seeds', () => {
    const node = makePlanningNode({
      id: 'project-seed-1',
      kind: 'projectSeed',
      title: '短剧项目种子',
      body: '一句短剧想法',
      requirements: [],
    });

    render(<PlanningNode el={node} />);

    expect(screen.getByRole('button', { name: '生成规划结构' })).toBeInTheDocument();
  });

  it('summarizes generated project nodes and pending execution drafts for project seeds', () => {
    const node = makePlanningNode({
      id: 'project-seed-1',
      kind: 'projectSeed',
      projectId: 'project-1',
      generatedNodeIds: ['story-text-1', 'plot-text-1', 'draft-image-1'],
      title: '短剧项目种子',
      body: '一句短剧想法',
      requirements: [],
    });
    const projectNodes: CanvasElement[] = [
      {
        id: 'story-text-1',
        type: 'text',
        x: 420,
        y: 0,
        width: 240,
        height: 160,
        text: '故事圣经',
        fontSize: 16,
        fontFamily: 'var(--font-sans)',
        fill: '#1f1b16',
      },
      {
        id: 'plot-text-1',
        type: 'text',
        x: 420,
        y: 190,
        width: 240,
        height: 160,
        text: '剧情节点',
        fontSize: 16,
        fontFamily: 'var(--font-sans)',
        fill: '#1f1b16',
      },
      {
        id: 'draft-image-1',
        type: 'image',
        x: 700,
        y: 0,
        width: 240,
        height: 160,
        src: '',
        planningDraft: {
          sourcePlanningId: 'planning-plot-1',
          sourceRequirementId: 'req-image-1',
          projectId: 'project-1',
          status: 'pendingReview',
        },
      },
    ];
    useCanvasStore.setState({ elements: [node, ...projectNodes] });

    render(<PlanningNode el={node} />);

    expect(screen.getByText('项目节点 3')).toBeInTheDocument();
    expect(screen.getByText('待确认执行 1')).toBeInTheDocument();
  });

  it('generates existing text nodes, connections, and a project group from a project seed', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: '生成规划结构' }));

    await waitFor(() => {
      expect(generateShortDramaPlanning).toHaveBeenCalledWith('一句短剧想法', 'text-model-1');
      expect(useCanvasStore.getState().elements).toHaveLength(3);
    });

    const state = useCanvasStore.getState();
    const generated = state.elements.slice(1);
    expect(generated).toHaveLength(2);
    expect(generated.every(element => element.type === 'text')).toBe(true);
    expect(generated.some(element => element.type === 'planning')).toBe(false);
    expect(state.connections).toHaveLength(2);
    expect(state.connections.every(connection =>
      connection.id &&
      connection.fromId === 'project-seed-1' &&
      connection.fromPortId &&
      connection.toPortId,
    )).toBe(true);

    const updatedConsole = state.elements.find(element => element.id === node.id);
    expect(updatedConsole).toMatchObject({
      type: 'planning',
      projectId: expect.any(String),
      generatedNodeIds: generated.map(element => element.id),
    });
    if (updatedConsole?.type !== 'planning') throw new Error('expected updated planning node');

    expect(state.groups).toEqual([
      {
        id: updatedConsole.projectId,
        label: node.title,
        childIds: [node.id, ...generated.map(element => element.id)],
      },
    ]);
    expect(state.currentLabel).toBe('更新企划控制台');
  });

  it('undoes and redoes project seed materialization as one history entry', async () => {
    const node = makePlanningNode({
      id: 'project-seed-1',
      kind: 'projectSeed',
      title: '短剧项目种子',
      body: '一句短剧想法',
      requirements: [],
      outputs: [{ id: 'seed-output-1', type: 'text', label: 'Plan' }],
    });
    useCanvasStore.setState({ elements: [node], connections: [], groups: [] });

    render(<PlanningNode el={node} />);
    fireEvent.click(screen.getByRole('button', { name: '生成规划结构' }));

    await waitFor(() => {
      expect(useCanvasStore.getState().elements).toHaveLength(3);
    });

    const generatedState = useCanvasStore.getState();
    const generatedIds = generatedState.elements
      .filter(element => element.id !== node.id)
      .map(element => element.id);
    const projectId = generatedState.groups[0]?.id;
    expect(generatedIds).toHaveLength(2);
    expect(generatedState.connections).toHaveLength(2);
    expect(generatedState.groups).toHaveLength(1);

    useCanvasStore.getState().undo();

    const undoneState = useCanvasStore.getState();
    expect(undoneState.elements).toEqual([node]);
    expect(undoneState.connections).toEqual([]);
    expect(undoneState.groups).toEqual([]);
    expect(undoneState.elements[0]).not.toHaveProperty('projectId');
    expect(undoneState.elements[0]).not.toHaveProperty('generatedNodeIds');

    useCanvasStore.getState().redo();

    const redoneState = useCanvasStore.getState();
    expect(redoneState.elements.map(element => element.id)).toEqual([node.id, ...generatedIds]);
    expect(redoneState.connections).toHaveLength(2);
    expect(redoneState.groups).toEqual([
      {
        id: projectId,
        label: node.title,
        childIds: [node.id, ...generatedIds],
      },
    ]);
    expect(redoneState.elements[0]).toMatchObject({
      type: 'planning',
      projectId,
      generatedNodeIds: generatedIds,
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
    fireEvent.click(screen.getByRole('button', { name: '生成规划结构' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('没有可用的文本模型');
    expect(generateShortDramaPlanning).not.toHaveBeenCalled();
  });
});
