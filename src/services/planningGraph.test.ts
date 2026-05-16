import { describe, expect, it } from 'vitest';

import type { PlanningElement, PlanningRequirement } from '@/types/canvas';
import {
  buildPlanningNodesFromResponse,
  confirmRequirement,
  dismissRequirement,
  createTaskFromRequirement,
  detectPropVisualConflict,
  convertTaskToExecutionNode,
  makePlanningConnection,
} from './planningGraph';

const seed: PlanningElement = {
  id: 'seed',
  type: 'planning',
  kind: 'projectSeed',
  title: '项目种子',
  body: '一句想法：女主在雪夜发现父亲失踪真相',
  x: 100,
  y: 100,
  width: 340,
  height: 260,
};

const seedWithOutput: PlanningElement = {
  ...seed,
  outputs: [{ id: 'seed-out', type: 'text', label: 'Plan' }],
};

describe('planningGraph', () => {
  it('builds bible, character, and plot nodes from normalized planning output', () => {
    const result = buildPlanningNodesFromResponse(seedWithOutput, {
      storyBible: { id: 'bible-source', title: '故事圣经', body: '主线' },
      characters: [{ id: 'character-source', title: '林晚', body: '律师', plotResponsibility: '揭示线索' }],
      plots: [{
        id: 'plot-source',
        title: '怀表出现',
        body: '关键转折',
        requirements: [{ id: 'req1', title: '怀表', materialType: 'prop', status: 'pending' }],
      }],
    });

    expect(result.nodes.map(node => node.kind)).toEqual(['storyBible', 'characterPackage', 'plot']);
    expect(result.nodes.map(node => node.sourcePlanningId)).toEqual(['seed', 'seed', 'seed']);
    expect(result.nodes[0].x).toBeGreaterThan(seed.x);
    expect(result.nodes[0].y).toBe(seed.y);
    expect(result.nodes[2].requirements).toEqual([
      { id: 'req1', title: '怀表', materialType: 'prop', status: 'pending' },
    ]);
    expect(result.connections).toHaveLength(3);
    expect(result.connections.every(connection => connection.fromId === 'seed')).toBe(true);
    expect(result.connections.map(connection => connection.toId)).toEqual(result.nodes.map(node => node.id));
  });

  it('uses real planning port ids for generated connections', () => {
    const result = buildPlanningNodesFromResponse(seedWithOutput, {
      storyBible: { id: 'bible-source', title: '故事圣经', body: '主线' },
      characters: [],
      plots: [],
    });

    const [node] = result.nodes;
    const [connection] = result.connections;

    expect(node.inputs?.[0]).toMatchObject({ type: 'any', label: 'Context' });
    expect(node.outputs?.[0]).toMatchObject({ type: 'text', label: 'Plan' });
    expect(connection.fromPortId).toBe('seed-out');
    expect(connection.toPortId).toBe(node.inputs?.[0].id);
    expect(connection.fromPortId).not.toBe('');
    expect(connection.toPortId).not.toBe('');
  });

  it('does not create generated connections when the source has no output port', () => {
    const result = buildPlanningNodesFromResponse(seed, {
      storyBible: { id: 'bible-source', title: '故事圣经', body: '主线' },
      characters: [],
      plots: [],
    });

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].inputs?.[0].id).toEqual(expect.any(String));
    expect(result.connections).toEqual([]);
  });

  it('confirms and dismisses material requirements immutably', () => {
    const requirement: PlanningRequirement = {
      id: 'req1',
      title: '怀表',
      materialType: 'prop',
      status: 'pending',
    };
    const plot: PlanningElement = {
      ...seed,
      id: 'plot',
      kind: 'plot',
      requirements: [requirement],
    };

    const confirmed = confirmRequirement(plot, 'req1');
    const dismissed = dismissRequirement(plot, 'req1');

    expect(confirmed).not.toBe(plot);
    expect(confirmed.requirements).not.toBe(plot.requirements);
    expect(confirmed.requirements?.[0]).not.toBe(requirement);
    expect(confirmed.requirements?.[0].status).toBe('confirmed');
    expect(dismissed.requirements?.[0].status).toBe('dismissed');
    expect(plot.requirements?.[0].status).toBe('pending');
  });

  it('creates a production task from a confirmed requirement', () => {
    const task = createTaskFromRequirement(seed, {
      id: 'req1',
      title: '旧仓库场景图',
      materialType: 'scene',
      description: '雨夜旧仓库，门口有破损霓虹灯',
      status: 'confirmed',
      necessity: '没有场景图，后续画面不可控。',
    });

    expect(task.kind).toBe('productionTask');
    expect(task.title).toBe('旧仓库场景图');
    expect(task.body).toContain('雨夜旧仓库');
    expect(task.recommendedTaskType).toBe('image');
    expect(task.acceptanceCriteria).toContain('没有场景图，后续画面不可控。');
    expect(task.x).toBe(seed.x + seed.width + 80);
  });

  it.each([
    ['character', 'image'],
    ['scene', 'image'],
    ['prop', 'image'],
    ['image', 'image'],
    ['text', 'text'],
    ['video', 'video'],
    ['audio', 'audio'],
  ] as const)('maps %s requirements to %s production tasks', (materialType, taskType) => {
    const task = createTaskFromRequirement(seed, {
      id: `req-${materialType}`,
      title: materialType,
      materialType,
      status: 'confirmed',
    });

    expect(task.recommendedTaskType).toBe(taskType);
  });

  it('detects prop visual conflicts from task and prop text', () => {
    expect(detectPropVisualConflict('红色怀表特写', '银色怀表，蓝宝石标识')).toEqual({
      conflict: true,
      reason: '任务描述和道具视觉定义存在颜色或标识冲突。',
    });
  });

  it('copy-converts image tasks to image generation nodes', () => {
    const node = convertTaskToExecutionNode({
      ...seed,
      id: 'task',
      kind: 'productionTask',
      title: '雨夜旧仓库',
      body: '生成雨夜旧仓库剧情场景图',
      recommendedTaskType: 'image',
      acceptanceCriteria: '必须包含破损霓虹灯',
    });

    expect(node.type).toBe('image');
    expect(node.id).not.toBe('task');
    expect(node.x).toBe(seed.x + seed.width + 80);
    expect(node.prompt).toContain('雨夜旧仓库');
    expect(node.prompt).toContain('生成雨夜旧仓库剧情场景图');
    expect(node.prompt).toContain('必须包含破损霓虹灯');
  });

  it('copy-converts text, video, and audio tasks to matching execution nodes', () => {
    expect(convertTaskToExecutionNode({ ...seed, kind: 'productionTask', recommendedTaskType: 'text' }).type).toBe('text');
    expect(convertTaskToExecutionNode({ ...seed, kind: 'productionTask', recommendedTaskType: 'video' }).type).toBe('video');
    expect(convertTaskToExecutionNode({ ...seed, kind: 'productionTask', recommendedTaskType: 'audio' }).type).toBe('audio');
    expect(convertTaskToExecutionNode({ ...seed, kind: 'productionTask' }).type).toBe('image');
  });

  it('makes planning connections with explicit port ids', () => {
    const connection = makePlanningConnection('seed', 'seedOut', 'bible', 'bibleIn');

    expect(connection).toMatchObject({
      fromId: 'seed',
      fromPortId: 'seedOut',
      toId: 'bible',
      toPortId: 'bibleIn',
    });
    expect(connection.id).toEqual(expect.any(String));
  });
});
