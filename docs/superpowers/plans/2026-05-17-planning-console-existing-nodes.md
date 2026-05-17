# Planning Console Existing Nodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the short-drama planning flow so `planning` acts as a lightweight console while story, reference, and execution work use existing node types.

**Architecture:** Keep `planning` as the project control node and compatibility shell. Add draft metadata to executable nodes, materialize AI planning output into `text` nodes plus groups/connections, and create direct `image/text/video/audio` draft execution nodes from confirmed requirements. Execution remains in the existing engine with a small generic guard for `planningDraft.status === 'pendingReview'`.

**Tech Stack:** Vite 6, React 19, TypeScript 5.8, Zustand canvas store, react-konva DOM overlay nodes, Vitest + Testing Library.

---

## File Structure

- Modify `src/types/canvas.ts`: add `PlanningDraft` metadata to executable element types and add `projectId`/`generatedNodeIds` metadata to `PlanningElement`.
- Modify `src/store/types.ts`: add `createGroupFromIds` action to the store interface.
- Modify `src/store/slices/elementSlice.ts`: preserve draft metadata on normal element updates; no schema-specific logic here.
- Modify `src/store/slices/uiSlice.ts` or the existing group slice location if grouping lives elsewhere: expose a simple group creation helper if one does not already exist.
- Create `src/services/planningMaterializer.ts`: convert normalized planning responses into existing canvas nodes, project groups, and context connections.
- Create `src/services/planningMaterializer.test.ts`: cover story/plot/reference materialization, grouping metadata, duplicate prevention, and requirement-to-execution-node conversion.
- Modify `src/components/canvas/nodes/PlanningNode.tsx`: change project seed generation to materialize existing nodes; change confirmed requirement action to create draft execution nodes; keep legacy `productionTask` conversion.
- Modify `src/components/canvas/nodes/PlanningNode.test.tsx`: update expectations from planning child nodes to existing nodes; add direct task creation tests.
- Modify `src/components/NodeInputBar.tsx`: show draft review status and add `确认可执行`.
- Modify `src/components/NodeInputBar.test.tsx` if present; otherwise create `src/components/NodeInputBar.planningDraft.test.tsx`: cover the review affordance.
- Modify `src/services/executionEngine.ts`: block pending-review draft nodes before generation or billing work starts.
- Modify `src/services/executionEngine.test.ts` if present; otherwise create `src/services/executionEngine.planningDraft.test.ts`: cover guard behavior.
- Modify `src/utils/flowResolver.ts` only if materialized nodes need a small helper for planning labels; current upstream resolver should mostly remain unchanged.
- Keep `src/services/planningGraph.ts` for legacy compatibility during this plan. New code should use `planningMaterializer.ts`.

---

## Task 1: Draft Metadata Types

**Files:**
- Modify: `src/types/canvas.ts`
- Test: `src/store/slices/elementSlice.test.ts`

- [ ] **Step 1: Add failing type/store test for executable draft metadata**

Add this test to `src/store/slices/elementSlice.test.ts`:

```ts
it('preserves planning draft metadata on executable nodes', () => {
  const store = createTestStore();

  store.getState().addElement({
    id: 'img-draft',
    type: 'image',
    x: 0,
    y: 0,
    width: 560,
    height: 560,
    src: '',
    prompt: '生成红色怀表特写',
    planningDraft: {
      sourcePlanningId: 'planning-console-1',
      sourceRequirementId: 'req-watch',
      projectId: 'project-1',
      status: 'pendingReview',
    },
  });

  const node = store.getState().elements[0];
  expect(node.type).toBe('image');
  if (node.type !== 'image') throw new Error('expected image node');
  expect(node.planningDraft).toEqual({
    sourcePlanningId: 'planning-console-1',
    sourceRequirementId: 'req-watch',
    projectId: 'project-1',
    status: 'pendingReview',
  });
});
```

- [ ] **Step 2: Run the focused store test and verify failure**

Run:

```bash
npm run test -- src/store/slices/elementSlice.test.ts
```

Expected before implementation: TypeScript should fail or the test should fail because `planningDraft` is not defined on executable node types.

- [ ] **Step 3: Add draft metadata types**

In `src/types/canvas.ts`, add after `GenerationConfig`:

```ts
export interface PlanningDraft {
  sourcePlanningId: string;
  sourceRequirementId?: string;
  projectId?: string;
  status: 'pendingReview' | 'approved';
}
```

Add this optional field to `BaseElement` so every existing executable node can carry draft metadata without new node types:

```ts
planningDraft?: PlanningDraft;
```

Add optional project tracking fields to `PlanningElement`:

```ts
projectId?: string;
generatedNodeIds?: string[];
```

Do not remove the existing `PlanningNodeKind` values yet. Compatibility requires old `storyBible`, `plot`, `characterPackage`, `reference`, and `productionTask` nodes to remain readable.

- [ ] **Step 4: Run focused type and store tests**

Run:

```bash
npm run lint:tsc
npm run test -- src/store/slices/elementSlice.test.ts
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/canvas.ts src/store/slices/elementSlice.test.ts
git commit -m "feat: add planning draft metadata"
```

---

## Task 2: Materialize Planning Output Into Existing Nodes

**Files:**
- Create: `src/services/planningMaterializer.ts`
- Create: `src/services/planningMaterializer.test.ts`
- Keep: `src/services/planningGraph.ts` for legacy behavior

- [ ] **Step 1: Write failing materializer tests**

Create `src/services/planningMaterializer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { PlanningElement, PlanningRequirement } from '@/types/canvas';
import type { NormalizedPlanningResponse } from './planning';
import {
  materializePlanningResponse,
  createDraftExecutionNodeFromRequirement,
} from './planningMaterializer';

const consoleNode: PlanningElement = {
  id: 'planning-console-1',
  type: 'planning',
  kind: 'projectSeed',
  title: '短剧项目',
  body: '一句想法：女主发现红色怀表',
  x: 100,
  y: 100,
  width: 340,
  height: 260,
  outputs: [{ id: 'plan-out', type: 'text', label: 'Plan' }],
};

const response: NormalizedPlanningResponse = {
  storyBible: {
    title: '故事圣经',
    body: '世界观、主冲突、反转机制。',
  },
  characters: [
    {
      title: '女主',
      body: '目标：寻找真相。剧情职责：推动怀表线索。',
    },
  ],
  plots: [
    {
      title: '雨夜发现怀表',
      body: '女主在雨夜门口发现红色怀表。',
      requirements: [
        {
          id: 'req-watch',
          title: '红色怀表特写',
          materialType: 'prop',
          description: '红色旧怀表，带蓝宝石标记。',
          status: 'confirmed',
          necessity: '用于揭示关键线索。',
        },
      ],
    },
  ],
};

describe('planningMaterializer', () => {
  it('materializes planning output as existing text nodes', () => {
    const result = materializePlanningResponse(consoleNode, response);

    expect(result.nodes.every(node => node.type !== 'planning')).toBe(true);
    expect(result.nodes.map(node => node.type)).toEqual(['text', 'text', 'text']);
    expect(result.nodes[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('世界观'),
      planningDraft: undefined,
    });
    expect(result.projectGroup.childIds).toEqual([
      'planning-console-1',
      ...result.nodes.map(node => node.id),
    ]);
    expect(result.connections.length).toBeGreaterThan(0);
  });

  it('creates draft executable nodes directly from confirmed requirements', () => {
    const requirement = response.plots[0].requirements[0] as PlanningRequirement;

    const node = createDraftExecutionNodeFromRequirement({
      source: consoleNode,
      requirement,
      projectId: 'project-1',
      x: 520,
      y: 100,
    });

    expect(node.type).toBe('image');
    expect(node.prompt).toContain('红色怀表特写');
    expect(node.planningDraft).toEqual({
      sourcePlanningId: 'planning-console-1',
      sourceRequirementId: 'req-watch',
      projectId: 'project-1',
      status: 'pendingReview',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- src/services/planningMaterializer.test.ts
```

Expected: FAIL because `src/services/planningMaterializer.ts` does not exist.

- [ ] **Step 3: Implement materializer**

Create `src/services/planningMaterializer.ts`:

```ts
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
import type { GroupRecord } from '@/store/types';
import type { NormalizedPlanningResponse } from './planning';

const COLUMN_GAP = 80;
const STORY_X = 420;
const CHARACTER_X = 420;
const PLOT_X = 860;
const NODE_VERTICAL_GAP = 320;

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
  const storyBible = makeTextNode(source, response.storyBible.title, response.storyBible.body, STORY_X, 0, projectId);

  const characterNodes = response.characters.map((character, index) =>
    makeTextNode(
      source,
      character.title,
      character.body,
      CHARACTER_X,
      NODE_VERTICAL_GAP + index * 260,
      projectId,
    ),
  );

  const plotNodes = response.plots.map((plot, index) =>
    makeTextNode(
      source,
      plot.title,
      formatPlotBody(plot.body, plot.requirements),
      PLOT_X,
      index * NODE_VERTICAL_GAP,
      projectId,
    ),
  );

  const nodes = [storyBible, ...characterNodes, ...plotNodes];
  const connections = makeConsoleConnections(source, nodes);
  const projectGroup: GroupRecord = {
    id: projectId,
    label: source.title || '短剧企划',
    childIds: [source.id, ...nodes.map(node => node.id)],
  };

  return { projectId, nodes, connections, projectGroup };
}

export function createDraftExecutionNodeFromRequirement(input: {
  source: PlanningElement;
  requirement: PlanningRequirement;
  projectId?: string;
  x: number;
  y: number;
}): CanvasElement {
  const { source, requirement, projectId, x, y } = input;
  const prompt = [requirement.title, requirement.description, requirement.necessity]
    .filter(Boolean)
    .join('\n\n');
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
    planningDraft,
  } satisfies ImageElement;
}

export function makeMaterializerConnection(
  fromId: string,
  fromPortId: string,
  toId: string,
  toPortId: string,
): Connection {
  return { id: uuidv4(), fromId, fromPortId, toId, toPortId };
}

function makeTextNode(
  source: PlanningElement,
  title: string,
  body: string,
  offsetX: number,
  offsetY: number,
  projectId: string,
): TextElement {
  return {
    id: uuidv4(),
    type: 'text',
    x: source.x + offsetX,
    y: source.y + offsetY,
    width: 420,
    height: 280,
    text: `${title}\n\n${body}`,
    prompt: body,
    fontSize: 14,
    fontFamily: 'var(--font-serif)',
    fill: '#26211c',
    outputs: [{ id: uuidv4(), type: 'text', label: 'Text' }],
    planningDraft: {
      sourcePlanningId: source.id,
      projectId,
      status: 'approved',
    },
  };
}

function makeConsoleConnections(source: PlanningElement, nodes: CanvasElement[]): Connection[] {
  const sourceOutputId = source.outputs?.find(port => port.type === 'text' || port.type === 'any')?.id;
  if (!sourceOutputId) return [];

  return nodes.flatMap(node => {
    const inputId = node.inputs?.find(port => port.type === 'text' || port.type === 'any')?.id;
    return inputId ? [makeMaterializerConnection(source.id, sourceOutputId, node.id, inputId)] : [];
  });
}

function formatPlotBody(body: string, requirements: PlanningRequirement[]): string {
  const reqLines = requirements.map(req =>
    `素材需求｜${req.materialType}｜${req.status}：${req.title}${req.description ? `\n${req.description}` : ''}`,
  );
  return [body, ...reqLines].filter(Boolean).join('\n\n');
}
```

- [ ] **Step 4: Run materializer tests**

Run:

```bash
npm run test -- src/services/planningMaterializer.test.ts
npm run lint:tsc
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/planningMaterializer.ts src/services/planningMaterializer.test.ts
git commit -m "feat: materialize planning into existing nodes"
```

---

## Task 3: Store Group Creation Helper

**Files:**
- Modify: `src/store/types.ts`
- Modify: the store slice that currently implements grouping, likely `src/store/slices/uiSlice.ts`
- Test: create or update the closest store slice test

- [ ] **Step 1: Locate the current group actions**

Run:

```bash
rg -n "groupSelected|groups|GroupRecord" src/store src/components
```

Expected: identify the slice where `groupSelected` and `ungroupSelected` are implemented.

- [ ] **Step 2: Add failing test for creating a project group from explicit IDs**

In the closest store slice test, add:

```ts
it('creates a group from explicit element ids', () => {
  const store = createTestStore();
  store.getState().addElement({ id: 'plan', type: 'planning', kind: 'projectSeed', title: '项目', body: '', x: 0, y: 0, width: 340, height: 260 });
  store.getState().addElement({ id: 'story', type: 'text', text: '故事', x: 100, y: 0, width: 200, height: 100, fontSize: 14, fontFamily: 'var(--font-serif)', fill: '#26211c' });

  store.getState().createGroupFromIds('project-1', ['plan', 'story'], '短剧项目');

  expect(store.getState().groups).toEqual([
    { id: 'project-1', childIds: ['plan', 'story'], label: '短剧项目' },
  ]);
});
```

- [ ] **Step 3: Run test to verify failure**

Run:

```bash
npm run test -- src/store/slices/elementSlice.test.ts
```

Expected: FAIL because `createGroupFromIds` is missing.

- [ ] **Step 4: Add store action**

In `src/store/types.ts`, add to `CanvasState`:

```ts
createGroupFromIds: (id: string, childIds: string[], label?: string) => void;
```

In the grouping slice, implement:

```ts
createGroupFromIds: (id, childIds, label) => set((state) => {
  const uniqueIds = Array.from(new Set(childIds)).filter(childId =>
    state.elements.some(element => element.id === childId),
  );
  if (uniqueIds.length < 2) return state;

  const nextGroups = [
    ...state.groups.filter(group => group.id !== id),
    { id, childIds: uniqueIds, label },
  ];

  return {
    past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
    future: [],
    groups: nextGroups,
    currentLabel: label ? `创建分组 ${label}` : '创建分组',
    currentTimestamp: Date.now(),
  };
});
```

Import `snapshot` and `MAX_HISTORY` from `src/store/helpers.ts` if the slice does not already have them.

- [ ] **Step 5: Run tests**

Run:

```bash
npm run lint:tsc
npm run test -- src/store/slices/elementSlice.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store/types.ts src/store/slices src/store/slices/elementSlice.test.ts
git commit -m "feat: create project groups from planning output"
```

---

## Task 4: Generate Existing Nodes From Planning Console

**Files:**
- Modify: `src/components/canvas/nodes/PlanningNode.tsx`
- Modify: `src/components/canvas/nodes/PlanningNode.test.tsx`
- Use: `src/services/planningMaterializer.ts`

- [ ] **Step 1: Update UI test to expect existing nodes**

In `src/components/canvas/nodes/PlanningNode.test.tsx`, replace the old project-seed generation assertion with:

```ts
it('generates existing nodes and a project group from a project seed', async () => {
  const node = makePlanningNode({
    kind: 'projectSeed',
    title: '项目种子',
    body: '一句短剧想法',
    outputs: [{ id: 'seed-output-1', type: 'text', label: 'Plan' }],
  });
  useCanvasStore.setState({ elements: [node], connections: [], groups: [] });

  render(<PlanningNode el={node} />);
  fireEvent.click(screen.getByRole('button', { name: '生成规划结构' }));

  await waitFor(() => {
    expect(generateShortDramaPlanning).toHaveBeenCalledWith('一句短剧想法', 'text-model-1');
  });

  const state = useCanvasStore.getState();
  const generated = state.elements.filter(element => element.id !== node.id);
  expect(generated).toHaveLength(2);
  expect(generated.every(element => element.type === 'text')).toBe(true);
  expect(state.groups.some(group =>
    group.childIds.includes(node.id) &&
    generated.every(element => group.childIds.includes(element.id)),
  )).toBe(true);
});
```

Adjust the mocked `generateShortDramaPlanning` response in the test setup so it returns one story bible and one plot with no characters for this focused test.

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- src/components/canvas/nodes/PlanningNode.test.tsx
```

Expected: FAIL because current code still uses `buildPlanningNodesFromResponse` and creates planning subnodes.

- [ ] **Step 3: Replace generation action**

In `src/components/canvas/nodes/PlanningNode.tsx`, replace imports:

```ts
import { materializePlanningResponse } from '@/services/planningMaterializer';
```

Keep legacy imports from `planningGraph` only for old production task conversion and conflict detection:

```ts
import {
  convertTaskToExecutionNode,
  detectPropVisualConflict,
  makePlanningConnection,
} from '@/services/planningGraph';
```

In `handleGenerateStoryBible`, replace the node creation block with:

```ts
const project = materializePlanningResponse(el, response);
const store = useCanvasStore.getState();

project.nodes.forEach(node => store.addElement(node));

project.connections
  .filter(connection => connection.id && connection.fromPortId && connection.toPortId)
  .forEach(connection => store.addConnection(connection));

store.createGroupFromIds(project.projectGroup.id, project.projectGroup.childIds, project.projectGroup.label);
store.updateElement(el.id, {
  projectId: project.projectId,
  generatedNodeIds: project.nodes.map(node => node.id),
} as Partial<PlanningElement>, '更新企划控制台');
```

Change the button label from `生成故事圣经` to:

```tsx
生成规划结构
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run lint:tsc
npm run test -- src/components/canvas/nodes/PlanningNode.test.tsx src/services/planningMaterializer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/nodes/PlanningNode.tsx src/components/canvas/nodes/PlanningNode.test.tsx
git commit -m "feat: generate existing nodes from planning console"
```

---

## Task 5: Create Direct Draft Execution Nodes From Requirements

**Files:**
- Modify: `src/components/canvas/nodes/PlanningNode.tsx`
- Modify: `src/components/canvas/nodes/PlanningNode.test.tsx`
- Use: `src/services/planningMaterializer.ts`

- [ ] **Step 1: Add failing UI test for direct execution node creation**

Add to `src/components/canvas/nodes/PlanningNode.test.tsx`:

```ts
it('creates a draft image node directly from a confirmed requirement', () => {
  const node = makePlanningNode({
    id: 'plot-1',
    kind: 'plot',
    projectId: 'project-1',
    outputs: [{ id: 'plot-output-1', type: 'text', label: 'Plan' }],
    requirements: [
      {
        id: 'req-watch',
        title: '红色怀表特写',
        materialType: 'prop',
        description: '红色旧怀表，带蓝宝石标记。',
        status: 'confirmed',
      },
    ],
  });
  useCanvasStore.setState({ elements: [node], connections: [], groups: [] });

  render(<PlanningNode el={node} />);
  fireEvent.click(screen.getByRole('button', { name: '创建执行节点' }));

  const state = useCanvasStore.getState();
  const draft = state.elements.find(element => element.id !== node.id);
  expect(draft?.type).toBe('image');
  expect(draft?.planningDraft).toEqual({
    sourcePlanningId: 'plot-1',
    sourceRequirementId: 'req-watch',
    projectId: 'project-1',
    status: 'pendingReview',
  });
  expect(state.connections).toHaveLength(1);
  expect(state.selectedIds).toEqual([draft?.id]);
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- src/components/canvas/nodes/PlanningNode.test.tsx
```

Expected: FAIL because current code creates `planning productionTask` nodes.

- [ ] **Step 3: Change requirement action implementation**

In `PlanningNode.tsx`, import:

```ts
import { createDraftExecutionNodeFromRequirement } from '@/services/planningMaterializer';
```

Replace `handleCreateTask` body with:

```ts
event.stopPropagation();
const store = useCanvasStore.getState();
const exists = store.elements.some(existing =>
  existing.planningDraft?.sourcePlanningId === el.id &&
  existing.planningDraft?.sourceRequirementId === requirement.id,
);
if (exists) return;

const draftNode = createDraftExecutionNodeFromRequirement({
  source: el,
  requirement,
  projectId: el.projectId,
  x: el.x + el.width + 80,
  y: el.y,
});
store.addElement(draftNode);
store.setSelection([draftNode.id]);

const insertedDraft = useCanvasStore.getState().elements.find(existing => existing.id === draftNode.id);
const sourceOutputId = el.outputs?.find(port => port.type === 'text' || port.type === 'any')?.id;
const targetInputId = insertedDraft?.inputs?.find(port => port.type === 'text' || port.type === 'any')?.id;

if (sourceOutputId && targetInputId) {
  useCanvasStore.getState().addConnection(
    makePlanningConnection(el.id, sourceOutputId, insertedDraft.id, targetInputId),
  );
}
```

Change the button label to:

```tsx
创建执行节点
```

- [ ] **Step 4: Preserve legacy productionTask conversion**

Do not remove `handleConvertTask`. It remains for existing `planning productionTask` nodes.

Add this test if not already covered:

```ts
it('keeps legacy production task conversion available', () => {
  const node = makePlanningNode({
    id: 'legacy-task',
    kind: 'productionTask',
    recommendedTaskType: 'image',
    outputs: [{ id: 'legacy-output', type: 'text', label: 'Plan' }],
  });
  useCanvasStore.setState({ elements: [node], connections: [] });

  render(<PlanningNode el={node} />);
  fireEvent.click(screen.getByRole('button', { name: '转换为生成节点' }));

  expect(useCanvasStore.getState().elements.some(element => element.type === 'image')).toBe(true);
});
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run lint:tsc
npm run test -- src/components/canvas/nodes/PlanningNode.test.tsx src/services/planningMaterializer.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/canvas/nodes/PlanningNode.tsx src/components/canvas/nodes/PlanningNode.test.tsx
git commit -m "feat: create draft execution nodes from planning"
```

---

## Task 6: Draft Review UI On Executable Nodes

**Files:**
- Modify: `src/components/NodeInputBar.tsx`
- Create: `src/components/NodeInputBar.planningDraft.test.tsx`

- [ ] **Step 1: Write failing review UI test**

Create `src/components/NodeInputBar.planningDraft.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ImageElement } from '@/types/canvas';
import { useCanvasStore } from '@/store/useCanvasStore';
import { NodeInputBar } from './NodeInputBar';

vi.mock('@/services/imageGeneration', () => ({
  runGeneration: vi.fn(),
}));

function draftImage(overrides: Partial<ImageElement> = {}): ImageElement {
  return {
    id: 'draft-image-1',
    type: 'image',
    x: 0,
    y: 0,
    width: 560,
    height: 560,
    src: '',
    prompt: '红色怀表特写',
    planningDraft: {
      sourcePlanningId: 'plot-1',
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
      elements: [draftImage()],
      selectedIds: ['draft-image-1'],
    });
  });

  it('shows pending review state and approves the node', () => {
    render(<NodeInputBar element={draftImage()} x={0} y={0} width={560} scale={1} />);

    expect(screen.getByText('来自规划 · 待确认')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认可执行' }));

    const node = useCanvasStore.getState().elements[0];
    expect(node.planningDraft?.status).toBe('approved');
  });
});
```

If `NodeInputBar` requires additional mocks, follow the existing test patterns for gateway/model dropdown dependencies.

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- src/components/NodeInputBar.planningDraft.test.tsx
```

Expected: FAIL because the draft indicator and confirmation action do not exist.

- [ ] **Step 3: Add review affordance**

In `src/components/NodeInputBar.tsx`, derive:

```ts
const isPlanningDraftPending = element.planningDraft?.status === 'pendingReview';
```

Add confirmation helper near other update helpers:

```ts
const approvePlanningDraft = () => {
  if (!element.planningDraft) return;
  updateElement(element.id, {
    planningDraft: {
      ...element.planningDraft,
      status: 'approved',
    },
  }, '确认规划执行节点');
};
```

Render near the prompt controls:

```tsx
{element.planningDraft?.status === 'pendingReview' && (
  <div className="pointer-events-auto" style={{
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--ink-2)',
    fontSize: 11,
  }}>
    <span>来自规划 · 待确认</span>
    <button type="button" onClick={approvePlanningDraft} style={smallButtonStyle}>
      确认可执行
    </button>
  </div>
)}
```

If `smallButtonStyle` does not exist, define a local style object near other inline styles:

```ts
const smallButtonStyle: React.CSSProperties = {
  border: '1px solid var(--line-1)',
  borderRadius: 6,
  background: 'var(--bg-2)',
  color: 'var(--accent)',
  fontSize: 11,
  padding: '3px 7px',
};
```

- [ ] **Step 4: Ensure run button stays visually disabled while pending**

Where the submit button computes `disabled`, include:

```ts
isPlanningDraftPending
```

Where disabled style computes cursor/background, include this same condition.

- [ ] **Step 5: Run focused UI test**

Run:

```bash
npm run lint:tsc
npm run test -- src/components/NodeInputBar.planningDraft.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/NodeInputBar.tsx src/components/NodeInputBar.planningDraft.test.tsx
git commit -m "feat: review planning draft execution nodes"
```

---

## Task 7: Execution Guard For Pending Planning Drafts

**Files:**
- Modify: `src/services/executionEngine.ts`
- Create: `src/services/executionEngine.planningDraft.test.ts`

- [ ] **Step 1: Write failing execution guard test**

Create `src/services/executionEngine.planningDraft.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useExecutionStore } from '@/store/useExecutionStore';
import { executeNode } from './executionEngine';
import { runGeneration } from './imageGeneration';

vi.mock('./imageGeneration', () => ({
  runGeneration: vi.fn(),
}));

vi.mock('./videoGeneration', () => ({
  runVideoGeneration: vi.fn(),
}));

describe('executionEngine planning draft guard', () => {
  beforeEach(() => {
    vi.mocked(runGeneration).mockReset();
    useCanvasStore.setState({
      elements: [{
        id: 'draft-image-1',
        type: 'image',
        x: 0,
        y: 0,
        width: 560,
        height: 560,
        src: '',
        prompt: '红色怀表特写',
        planningDraft: {
          sourcePlanningId: 'plot-1',
          sourceRequirementId: 'req-watch',
          projectId: 'project-1',
          status: 'pendingReview',
        },
      }],
      connections: [],
    });
    useExecutionStore.getState().startRun('exec-1', ['draft-image-1']);
  });

  it('blocks pending planning draft nodes before generation starts', async () => {
    await executeNode('draft-image-1', 'exec-1');

    expect(runGeneration).not.toHaveBeenCalled();
    const state = useExecutionStore.getState().getRun('exec-1')?.nodeStates['draft-image-1'];
    expect(state?.status).toBe('failed');
    expect(state?.error).toBe('此节点来自规划，确认后才能执行');
  });
});
```

If `startRun` has a different signature, adapt only that setup call to match `src/store/useExecutionStore.ts`.

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- src/services/executionEngine.planningDraft.test.ts
```

Expected: FAIL because pending draft nodes are not blocked.

- [ ] **Step 3: Add execution guard**

In `src/services/executionEngine.ts`, immediately after the `!el` check and before `store.updateNodeStatus(nodeId, 'running')`, add:

```ts
if (el.planningDraft?.status === 'pendingReview') {
  store.updateNodeStatus(nodeId, 'failed', '此节点来自规划，确认后才能执行', 'unknown');
  return;
}
```

This guard must run before image/video/audio generation request construction.

- [ ] **Step 4: Add approved draft test**

In the same test file, add:

```ts
it('allows approved planning draft nodes to enter normal generation', async () => {
  useCanvasStore.setState({
    elements: [{
      id: 'draft-image-1',
      type: 'image',
      x: 0,
      y: 0,
      width: 560,
      height: 560,
      src: '',
      prompt: '红色怀表特写',
      planningDraft: {
        sourcePlanningId: 'plot-1',
        sourceRequirementId: 'req-watch',
        projectId: 'project-1',
        status: 'approved',
      },
    }],
    connections: [],
  });

  await executeNode('draft-image-1', 'exec-1');

  expect(runGeneration).toHaveBeenCalled();
});
```

- [ ] **Step 5: Run guard tests and relevant generation tests**

Run:

```bash
npm run lint:tsc
npm run test -- src/services/executionEngine.planningDraft.test.ts src/utils/flowResolver.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/executionEngine.ts src/services/executionEngine.planningDraft.test.ts
git commit -m "feat: block unreviewed planning draft execution"
```

---

## Task 8: Planning Console Status Summary

**Files:**
- Modify: `src/components/canvas/nodes/PlanningNode.tsx`
- Modify: `src/components/canvas/nodes/PlanningNode.test.tsx`

- [ ] **Step 1: Add failing summary test**

Add:

```ts
it('shows planning console summary for generated nodes', () => {
  const node = makePlanningNode({
    kind: 'projectSeed',
    projectId: 'project-1',
    generatedNodeIds: ['story-1', 'plot-1', 'draft-image-1'],
  });
  useCanvasStore.setState({
    elements: [
      node,
      { id: 'story-1', type: 'text', text: '故事圣经', x: 0, y: 0, width: 200, height: 120, fontSize: 14, fontFamily: 'var(--font-serif)', fill: '#26211c' },
      { id: 'plot-1', type: 'text', text: '剧情节点', x: 0, y: 0, width: 200, height: 120, fontSize: 14, fontFamily: 'var(--font-serif)', fill: '#26211c' },
      { id: 'draft-image-1', type: 'image', src: '', prompt: '图像任务', x: 0, y: 0, width: 560, height: 560, planningDraft: { sourcePlanningId: node.id, projectId: 'project-1', status: 'pendingReview' } },
    ],
    groups: [{ id: 'project-1', childIds: [node.id, 'story-1', 'plot-1', 'draft-image-1'], label: '短剧项目' }],
  });

  render(<PlanningNode el={node} />);

  expect(screen.getByText('项目节点 3')).toBeInTheDocument();
  expect(screen.getByText('待确认执行 1')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- src/components/canvas/nodes/PlanningNode.test.tsx
```

Expected: FAIL because the summary is not rendered.

- [ ] **Step 3: Add summary derivation**

In `PlanningNode`, derive:

```ts
const allElements = useCanvasStore((s) => s.elements);
const projectNodeIds = new Set(el.generatedNodeIds ?? []);
const projectNodes = allElements.filter(node => projectNodeIds.has(node.id));
const pendingDraftCount = projectNodes.filter(node => node.planningDraft?.status === 'pendingReview').length;
```

Render in the project seed footer:

```tsx
{el.kind === 'projectSeed' && projectNodes.length > 0 && (
  <div style={{ display: 'flex', gap: 8, color: 'var(--ink-2)', fontSize: 10.5 }}>
    <span>项目节点 {projectNodes.length}</span>
    <span>待确认执行 {pendingDraftCount}</span>
  </div>
)}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run lint:tsc
npm run test -- src/components/canvas/nodes/PlanningNode.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/nodes/PlanningNode.tsx src/components/canvas/nodes/PlanningNode.test.tsx
git commit -m "feat: show planning console project status"
```

---

## Task 9: Legacy Compatibility Labels

**Files:**
- Modify: `src/components/canvas/nodes/PlanningNode.tsx`
- Modify: `src/components/canvas/nodes/PlanningNode.test.tsx`

- [ ] **Step 1: Add failing legacy label test**

Add:

```ts
it('labels legacy production task planning nodes without removing conversion', () => {
  const node = makePlanningNode({
    kind: 'productionTask',
    recommendedTaskType: 'image',
  });
  render(<PlanningNode el={node} />);

  expect(screen.getByText('旧版任务卡')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '转换为生成节点' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- src/components/canvas/nodes/PlanningNode.test.tsx
```

Expected: FAIL because the legacy label is missing.

- [ ] **Step 3: Add legacy label**

In the header area for `el.kind === 'productionTask'`, render:

```tsx
{el.kind === 'productionTask' && (
  <span style={{ color: 'var(--ink-2)', fontSize: 10 }}>
    旧版任务卡
  </span>
)}
```

Do not remove the conversion button.

- [ ] **Step 4: Run test**

Run:

```bash
npm run lint:tsc
npm run test -- src/components/canvas/nodes/PlanningNode.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/nodes/PlanningNode.tsx src/components/canvas/nodes/PlanningNode.test.tsx
git commit -m "chore: label legacy planning task cards"
```

---

## Task 10: Full Verification And Browser Check

**Files:**
- Potentially modify: only files needed for verification fixes.

- [ ] **Step 1: Run TypeScript check**

Run:

```bash
npm run lint:tsc
```

Expected: PASS.

- [ ] **Step 2: Run focused planning tests**

Run:

```bash
npm run test -- src/services/planning.test.ts src/services/planningMaterializer.test.ts src/components/canvas/nodes/PlanningNode.test.tsx src/components/NodeInputBar.planningDraft.test.tsx src/services/executionEngine.planningDraft.test.ts src/utils/flowResolver.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 4: Run ESLint**

Run:

```bash
npm run lint:eslint
```

Expected: PASS.

- [ ] **Step 5: Browser verification**

Run dev server if it is not already running:

```bash
npm run dev
```

Open `http://127.0.0.1:3000/` and verify:

1. Add menu still shows `企划节点`.
2. Pressing `P` creates a selected planning console node titled `项目种子`.
3. The planning console button says `生成规划结构`.
4. Generating structure creates existing `text` nodes, not `planning storyBible` or `planning plot` nodes.
5. Confirmed requirements create direct `image/text/video/audio` nodes.
6. New execution nodes show `来自规划 · 待确认`.
7. Pending review execution nodes cannot run and show `此节点来自规划，确认后才能执行`.
8. Clicking `确认可执行` allows the existing run path.
9. Existing legacy `planning productionTask` nodes still show `转换为生成节点`.

- [ ] **Step 6: Commit verification fixes only if needed**

If verification required fixes:

```bash
git status --short
git add -- src/components/canvas/nodes/PlanningNode.tsx src/components/canvas/nodes/PlanningNode.test.tsx src/components/NodeInputBar.tsx src/components/NodeInputBar.planningDraft.test.tsx src/services/executionEngine.ts src/services/executionEngine.planningDraft.test.ts src/services/planningMaterializer.ts src/services/planningMaterializer.test.ts src/types/canvas.ts src/store/types.ts
git commit -m "fix: polish planning console existing-node flow"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Planning console role: Tasks 4 and 8.
- Existing node mapping: Tasks 2, 4, and 5.
- Group for project ownership: Tasks 2 and 3.
- Connections for execution context: Tasks 2, 4, and 5.
- Draft review metadata: Task 1.
- Direct task creation into executable nodes: Task 5.
- Execution guard before billing/provider calls: Task 7.
- Review UI: Task 6.
- Legacy compatibility: Task 9.
- Full validation: Task 10.

The plan intentionally keeps `src/services/planningGraph.ts` for legacy compatibility and adds `src/services/planningMaterializer.ts` for the new existing-node flow. This avoids a risky rename while still creating a clean new boundary.
