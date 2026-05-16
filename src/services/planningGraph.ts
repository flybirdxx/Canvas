import { v4 as uuidv4 } from 'uuid';

import type {
  CanvasElement,
  Connection,
  ImageElement,
  MediaElement,
  PlanningElement,
  PlanningRequirement,
  TextElement,
} from '@/types/canvas';
import type { NormalizedPlanningResponse } from './planning';

const PLANNING_GAP_X = 80;
const CHILD_COLUMN_X = 420;
const PLOT_COLUMN_X = 860;
const NODE_VERTICAL_GAP = 320;
const TASK_WIDTH = 360;
const TASK_HEIGHT = 260;

export function buildPlanningNodesFromResponse(
  source: PlanningElement,
  response: NormalizedPlanningResponse,
): { nodes: PlanningElement[]; connections: Connection[] } {
  const storyBible = makePlanningNode(
    source,
    'storyBible',
    response.storyBible.title,
    response.storyBible.body,
    CHILD_COLUMN_X,
    0,
  );

  const characterNodes = response.characters.map((character, index) =>
    makePlanningNode(
      source,
      'characterPackage',
      character.title,
      character.body,
      CHILD_COLUMN_X,
      NODE_VERTICAL_GAP + index * 300,
    ),
  );

  const plotNodes = response.plots.map((plot, index): PlanningElement => ({
    ...makePlanningNode(
      source,
      'plot',
      plot.title,
      plot.body,
      PLOT_COLUMN_X,
      index * NODE_VERTICAL_GAP,
    ),
    requirements: plot.requirements,
  }));

  const nodes = [storyBible, ...characterNodes, ...plotNodes];
  const sourceOutputId = source.outputs?.[0]?.id;
  const connections = sourceOutputId
    ? nodes.flatMap(node => {
      const targetInputId = node.inputs?.[0]?.id;
      return targetInputId
        ? [makePlanningConnection(source.id, sourceOutputId, node.id, targetInputId)]
        : [];
    })
    : [];

  return { nodes, connections };
}

export function confirmRequirement(node: PlanningElement, requirementId: string): PlanningElement {
  return updateRequirementStatus(node, requirementId, 'confirmed');
}

export function dismissRequirement(node: PlanningElement, requirementId: string): PlanningElement {
  return updateRequirementStatus(node, requirementId, 'dismissed');
}

export function createTaskFromRequirement(
  source: PlanningElement,
  requirement: PlanningRequirement,
): PlanningElement {
  return {
    id: uuidv4(),
    type: 'planning',
    kind: 'productionTask',
    title: requirement.title,
    body: requirement.description || requirement.title,
    x: source.x + source.width + PLANNING_GAP_X,
    y: source.y,
    width: TASK_WIDTH,
    height: TASK_HEIGHT,
    recommendedTaskType: recommendedTaskTypeFor(requirement.materialType),
    acceptanceCriteria: requirement.necessity
      ? `必须满足：${requirement.necessity}`
      : '必须服务当前剧情节点的生产需求。',
    sourcePlanningId: source.id,
  };
}

export function detectPropVisualConflict(
  taskDescription: string,
  propDefinition: string,
): { conflict: boolean; reason?: string } {
  const taskColors = collectMatches(taskDescription, COLOR_WORDS);
  const propColors = collectMatches(propDefinition, COLOR_WORDS);
  const taskMarks = collectMatches(taskDescription, MARK_WORDS);
  const propMarks = collectMatches(propDefinition, MARK_WORDS);

  if (hasDifferentMatches(taskColors, propColors) || hasDifferentMatches(taskMarks, propMarks)) {
    return {
      conflict: true,
      reason: '任务描述和道具视觉定义存在颜色或标识冲突。',
    };
  }

  return { conflict: false };
}

export function convertTaskToExecutionNode(task: PlanningElement): CanvasElement {
  const prompt = [task.title, task.body, task.acceptanceCriteria].filter(Boolean).join('\n\n');
  const base = {
    id: uuidv4(),
    x: task.x + task.width + PLANNING_GAP_X,
    y: task.y,
    prompt,
  };

  if (task.recommendedTaskType === 'text') {
    return {
      ...base,
      type: 'text',
      width: 420,
      height: 280,
      text: prompt,
      fontSize: 14,
      fontFamily: 'var(--font-serif)',
      fill: '#26211c',
    } satisfies TextElement;
  }

  if (task.recommendedTaskType === 'video' || task.recommendedTaskType === 'audio') {
    return {
      ...base,
      type: task.recommendedTaskType,
      width: task.recommendedTaskType === 'video' ? 640 : 360,
      height: task.recommendedTaskType === 'video' ? 360 : 96,
      src: '',
    } satisfies MediaElement;
  }

  return {
    ...base,
    type: 'image',
    width: 560,
    height: 560,
    src: '',
  } satisfies ImageElement;
}

export function makePlanningConnection(
  fromId: string,
  fromPortId: string,
  toId: string,
  toPortId: string,
): Connection {
  return {
    id: uuidv4(),
    fromId,
    fromPortId,
    toId,
    toPortId,
  };
}

function makePlanningNode(
  source: PlanningElement,
  kind: PlanningElement['kind'],
  title: string,
  body: string,
  offsetX: number,
  offsetY: number,
): PlanningElement {
  return {
    id: uuidv4(),
    type: 'planning',
    kind,
    title,
    body,
    x: source.x + offsetX,
    y: source.y + offsetY,
    width: kind === 'storyBible' ? 420 : 360,
    height: kind === 'plot' ? 300 : 260,
    inputs: [{ id: uuidv4(), type: 'any', label: 'Context' }],
    outputs: [{ id: uuidv4(), type: 'text', label: 'Plan' }],
    sourcePlanningId: source.id,
  };
}

function updateRequirementStatus(
  node: PlanningElement,
  requirementId: string,
  status: PlanningRequirement['status'],
): PlanningElement {
  return {
    ...node,
    requirements: (node.requirements ?? []).map(requirement =>
      requirement.id === requirementId ? { ...requirement, status } : requirement,
    ),
  };
}

function recommendedTaskTypeFor(
  materialType: PlanningRequirement['materialType'],
): PlanningElement['recommendedTaskType'] {
  if (materialType === 'text' || materialType === 'video' || materialType === 'audio') {
    return materialType;
  }

  return 'image';
}

function collectMatches(text: string, words: readonly string[]): string[] {
  return words.filter(word => text.includes(word));
}

function hasDifferentMatches(left: string[], right: string[]): boolean {
  return left.length > 0 && right.length > 0 && left.some(word => !right.includes(word));
}

const COLOR_WORDS = [
  '红色',
  '红',
  '银色',
  '银',
  '蓝色',
  '蓝',
  '黑色',
  '黑',
  '白色',
  '白',
  '金色',
  '金',
  '绿色',
  '绿',
  '紫色',
  '紫',
] as const;

const MARK_WORDS = [
  '蓝宝石',
  '红宝石',
  '绿宝石',
  '徽章',
  '纹章',
  '刻印',
  '标识',
  '标记',
  '符号',
] as const;
