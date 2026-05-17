import { v4 as uuidv4 } from 'uuid';

import { makePorts, PORT_DEFAULTS } from '@/store/portDefaults';
import type { GroupRecord } from '@/store/types';
import type {
  CanvasElement,
  Connection,
  ImageElement,
  MediaElement,
  PlanningElement,
  PlanningRequirement,
  TextElement,
} from '@/types/canvas';
import type {
  NormalizedPlanningCharacter,
  NormalizedPlanningPlot,
  NormalizedPlanningResponse,
  NormalizedPlanningSection,
} from './index';

const CHILD_COLUMN_X = 420;
const PLOT_COLUMN_X = 860;
const NODE_VERTICAL_GAP = 300;

export interface MaterializedPlanningProject {
  projectId: string;
  nodes: CanvasElement[];
  connections: Connection[];
  projectGroup: GroupRecord;
}

export function materializePlanningResponse(
  source: PlanningElement,
  response: NormalizedPlanningResponse,
): MaterializedPlanningProject {
  const projectId = source.projectId ?? uuidv4();
  const storyBible = createPlanningTextNode({
    source,
    title: response.storyBible.title,
    body: response.storyBible.body,
    x: source.x + CHILD_COLUMN_X,
    y: source.y,
  });

  const characterNodes = response.characters.map((character, index) =>
    createPlanningTextNode({
      source,
      title: character.title,
      body: formatCharacterBody(character),
      x: source.x + CHILD_COLUMN_X,
      y: source.y + NODE_VERTICAL_GAP + index * NODE_VERTICAL_GAP,
    }),
  );

  const plotEntries = response.plots.map((plot, index) => {
    const plotNode = createPlanningTextNode({
      source,
      title: plot.title,
      body: formatPlotBody(plot),
      x: source.x + PLOT_COLUMN_X,
      y: source.y + index * NODE_VERTICAL_GAP,
    });
    const draftNodes = plot.requirements
      .filter(requirement => requirement.status === 'confirmed')
      .map((requirement, requirementIndex) =>
        createDraftExecutionNodeFromRequirement({
          source,
          requirement,
          projectId,
          x: plotNode.x + plotNode.width + 80,
          y: plotNode.y + requirementIndex * 180,
        }),
      );
    return { plotNode, draftNodes };
  });
  const plotNodes = plotEntries.map(entry => entry.plotNode);
  const draftNodes = plotEntries.flatMap(entry => entry.draftNodes);

  const nodes = [storyBible, ...characterNodes, ...plotNodes, ...draftNodes];
  const connections = createMaterializerConnections(source, storyBible, nodes);

  return {
    projectId,
    nodes,
    connections,
    projectGroup: {
      id: projectId,
      label: source.title || '企划项目',
      childIds: [source.id, ...nodes.map(node => node.id)],
    },
  };
}

export function createDraftExecutionNodeFromRequirement(input: {
  source: PlanningElement;
  requirement: PlanningRequirement;
  projectId?: string;
  x: number;
  y: number;
}): CanvasElement {
  const { source, requirement, x, y } = input;
  const projectId = input.projectId ?? source.projectId;
  const prompt = formatRequirementPrompt(requirement);
  const planningDraft = {
    sourcePlanningId: source.id,
    sourceRequirementId: requirement.id,
    projectId,
    status: 'pendingReview' as const,
  };

  if (requirement.materialType === 'text') {
    return {
      id: uuidv4(),
      type: 'text',
      x,
      y,
      width: 420,
      height: 280,
      text: prompt,
      prompt,
      fontSize: 14,
      fontFamily: 'var(--font-serif)',
      fill: '#26211c',
      inputs: makePorts(PORT_DEFAULTS.text.inputs),
      outputs: makePorts(PORT_DEFAULTS.text.outputs),
      planningDraft,
    } satisfies TextElement;
  }

  if (requirement.materialType === 'video' || requirement.materialType === 'audio') {
    return {
      id: uuidv4(),
      type: requirement.materialType,
      x,
      y,
      width: requirement.materialType === 'video' ? 640 : 360,
      height: requirement.materialType === 'video' ? 360 : 96,
      src: '',
      prompt,
      inputs: makePorts(PORT_DEFAULTS[requirement.materialType].inputs),
      outputs: makePorts(PORT_DEFAULTS[requirement.materialType].outputs),
      planningDraft,
    } satisfies MediaElement;
  }

  return {
    id: uuidv4(),
    type: 'image',
    x,
    y,
    width: 560,
    height: 560,
    src: '',
    prompt,
    inputs: makePorts(PORT_DEFAULTS.image.inputs),
    outputs: makePorts(PORT_DEFAULTS.image.outputs),
    planningDraft,
  } satisfies ImageElement;
}

export function makeMaterializerConnection(
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

function createPlanningTextNode(input: {
  source: PlanningElement;
  title: string;
  body: string;
  x: number;
  y: number;
}): TextElement {
  const text = formatTitledBody(input.title, input.body);

  return {
    id: uuidv4(),
    type: 'text',
    x: input.x,
    y: input.y,
    width: 420,
    height: 280,
    text,
    prompt: text,
    fontSize: 15,
    fontFamily: 'var(--font-serif)',
    fill: '#26211c',
    inputs: [{ id: uuidv4(), type: 'any', label: 'Context' }],
    outputs: [{ id: uuidv4(), type: 'text', label: 'Text' }],
    note: `由企划控制台 ${input.source.title || input.source.id} 物化`,
  };
}

function createMaterializerConnections(
  source: PlanningElement,
  storyBible: TextElement,
  nodes: CanvasElement[],
): Connection[] {
  const connections: Connection[] = [];
  const sourceOutput = source.outputs?.find(port => port.type === 'text' || port.type === 'any');

  if (sourceOutput) {
    for (const node of nodes) {
      const input = node.inputs?.find(port => port.type === 'any' || port.type === sourceOutput.type);
      if (input) {
        connections.push(makeMaterializerConnection(source.id, sourceOutput.id, node.id, input.id));
      }
    }
    return connections;
  }

  const storyOutput = storyBible.outputs?.find(port => port.type === 'text');
  if (!storyOutput) return connections;

  for (const node of nodes) {
    if (node.id === storyBible.id) continue;
    const input = node.inputs?.find(port => port.type === 'any' || port.type === 'text');
    if (input) {
      connections.push(makeMaterializerConnection(storyBible.id, storyOutput.id, node.id, input.id));
    }
  }

  return connections;
}

function formatCharacterBody(character: NormalizedPlanningCharacter): string {
  return character.plotResponsibility
    ? `${character.body}\n\n剧情职责：${character.plotResponsibility}`
    : character.body;
}

function formatPlotBody(plot: NormalizedPlanningPlot): string {
  const requirements = plot.requirements.length
    ? [
      '',
      '素材需求摘要：',
      ...plot.requirements.map(requirement => `- ${formatRequirementSummary(requirement)}`),
    ].join('\n')
    : '';

  return `${plot.body}${requirements}`;
}

function formatRequirementSummary(requirement: PlanningRequirement): string {
  return [
    `[${requirement.materialType}] ${requirement.title}`,
    requirement.description,
    requirement.necessity ? `必要性：${requirement.necessity}` : undefined,
  ].filter(Boolean).join('；');
}

function formatRequirementPrompt(requirement: PlanningRequirement): string {
  return [
    requirement.title,
    requirement.description,
    requirement.necessity ? `必要性：${requirement.necessity}` : undefined,
  ].filter(Boolean).join('\n\n');
}

function formatTitledBody(title: NormalizedPlanningSection['title'], body: NormalizedPlanningSection['body']): string {
  return `${title}\n\n${body}`;
}
