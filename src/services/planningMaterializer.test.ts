import { describe, expect, it } from 'vitest';

import type { CanvasElement, PlanningElement, PlanningRequirement, TextElement } from '@/types/canvas';
import type { NormalizedPlanningResponse } from './planning';
import {
  createDraftExecutionNodeFromRequirement,
  materializePlanningResponse,
} from './planningMaterializer';

const source: PlanningElement = {
  id: 'console-1',
  type: 'planning',
  kind: 'projectSeed',
  title: '雪夜真相',
  body: '女主在雪夜发现父亲失踪真相',
  projectId: 'project-1',
  x: 100,
  y: 120,
  width: 360,
  height: 260,
  outputs: [{ id: 'console-out', type: 'text', label: 'Plan' }],
};

const response: NormalizedPlanningResponse = {
  storyBible: {
    id: 'bible-source',
    title: '故事圣经',
    body: '主线围绕雪夜失踪案展开。',
  },
  characters: [
    {
      id: 'character-source',
      title: '林晚',
      body: '年轻律师，负责寻找证据。',
      plotResponsibility: '揭示线索',
    },
  ],
  plots: [
    {
      id: 'plot-source',
      title: '怀表出现',
      body: '旧怀表在仓库中被发现。',
      requirements: [
        {
          id: 'req-watch',
          title: '旧怀表特写',
          materialType: 'prop',
          description: '银色怀表，表盖有裂纹。',
          status: 'pending',
          necessity: '证明父亲曾到过仓库。',
        },
      ],
    },
  ],
};

describe('planningMaterializer', () => {
  it('materializes planning output into existing text nodes without planning child nodes', () => {
    const result = materializePlanningResponse(source, response);

    expect(result.projectId).toBe('project-1');
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes.every(node => node.type === 'text')).toBe(true);
    expect(result.nodes.some(node => node.type === 'planning')).toBe(false);
    const nodes = result.nodes.filter(isTextElement);
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('故事圣经'),
    });
    expect(nodes[0]).not.toHaveProperty('planningDraft');
    expect(nodes[1].text).toContain('林晚');
    expect(nodes[2].text).toContain('怀表出现');
    expect(nodes[2].text).toContain('旧怀表特写');
    expect(nodes[2].text).toContain('证明父亲曾到过仓库');
  });

  it('creates a project group containing the console and every materialized node', () => {
    const result = materializePlanningResponse(source, response);

    expect(result.projectGroup).toEqual({
      id: 'project-1',
      label: '雪夜真相',
      childIds: ['console-1', ...result.nodes.map(node => node.id)],
    });
  });

  it('materializes confirmed plot requirements as pendingReview draft execution nodes', () => {
    const result = materializePlanningResponse(source, {
      ...response,
      plots: [
        {
          ...response.plots[0],
          requirements: [
            {
              id: 'req-confirmed-image',
              title: 'confirmed image draft',
              materialType: 'image',
              description: 'visible clue',
              status: 'confirmed',
            },
            {
              id: 'req-pending-image',
              title: 'pending image draft',
              materialType: 'image',
              description: 'should not become a draft',
              status: 'pending',
            },
          ],
        },
      ],
    });

    const draftNodes = result.nodes.filter(node => node.planningDraft);

    expect(draftNodes).toHaveLength(1);
    expect(draftNodes[0]).toMatchObject({
      type: 'image',
      planningDraft: {
        sourcePlanningId: 'console-1',
        sourceRequirementId: 'req-confirmed-image',
        projectId: 'project-1',
        status: 'pendingReview',
      },
    });
    expect(draftNodes[0].x).toBeGreaterThan(source.x + 860);
    expect(result.projectGroup.childIds).toEqual(['console-1', ...result.nodes.map(node => node.id)]);
  });

  it('creates usable connections with explicit materialized text input ports', () => {
    const result = materializePlanningResponse(source, response);

    expect(result.connections.length).toBeGreaterThan(0);
    expect(uniqueConnectionTargetCount(result.connections)).toBe(result.connections.length);
    for (const connection of result.connections) {
      const target = result.nodes.find(node => node.id === connection.toId);
      const sourceNode = result.nodes.find(node => node.id === connection.fromId);
      const targetInput = target?.inputs?.find(port => port.id === connection.toPortId);
      const sourceOutput = connection.fromId === source.id
        ? source.outputs?.find(port => port.id === connection.fromPortId)
        : sourceNode?.outputs?.find(port => port.id === connection.fromPortId);

      expect(targetInput).toBeDefined();
      expect(sourceOutput).toBeDefined();
      expect(connection.fromPortId).not.toBe('');
      expect(connection.toPortId).not.toBe('');
    }
  });

  it('still creates generated-node context connections when the source has no output port', () => {
    const result = materializePlanningResponse({ ...source, outputs: undefined }, response);

    expect(result.connections.length).toBeGreaterThan(0);
    expect(result.connections.every(connection => connection.fromId !== source.id)).toBe(true);
    for (const connection of result.connections) {
      const fromNode = result.nodes.find(node => node.id === connection.fromId);
      const toNode = result.nodes.find(node => node.id === connection.toId);

      expect(fromNode?.outputs?.some(port => port.id === connection.fromPortId)).toBe(true);
      expect(toNode?.inputs?.some(port => port.id === connection.toPortId)).toBe(true);
    }
  });

  it('generates a project id and default Chinese group label when the source has neither', () => {
    const result = materializePlanningResponse(
      { ...source, projectId: undefined, title: '' },
      {
        storyBible: response.storyBible,
        characters: [],
        plots: [],
      },
    );

    expect(result.projectId).toEqual(expect.any(String));
    expect(result.projectId).not.toBe('');
    expect(result.projectGroup).toMatchObject({
      id: result.projectId,
      label: '企划项目',
      childIds: ['console-1', ...result.nodes.map(node => node.id)],
    });
  });

  it('creates a pendingReview draft image node from a visual requirement', () => {
    const requirement: PlanningRequirement = {
      id: 'req-scene',
      title: '雨夜仓库场景图',
      materialType: 'scene',
      description: '破旧仓库，门口有霓虹灯倒影。',
      status: 'pending',
      necessity: '作为后续视频镜头的视觉基准。',
    };

    const node = createDraftExecutionNodeFromRequirement({
      source,
      requirement,
      projectId: 'project-1',
      x: 640,
      y: 220,
    });

    expect(node).toMatchObject({
      type: 'image',
      x: 640,
      y: 220,
      prompt: expect.stringContaining('雨夜仓库场景图'),
      planningDraft: {
        sourcePlanningId: 'console-1',
        sourceRequirementId: 'req-scene',
        projectId: 'project-1',
        status: 'pendingReview',
      },
    });
    expect(node.prompt).toContain('破旧仓库');
    expect(node.prompt).toContain('作为后续视频镜头的视觉基准');
  });
  it('uses the source project id for draft nodes when no explicit project id is provided', () => {
    const node = createDraftExecutionNodeFromRequirement({
      source,
      requirement: {
        id: 'req-character',
        title: '角色定妆照',
        materialType: 'character',
        status: 'pending',
      },
      x: 640,
      y: 220,
    });

    expect(node.planningDraft?.projectId).toBe('project-1');
  });

  it('creates a pendingReview draft text node from a text requirement', () => {
    const node = createDraftExecutionNodeFromRequirement({
      source,
      requirement: {
        id: 'req-text',
        title: '旁白文案',
        materialType: 'text',
        description: '总结雪夜线索。',
        status: 'pending',
      },
      x: 700,
      y: 260,
    });

    expect(node).toMatchObject({
      type: 'text',
      planningDraft: {
        sourcePlanningId: 'console-1',
        sourceRequirementId: 'req-text',
        projectId: 'project-1',
        status: 'pendingReview',
      },
    });
    expect(isTextElement(node) ? node.text : '').toContain('旁白文案');
  });

  it.each([
    ['video', 'video'],
    ['audio', 'audio'],
  ] as const)('creates a pendingReview draft %s node from a media requirement', (materialType, expectedType) => {
    const node = createDraftExecutionNodeFromRequirement({
      source,
      requirement: {
        id: `req-${materialType}`,
        title: `${materialType} 素材`,
        materialType,
        status: 'pending',
      },
      x: 760,
      y: 300,
    });

    expect(node).toMatchObject({
      type: expectedType,
      planningDraft: {
        sourcePlanningId: 'console-1',
        sourceRequirementId: `req-${materialType}`,
        projectId: 'project-1',
        status: 'pendingReview',
      },
    });
  });
});

function isTextElement(node: CanvasElement): node is TextElement {
  return node.type === 'text';
}

function uniqueConnectionTargetCount(connections: { toId: string; toPortId: string }[]): number {
  return new Set(connections.map(connection => `${connection.toId}:${connection.toPortId}`)).size;
}
