# Canvas V1 Planning Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V1 canvas-first short-drama planning loop: project seed, story bible, character packages, plot nodes, material requirements, and confirmed production task nodes.

**Architecture:** Use one generic `planning` canvas element with typed `kind` values for V1 instead of adding six separate element types. Keep AI planning generation in `src/services/planning.ts`, graph/node creation helpers in `src/services/planningGraph.ts`, and UI behavior in `PlanningNode.tsx` plus the existing dock, shortcut, and properties panel entry points. Task conversion copies a planning task into a concrete generation node while preserving the task node as the traceable planning source.

**Tech Stack:** Vite 6, React 19, TypeScript 5.8, Zustand canvas store, react-konva DOM overlay nodes, Vitest + Testing Library.

---

## Current Workspace Notes

- Current branch should be `codex/canvas-v1-planning-loop`. Do not implement this plan on `main`.
- The worktree already contains an early `planning` element type and `PlanningNode.tsx`; treat those as in-progress code, not as final behavior.
- Several existing Chinese strings in current files are mojibake. Fixing those strings is in scope because Warm Paper Studio requires Chinese UI labels.
- Do not restore or modify unrelated dirty files outside the files listed in a task.

## File Structure

- Modify `src/types/canvas.ts`: finalize planning-specific types and keep `ElementType` as a single `planning` type.
- Modify `src/store/portDefaults.ts`: keep planning ports generic enough for references and task output.
- Modify `src/store/helpers.ts`: restore Chinese labels for undo/history.
- Modify `src/hooks/useGlobalShortcuts.ts`: create a project seed planning node with readable Chinese defaults.
- Modify `src/components/chrome/ToolDock.tsx`: expose `planning` as “企划节点”.
- Modify `src/components/properties/PropertiesPanel.tsx`: edit planning kind, title, body, requirements, task type, prop visibility, and acceptance criteria.
- Modify `src/components/canvas/nodes/PlanningNode.tsx`: render planning node content, pending requirements, confirmation controls, and task conversion controls.
- Create `src/services/planning.ts`: prompt construction, gateway call, JSON parsing, normalization, and deterministic fallback helpers.
- Create `src/services/planningGraph.ts`: create child planning nodes, confirm/dismiss requirements, convert requirements to task nodes, detect prop visual conflicts, and copy-convert task nodes to execution nodes.
- Test `src/services/planning.test.ts`.
- Test `src/services/planningGraph.test.ts`.
- Test `src/components/canvas/nodes/PlanningNode.test.tsx`.
- Update `src/components/chrome/ToolDock.test.tsx`.
- Create `src/hooks/useGlobalShortcuts.test.tsx`.
- Create `src/components/properties/PropertiesPanel.test.tsx`.
- If Vitest fails with `ReferenceError: __dirname is not defined`, modify `vitest.config.ts` to use `fileURLToPath(import.meta.url)`.

---

### Task 1: Planning Types And Chinese Labels

**Files:**
- Modify: `src/types/canvas.ts`
- Modify: `src/store/portDefaults.ts`
- Modify: `src/store/helpers.ts`
- Test: `src/store/slices/elementSlice.test.ts`

- [ ] **Step 1: Write type coverage expectations**

Add this test case to `src/store/slices/elementSlice.test.ts`:

```ts
it('adds default ports to planning nodes', () => {
  const store = createTestStore();

  store.getState().addElement({
    id: 'plan1',
    type: 'planning',
    kind: 'projectSeed',
    title: '项目种子',
    body: '一句想法',
    x: 0,
    y: 0,
    width: 340,
    height: 260,
  });

  const node = store.getState().elements.find(el => el.id === 'plan1');
  expect(node?.inputs?.map(port => port.label)).toEqual(['Context']);
  expect(node?.outputs?.map(port => port.label)).toEqual(['Plan']);
});
```

- [ ] **Step 2: Run the focused store test and verify current behavior**

Run: `npm run test -- src/store/slices/elementSlice.test.ts`

Expected before implementation: either PASS if the early planning type already works, or FAIL with a missing test helper/type mismatch. If it fails because `createTestStore` has a different local helper name, adapt only the test harness lines to match the file’s existing pattern.

- [ ] **Step 3: Finalize planning types**

In `src/types/canvas.ts`, keep the generic `planning` element type and ensure these definitions exist:

```ts
export type PlanningNodeKind =
  | 'projectSeed'
  | 'storyBible'
  | 'characterPackage'
  | 'plot'
  | 'reference'
  | 'productionTask';

export type PlanningRequirementStatus = 'pending' | 'confirmed' | 'dismissed';
export type PlanningMaterialType = 'character' | 'scene' | 'prop' | 'image' | 'text' | 'video' | 'audio';
export type PropVisibility = 'full' | 'partial' | 'obscured' | 'markOnly';

export interface PlanningRequirement {
  id: string;
  title: string;
  materialType: PlanningMaterialType;
  description?: string;
  status: PlanningRequirementStatus;
  sourcePlotId?: string;
  necessity?: string;
}

export interface PlanningPropState {
  propId?: string;
  visibility: PropVisibility;
  note?: string;
  userConfirmed?: boolean;
}

export interface PlanningElement extends BaseElement {
  type: 'planning';
  kind: PlanningNodeKind;
  title: string;
  body: string;
  template?: 'shortDrama';
  requirements?: PlanningRequirement[];
  propStates?: PlanningPropState[];
  recommendedTaskType?: Extract<PlanningMaterialType, 'image' | 'text' | 'video' | 'audio'>;
  acceptanceCriteria?: string;
  sourcePlanningId?: string;
}
```

- [ ] **Step 4: Keep planning port defaults**

In `src/store/portDefaults.ts`, keep:

```ts
planning: {
  inputs: [{ type: 'any', label: 'Context' }],
  outputs: [{ type: 'text', label: 'Plan' }],
},
```

- [ ] **Step 5: Restore Chinese undo labels**

In `src/store/helpers.ts`, replace mojibake labels with:

```ts
export const typeLabelMap: Record<string, string> = {
  rectangle: '矩形',
  circle: '圆形',
  text: '文本',
  image: '图片',
  sticky: '便签',
  video: '视频',
  audio: '音频',
  aigenerating: 'AI 生成',
  file: '文件',
  omniscript: 'OmniScript',
  planning: '企划',
};
```

- [ ] **Step 6: Run tests**

Run: `npm run test -- src/store/slices/elementSlice.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types/canvas.ts src/store/portDefaults.ts src/store/helpers.ts src/store/slices/elementSlice.test.ts
git commit -m "feat: stabilize planning node types"
```

---

### Task 2: Planning Creation Entry Points

**Files:**
- Modify: `src/hooks/useGlobalShortcuts.ts`
- Modify: `src/components/chrome/ToolDock.tsx`
- Modify: `src/components/chrome/ToolDock.test.tsx`
- Create: `src/hooks/useGlobalShortcuts.test.tsx`

- [ ] **Step 1: Update ToolDock test to expect Chinese planning entry**

In `src/components/chrome/ToolDock.test.tsx`, replace the planning test with:

```ts
it('creates a planning node from the add menu', () => {
  const onCreate = vi.fn();
  render(<ToolDock onCreate={onCreate} />);

  fireEvent.click(screen.getByTitle('Add'));
  fireEvent.click(screen.getByText('企划节点'));

  expect(onCreate).toHaveBeenCalledWith('planning');
});
```

- [ ] **Step 2: Add shortcut creation test**

Create `src/hooks/useGlobalShortcuts.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { useGlobalShortcuts } from './useGlobalShortcuts';
import { useCanvasStore } from '@/store/useCanvasStore';

describe('useGlobalShortcuts planning node', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      elements: [],
      selectedIds: [],
      activeTool: 'select',
      stageConfig: { x: 0, y: 0, scale: 1 },
    } as Partial<ReturnType<typeof useCanvasStore.getState>>);
  });

  it('creates a project seed planning node with P', () => {
    renderHook(() => useGlobalShortcuts());

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));

    const [node] = useCanvasStore.getState().elements;
    expect(node.type).toBe('planning');
    if (node.type !== 'planning') throw new Error('expected planning node');
    expect(node.kind).toBe('projectSeed');
    expect(node.title).toBe('项目种子');
    expect(node.body).toContain('一句想法：');
    expect(useCanvasStore.getState().selectedIds).toEqual([node.id]);
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run: `npm run test -- src/components/chrome/ToolDock.test.tsx src/hooks/useGlobalShortcuts.test.tsx`

Expected before implementation: FAIL because visible labels and default planning body still contain mojibake.

- [ ] **Step 4: Restore creation defaults**

In `src/hooks/useGlobalShortcuts.ts`, set:

```ts
const DEFAULT_PLANNING_BODY = [
  '一句想法：',
  '',
  '题材 / 基调：',
  '',
  '短剧方向：',
].join('\n');
```

In the created element, set:

```ts
title:
  type === 'omniscript' ? 'OmniScript' :
  type === 'planning' ? '项目种子' :
  undefined,
kind: type === 'planning' ? 'projectSeed' : undefined,
body: type === 'planning' ? DEFAULT_PLANNING_BODY : undefined,
template: type === 'planning' ? 'shortDrama' : undefined,
```

- [ ] **Step 5: Restore ToolDock planning label**

In `src/components/chrome/ToolDock.tsx`, make the planning menu entry:

```tsx
<Pick
  onClick={() => { onCreate('planning'); closeMenu(); }}
  icon={<Network size={15} strokeWidth={1.6} />}
  label="企划节点"
  desc="种子 / 圣经 / 任务"
  hotkey="P"
/>
```

- [ ] **Step 6: Run focused tests**

Run: `npm run test -- src/components/chrome/ToolDock.test.tsx src/hooks/useGlobalShortcuts.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useGlobalShortcuts.ts src/hooks/useGlobalShortcuts.test.tsx src/components/chrome/ToolDock.tsx src/components/chrome/ToolDock.test.tsx
git commit -m "feat: add planning node creation entry"
```

---

### Task 3: Planning AI Service

**Files:**
- Create: `src/services/planning.ts`
- Create: `src/services/planning.test.ts`

- [ ] **Step 1: Write parsing and normalization tests**

Create `src/services/planning.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { normalizePlanningResponse, buildShortDramaPlanningPrompt } from './planning';

describe('planning service', () => {
  it('normalizes story bible, characters, plots, and requirements', () => {
    const normalized = normalizePlanningResponse({
      storyBible: {
        title: '雪夜旧债',
        body: '一个旧债引爆家族短剧。',
      },
      characters: [
        {
          title: '林晚',
          body: '女主，追查父亲失踪。',
          plotResponsibility: '在旧仓库节点揭示怀表线索。',
        },
      ],
      plots: [
        {
          title: '旧仓库发现怀表',
          body: '林晚发现带血怀表。',
          requirements: [
            {
              title: '血色怀表特写',
              materialType: 'prop',
              description: '只露出怀表上的家族标识。',
              necessity: '没有它，后续线索反转无法执行。',
            },
          ],
        },
      ],
    });

    expect(normalized.storyBible.title).toBe('雪夜旧债');
    expect(normalized.characters[0].body).toContain('剧情职责');
    expect(normalized.plots[0].requirements[0]).toMatchObject({
      title: '血色怀表特写',
      materialType: 'prop',
      status: 'pending',
    });
  });

  it('builds a restrained short-drama planning prompt', () => {
    const prompt = buildShortDramaPlanningPrompt('一句想法：女主在雪夜发现父亲失踪真相');

    expect(prompt).toContain('短剧项目模板');
    expect(prompt).toContain('不要列出低价值素材');
    expect(prompt).toContain('只输出 JSON');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test -- src/services/planning.test.ts`

Expected: FAIL because `src/services/planning.ts` does not exist.

- [ ] **Step 3: Implement planning service types and prompt**

Create `src/services/planning.ts`:

```ts
import { v4 as uuidv4 } from 'uuid';
import { generateTextByModelId } from './gateway';
import type { PlanningMaterialType, PlanningRequirement } from '@/types/canvas';

export interface RawPlanningResponse {
  storyBible?: { title?: string; body?: string };
  characters?: Array<{ title?: string; body?: string; plotResponsibility?: string }>;
  plots?: Array<{
    title?: string;
    body?: string;
    requirements?: Array<{
      title?: string;
      materialType?: PlanningMaterialType;
      description?: string;
      necessity?: string;
    }>;
  }>;
}

export interface NormalizedPlanningResponse {
  storyBible: { title: string; body: string };
  characters: Array<{ title: string; body: string }>;
  plots: Array<{ title: string; body: string; requirements: PlanningRequirement[] }>;
}

const MATERIAL_TYPES = new Set<PlanningMaterialType>(['character', 'scene', 'prop', 'image', 'text', 'video', 'audio']);

export function buildShortDramaPlanningPrompt(seed: string): string {
  return [
    '你是短剧项目模板的企划拆解助手。',
    '请把用户的一句想法拆成故事圣经、角色生产包、关键剧情节点、必要素材需求。',
    '素材需求只包含角色、场景、道具，且必须符合生产必要性：没有它，后续 AI 生成任务无法执行或质量明显不可控。',
    '不要列出低价值素材，不要生成完整分镜，不要进入视频生成执行。',
    '只输出 JSON，结构为：',
    '{"storyBible":{"title":"","body":""},"characters":[{"title":"","body":"","plotResponsibility":""}],"plots":[{"title":"","body":"","requirements":[{"title":"","materialType":"character|scene|prop","description":"","necessity":""}]}]}',
    '用户想法：',
    seed,
  ].join('\n');
}

export function normalizePlanningResponse(raw: RawPlanningResponse): NormalizedPlanningResponse {
  const storyBible = {
    title: raw.storyBible?.title?.trim() || '故事圣经',
    body: raw.storyBible?.body?.trim() || '主线、人物与关键剧情节点待补充。',
  };

  const characters = (raw.characters ?? []).map((item, index) => ({
    title: item.title?.trim() || `角色 ${index + 1}`,
    body: [
      item.body?.trim() || '角色设定待补充。',
      item.plotResponsibility?.trim() ? `剧情职责：${item.plotResponsibility.trim()}` : '剧情职责：待补充。',
    ].join('\n\n'),
  }));

  const plots = (raw.plots ?? []).map((item, index) => ({
    title: item.title?.trim() || `剧情节点 ${index + 1}`,
    body: item.body?.trim() || '关键事件、转折或关系变化待补充。',
    requirements: (item.requirements ?? [])
      .filter(req => req.title?.trim())
      .map(req => ({
        id: uuidv4(),
        title: req.title!.trim(),
        materialType: MATERIAL_TYPES.has(req.materialType as PlanningMaterialType) ? req.materialType as PlanningMaterialType : 'prop',
        description: req.description?.trim(),
        necessity: req.necessity?.trim(),
        status: 'pending' as const,
      })),
  }));

  return { storyBible, characters, plots };
}

export function parsePlanningJson(text: string): RawPlanningResponse {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced?.[1] ?? text;
  return JSON.parse(jsonText) as RawPlanningResponse;
}

export async function generateShortDramaPlanning(seed: string, model: string): Promise<NormalizedPlanningResponse> {
  const result = await generateTextByModelId({
    model,
    messages: [{ role: 'user', content: buildShortDramaPlanningPrompt(seed) }],
  });

  if (!result.ok) {
    throw new Error(result.detail ? `${result.message}\n${result.detail}` : result.message);
  }

  return normalizePlanningResponse(parsePlanningJson(result.text));
}
```

- [ ] **Step 4: Run service tests**

Run: `npm run test -- src/services/planning.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/planning.ts src/services/planning.test.ts
git commit -m "feat: add short drama planning service"
```

---

### Task 4: Planning Graph Helpers

**Files:**
- Create: `src/services/planningGraph.ts`
- Create: `src/services/planningGraph.test.ts`

- [ ] **Step 1: Write graph helper tests**

Create `src/services/planningGraph.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { PlanningElement } from '@/types/canvas';
import {
  buildPlanningNodesFromResponse,
  confirmRequirement,
  dismissRequirement,
  createTaskFromRequirement,
  detectPropVisualConflict,
  convertTaskToExecutionNode,
} from './planningGraph';

const seed: PlanningElement = {
  id: 'seed',
  type: 'planning',
  kind: 'projectSeed',
  title: '项目种子',
  body: '一句想法',
  x: 100,
  y: 100,
  width: 340,
  height: 260,
};

describe('planningGraph', () => {
  it('builds bible, character, and plot nodes from normalized planning output', () => {
    const result = buildPlanningNodesFromResponse(seed, {
      storyBible: { title: '故事圣经', body: '主线' },
      characters: [{ title: '林晚', body: '剧情职责：揭示线索' }],
      plots: [{ title: '怀表出现', body: '转折', requirements: [] }],
    });

    expect(result.nodes.map(node => node.kind)).toEqual(['storyBible', 'characterPackage', 'plot']);
    expect(result.connections).toHaveLength(3);
  });

  it('confirms and dismisses material requirements immutably', () => {
    const plot: PlanningElement = {
      ...seed,
      id: 'plot',
      kind: 'plot',
      requirements: [{ id: 'req1', title: '怀表', materialType: 'prop', status: 'pending' }],
    };

    expect(confirmRequirement(plot, 'req1').requirements?.[0].status).toBe('confirmed');
    expect(dismissRequirement(plot, 'req1').requirements?.[0].status).toBe('dismissed');
  });

  it('creates a production task from a confirmed requirement', () => {
    const task = createTaskFromRequirement(seed, {
      id: 'req1',
      title: '旧仓库场景图',
      materialType: 'scene',
      description: '雨夜旧仓库',
      status: 'confirmed',
      necessity: '没有场景图，后续画面不可控。',
    });

    expect(task.kind).toBe('productionTask');
    expect(task.title).toBe('旧仓库场景图');
    expect(task.body).toContain('雨夜旧仓库');
    expect(task.acceptanceCriteria).toContain('后续画面不可控');
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
    });

    expect(node.type).toBe('image');
    expect(node.prompt).toContain('雨夜旧仓库');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test -- src/services/planningGraph.test.ts`

Expected: FAIL because `src/services/planningGraph.ts` does not exist.

- [ ] **Step 3: Implement graph helpers**

Create `src/services/planningGraph.ts`:

```ts
import { v4 as uuidv4 } from 'uuid';
import type {
  CanvasElement,
  Connection,
  PlanningElement,
  PlanningRequirement,
  TextElement,
  ImageElement,
  MediaElement,
} from '@/types/canvas';
import type { NormalizedPlanningResponse } from './planning';

export function buildPlanningNodesFromResponse(
  source: PlanningElement,
  response: NormalizedPlanningResponse,
): { nodes: PlanningElement[]; connections: Connection[] } {
  const storyBible = makePlanningNode(source, 'storyBible', response.storyBible.title, response.storyBible.body, 420, 0);
  const characterNodes = response.characters.map((character, index) =>
    makePlanningNode(source, 'characterPackage', character.title, character.body, 420, 320 + index * 300),
  );
  const plotNodes = response.plots.map((plot, index) => ({
    ...makePlanningNode(source, 'plot', plot.title, plot.body, 860, index * 320),
    requirements: plot.requirements,
  }));
  const nodes = [storyBible, ...characterNodes, ...plotNodes];
  const connections = nodes.map(node => makeConnection(source.id, node.id));
  return { nodes, connections };
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
    sourcePlanningId: source.id,
  };
}

function makeConnection(fromId: string, toId: string): Connection {
  return {
    id: uuidv4(),
    fromId,
    fromPortId: '',
    toId,
    toPortId: '',
  };
}

export function confirmRequirement(node: PlanningElement, requirementId: string): PlanningElement {
  return updateRequirementStatus(node, requirementId, 'confirmed');
}

export function dismissRequirement(node: PlanningElement, requirementId: string): PlanningElement {
  return updateRequirementStatus(node, requirementId, 'dismissed');
}

function updateRequirementStatus(
  node: PlanningElement,
  requirementId: string,
  status: PlanningRequirement['status'],
): PlanningElement {
  return {
    ...node,
    requirements: (node.requirements ?? []).map(req =>
      req.id === requirementId ? { ...req, status } : req,
    ),
  };
}

export function createTaskFromRequirement(source: PlanningElement, requirement: PlanningRequirement): PlanningElement {
  return {
    id: uuidv4(),
    type: 'planning',
    kind: 'productionTask',
    title: requirement.title,
    body: requirement.description || requirement.title,
    x: source.x + source.width + 80,
    y: source.y,
    width: 360,
    height: 260,
    recommendedTaskType: recommendedTaskTypeFor(requirement.materialType),
    acceptanceCriteria: requirement.necessity ? `必须满足：${requirement.necessity}` : '必须服务当前剧情节点的生产需求。',
    sourcePlanningId: source.id,
  };
}

function recommendedTaskTypeFor(materialType: PlanningRequirement['materialType']): PlanningElement['recommendedTaskType'] {
  if (materialType === 'text' || materialType === 'video' || materialType === 'audio') return materialType;
  return 'image';
}

export function detectPropVisualConflict(taskDescription: string, propDefinition: string): { conflict: boolean; reason?: string } {
  const colorWords = ['红', '银', '蓝', '黑', '白', '金', '血色'];
  const taskHits = colorWords.filter(word => taskDescription.includes(word));
  const propHits = colorWords.filter(word => propDefinition.includes(word));
  const hasDifferentColor = taskHits.length > 0 && propHits.length > 0 && taskHits.some(word => !propHits.includes(word));
  if (hasDifferentColor) {
    return { conflict: true, reason: '任务描述和道具视觉定义存在颜色或标识冲突。' };
  }
  return { conflict: false };
}

export function convertTaskToExecutionNode(task: PlanningElement): CanvasElement {
  const prompt = [task.title, task.body, task.acceptanceCriteria].filter(Boolean).join('\n\n');
  const base = {
    id: uuidv4(),
    x: task.x + task.width + 80,
    y: task.y,
    prompt,
    generation: { model: undefined },
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
```

- [ ] **Step 4: Wire real port ids after insertion**

When calling `buildPlanningNodesFromResponse` from UI code, insert nodes through `addElement` first so `withDefaultPorts` creates ports, then create connections using the actual first output and first input port ids. Do not rely on the empty ids returned by the draft `makeConnection` helper in final UI code.

- [ ] **Step 5: Run graph tests**

Run: `npm run test -- src/services/planningGraph.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/planningGraph.ts src/services/planningGraph.test.ts
git commit -m "feat: add planning graph helpers"
```

---

### Task 5: Planning Node UI

**Files:**
- Modify: `src/components/canvas/nodes/PlanningNode.tsx`
- Create: `src/components/canvas/nodes/PlanningNode.test.tsx`

- [ ] **Step 1: Write UI tests**

Create `src/components/canvas/nodes/PlanningNode.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { PlanningNode } from './PlanningNode';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { PlanningElement } from '@/types/canvas';

const node: PlanningElement = {
  id: 'plot1',
  type: 'planning',
  kind: 'plot',
  title: '怀表出现',
  body: '林晚发现旧怀表。',
  x: 0,
  y: 0,
  width: 360,
  height: 260,
  requirements: [
    { id: 'req1', title: '血色怀表特写', materialType: 'prop', status: 'pending', description: '只露标识' },
  ],
};

describe('PlanningNode', () => {
  beforeEach(() => {
    useCanvasStore.setState({ elements: [node], connections: [] } as Partial<ReturnType<typeof useCanvasStore.getState>>);
  });

  it('renders readable Chinese labels and pending requirements', () => {
    render(<PlanningNode el={node} />);

    expect(screen.getByText('剧情节点')).toBeInTheDocument();
    expect(screen.getByText('血色怀表特写')).toBeInTheDocument();
    expect(screen.getByText('待确认')).toBeInTheDocument();
  });

  it('confirms a requirement', () => {
    render(<PlanningNode el={node} />);

    fireEvent.click(screen.getByText('确认'));

    const updated = useCanvasStore.getState().elements[0] as PlanningElement;
    expect(updated.requirements?.[0].status).toBe('confirmed');
  });
});
```

- [ ] **Step 2: Run UI test to verify failure**

Run: `npm run test -- src/components/canvas/nodes/PlanningNode.test.tsx`

Expected before implementation: FAIL because labels are mojibake and there is no confirm control.

- [ ] **Step 3: Restore node labels**

In `PlanningNode.tsx`, replace `KIND_LABELS` with:

```ts
const KIND_LABELS: Record<PlanningNodeKind, string> = {
  projectSeed: '项目种子',
  storyBible: '故事圣经',
  characterPackage: '角色生产包',
  plot: '剧情节点',
  reference: '引用对象',
  productionTask: '生产任务',
};
```

- [ ] **Step 4: Add requirement rendering and confirmation**

Inside `PlanningNode`, derive:

```ts
const pendingRequirements = el.requirements?.filter(req => req.status === 'pending') ?? [];
```

Add a compact footer/body section that maps `pendingRequirements` and renders:

```tsx
<button
  type="button"
  className="pointer-events-auto"
  onPointerDown={(event) => event.stopPropagation()}
  onClick={() => updateElement(el.id, {
    requirements: el.requirements?.map(req =>
      req.id === requirement.id ? { ...req, status: 'confirmed' } : req,
    ),
  } as Partial<PlanningElement>, '确认素材需求')}
>
  确认
</button>
```

Also render a dismiss button:

```tsx
<button
  type="button"
  className="pointer-events-auto"
  onPointerDown={(event) => event.stopPropagation()}
  onClick={() => updateElement(el.id, {
    requirements: el.requirements?.map(req =>
      req.id === requirement.id ? { ...req, status: 'dismissed' } : req,
    ),
  } as Partial<PlanningElement>, '忽略素材需求')}
>
  忽略
</button>
```

- [ ] **Step 5: Add production task action stub**

For `el.kind === 'productionTask'`, render a button labeled `转换为生成节点`. In this task, it can dispatch an event only:

```tsx
window.dispatchEvent(new CustomEvent('planning:convert-task', { detail: { id: el.id } }));
```

Task 8 replaces this event-only stub with real conversion behavior.

- [ ] **Step 6: Run UI tests**

Run: `npm run test -- src/components/canvas/nodes/PlanningNode.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/canvas/nodes/PlanningNode.tsx src/components/canvas/nodes/PlanningNode.test.tsx
git commit -m "feat: render planning node requirements"
```

---

### Task 6: Planning Properties Panel

**Files:**
- Modify: `src/components/properties/PropertiesPanel.tsx`
- Create: `src/components/properties/PropertiesPanel.test.tsx`

- [ ] **Step 1: Write properties panel test**

Create `src/components/properties/PropertiesPanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { PropertiesPanel } from './PropertiesPanel';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { PlanningElement } from '@/types/canvas';

const planning: PlanningElement = {
  id: 'task1',
  type: 'planning',
  kind: 'productionTask',
  title: '血色怀表特写',
  body: '只露出怀表标识。',
  x: 0,
  y: 0,
  width: 360,
  height: 260,
  recommendedTaskType: 'image',
  acceptanceCriteria: '必须看清标识。',
  propStates: [{ visibility: 'markOnly', userConfirmed: true }],
};

describe('PropertiesPanel planning fields', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      elements: [planning],
      selectedIds: ['task1'],
    } as Partial<ReturnType<typeof useCanvasStore.getState>>);
  });

  it('edits planning title, kind, task type, and prop visibility', () => {
    render(<PropertiesPanel />);

    expect(screen.getByText('属性')).toBeInTheDocument();
    expect(screen.getByLabelText('类型')).toHaveValue('productionTask');
    expect(screen.getByLabelText('任务类型')).toHaveValue('image');
    expect(screen.getByLabelText('道具可见程度')).toHaveValue('markOnly');

    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '怀表近景' } });

    const updated = useCanvasStore.getState().elements[0] as PlanningElement;
    expect(updated.title).toBe('怀表近景');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test -- src/components/properties/PropertiesPanel.test.tsx`

Expected before implementation: FAIL because labels are mojibake and task/visibility fields are not present.

- [ ] **Step 3: Restore Chinese labels**

In `PropertiesPanel.tsx`, set:

```ts
const PLANNING_KIND_OPTIONS: { value: PlanningNodeKind; label: string }[] = [
  { value: 'projectSeed', label: '项目种子' },
  { value: 'storyBible', label: '故事圣经' },
  { value: 'characterPackage', label: '角色生产包' },
  { value: 'plot', label: '剧情节点' },
  { value: 'reference', label: '引用对象' },
  { value: 'productionTask', label: '生产任务' },
];
```

Replace visible section labels with `属性`, `布局`, `宽`, `高`, `媒体源`, `链接 URL`, `内容`, `企划`, `类型`, `标题`, `验收标准`.

- [ ] **Step 4: Add accessible labels**

Update `Field` so label text is associated with its control by wrapping is already enough for Testing Library if the control is inside the label. Keep:

```tsx
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span style={{ fontSize: 10.5, color: 'var(--ink-2)' }}>{label}</span>{children}</label>;
}
```

- [ ] **Step 5: Add task type and prop visibility controls**

Inside the planning section, for all planning nodes render:

```tsx
<Field label="任务类型">
  <select
    value={el.recommendedTaskType ?? ''}
    onChange={e => updateElement(el.id, { recommendedTaskType: e.target.value || undefined } as Partial<PlanningElement>)}
    className="input-paper"
    style={{ fontSize: 11.5 }}
  >
    <option value="">未指定</option>
    <option value="image">图片</option>
    <option value="text">文本</option>
    <option value="video">视频</option>
    <option value="audio">音频</option>
  </select>
</Field>
```

Render prop visibility:

```tsx
<Field label="道具可见程度">
  <select
    value={el.propStates?.[0]?.visibility ?? ''}
    onChange={e => updateElement(el.id, {
      propStates: [{ ...(el.propStates?.[0] ?? {}), visibility: e.target.value as PlanningElement['propStates'][number]['visibility'], userConfirmed: true }],
    } as Partial<PlanningElement>)}
    className="input-paper"
    style={{ fontSize: 11.5 }}
  >
    <option value="">未指定</option>
    <option value="full">完整可见</option>
    <option value="partial">局部可见</option>
    <option value="obscured">被遮挡</option>
    <option value="markOnly">只露标识</option>
  </select>
</Field>
```

- [ ] **Step 6: Run panel tests**

Run: `npm run test -- src/components/properties/PropertiesPanel.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/properties/PropertiesPanel.tsx src/components/properties/PropertiesPanel.test.tsx
git commit -m "feat: edit planning node properties"
```

---

### Task 7: Generate Story Bible Into Canvas Nodes

**Files:**
- Modify: `src/components/canvas/nodes/PlanningNode.tsx`
- Modify: `src/services/planningGraph.ts`
- Modify: `src/services/planningGraph.test.ts`
- Test: `src/components/canvas/nodes/PlanningNode.test.tsx`

- [ ] **Step 1: Add graph insertion helper test**

In `src/services/planningGraph.test.ts`, add:

```ts
it('creates source-to-child connections with provided port ids', () => {
  const connection = makePlanningConnection('seed', 'seedOut', 'bible', 'bibleIn');

  expect(connection).toMatchObject({
    fromId: 'seed',
    fromPortId: 'seedOut',
    toId: 'bible',
    toPortId: 'bibleIn',
  });
});
```

- [ ] **Step 2: Export connection helper**

In `src/services/planningGraph.ts`, add:

```ts
export function makePlanningConnection(fromId: string, fromPortId: string, toId: string, toPortId: string): Connection {
  return {
    id: uuidv4(),
    fromId,
    fromPortId,
    toId,
    toPortId,
  };
}
```

- [ ] **Step 3: Add generate button to project seed nodes**

In `PlanningNode.tsx`, for `el.kind === 'projectSeed'`, render a `生成故事圣经` button. The first implementation should dispatch:

```ts
window.dispatchEvent(new CustomEvent('planning:generate-bible', { detail: { id: el.id } }));
```

- [ ] **Step 4: Add event handler in `PlanningNode.tsx` module**

Use `useEffect` in `PlanningNode` only for project seed nodes:

```tsx
useEffect(() => {
  if (el.kind !== 'projectSeed') return;

  const onGenerate = async (event: Event) => {
    const detail = (event as CustomEvent<{ id: string }>).detail;
    if (detail.id !== el.id) return;
    const model = listModels('text')[0]?.id ?? '';
    const response = await generateShortDramaPlanning(el.body, model);
    const { nodes } = buildPlanningNodesFromResponse(el, response);
    const store = useCanvasStore.getState();
    for (const node of nodes) store.addElement(node);
  };

  window.addEventListener('planning:generate-bible', onGenerate);
  return () => window.removeEventListener('planning:generate-bible', onGenerate);
}, [el]);
```

Import `useEffect`, `generateShortDramaPlanning`, `buildPlanningNodesFromResponse`, and `listModels` from `@/services/gateway`.

- [ ] **Step 5: Keep connection creation for a follow-up patch if port ids are not available**

After node insertion, retrieve source and inserted nodes from `useCanvasStore.getState().elements`; create connections only when both source output and target input ports exist. Use `useCanvasStore.getState().addConnection` if available in the store. If the store does not expose `addConnection`, add the minimal store action in this task with a focused test.

- [ ] **Step 6: Run focused tests**

Run: `npm run test -- src/services/planningGraph.test.ts src/components/canvas/nodes/PlanningNode.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/canvas/nodes/PlanningNode.tsx src/services/planningGraph.ts src/services/planningGraph.test.ts src/components/canvas/nodes/PlanningNode.test.tsx
git commit -m "feat: generate planning nodes from project seed"
```

---

### Task 8: Requirement To Production Task Nodes

**Files:**
- Modify: `src/components/canvas/nodes/PlanningNode.tsx`
- Modify: `src/services/planningGraph.ts`
- Modify: `src/services/planningGraph.test.ts`

- [ ] **Step 1: Add test for task creation from confirmed requirements**

Extend `src/services/planningGraph.test.ts`:

```ts
it('places task nodes to the right of the source plot', () => {
  const task = createTaskFromRequirement(
    { ...seed, id: 'plot', kind: 'plot', x: 200, y: 300 },
    { id: 'req1', title: '旧仓库', materialType: 'scene', status: 'confirmed' },
  );

  expect(task.x).toBeGreaterThan(200);
  expect(task.y).toBe(300);
});
```

- [ ] **Step 2: Add create-task action in PlanningNode**

For confirmed requirements on plot nodes, render a button `创建任务节点`. On click:

```tsx
const task = createTaskFromRequirement(el, requirement);
useCanvasStore.getState().addElement(task);
```

If the source plot has output ports and the task gets input ports after insertion, create a connection from plot to task.

- [ ] **Step 3: Prevent duplicate task creation**

Before adding a task, check existing planning elements:

```ts
const exists = useCanvasStore.getState().elements.some(existing =>
  existing.type === 'planning' &&
  existing.kind === 'productionTask' &&
  existing.sourcePlanningId === el.id &&
  existing.title === requirement.title,
);
if (exists) return;
```

- [ ] **Step 4: Run focused tests**

Run: `npm run test -- src/services/planningGraph.test.ts src/components/canvas/nodes/PlanningNode.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/nodes/PlanningNode.tsx src/services/planningGraph.ts src/services/planningGraph.test.ts
git commit -m "feat: create production tasks from requirements"
```

---

### Task 9: Copy-Convert Task Nodes To Execution Nodes

**Files:**
- Modify: `src/components/canvas/nodes/PlanningNode.tsx`
- Modify: `src/services/planningGraph.ts`
- Modify: `src/services/planningGraph.test.ts`

- [ ] **Step 1: Add conversion tests for each supported task type**

In `src/services/planningGraph.test.ts`, add:

```ts
it.each([
  ['image', 'image'],
  ['text', 'text'],
  ['video', 'video'],
  ['audio', 'audio'],
] as const)('converts %s planning tasks to %s nodes', (taskType, expectedType) => {
  const converted = convertTaskToExecutionNode({
    ...seed,
    id: `task-${taskType}`,
    kind: 'productionTask',
    title: '生产任务',
    body: '生成内容',
    recommendedTaskType: taskType,
  });

  expect(converted.type).toBe(expectedType);
});
```

- [ ] **Step 2: Wire convert button**

In `PlanningNode.tsx`, replace the event-only conversion stub with:

```tsx
const executionNode = convertTaskToExecutionNode(el);
useCanvasStore.getState().addElement(executionNode);
```

Add a connection from task to generated execution node when ports are available.

- [ ] **Step 3: Preserve source task node**

Do not call `replaceElement`. The task node must remain in the store. The execution node should be placed to the right of the task node and selected after creation:

```ts
const store = useCanvasStore.getState();
store.addElement(executionNode);
store.setSelection([executionNode.id]);
```

- [ ] **Step 4: Run conversion tests**

Run: `npm run test -- src/services/planningGraph.test.ts src/components/canvas/nodes/PlanningNode.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/nodes/PlanningNode.tsx src/services/planningGraph.ts src/services/planningGraph.test.ts
git commit -m "feat: convert planning tasks to generation nodes"
```

---

### Task 10: Prop Visual Conflict Prompt

**Files:**
- Modify: `src/services/planningGraph.ts`
- Modify: `src/services/planningGraph.test.ts`
- Modify: `src/components/canvas/nodes/PlanningNode.tsx`

- [ ] **Step 1: Expand conflict tests**

In `src/services/planningGraph.test.ts`, add:

```ts
it('does not flag matching prop visual definitions', () => {
  expect(detectPropVisualConflict('银色怀表特写，只露蓝宝石标识', '银色怀表，蓝宝石标识')).toEqual({
    conflict: false,
  });
});
```

- [ ] **Step 2: Show conflict warning before conversion**

In `PlanningNode.tsx`, before conversion, inspect connected upstream planning reference nodes. For V1, only compare task body/title with connected `reference` nodes whose body contains `道具` or `prop`.

If `detectPropVisualConflict` returns conflict, show `window.confirm`:

```ts
const proceed = window.confirm(`${conflict.reason}\n继续按任务描述生成吗？`);
if (!proceed) return;
```

- [ ] **Step 3: Keep warning narrow**

Do not add character or scene conflict prompts in this task. The design only requires V1 conflict handling for prop visual conflicts.

- [ ] **Step 4: Run tests**

Run: `npm run test -- src/services/planningGraph.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/planningGraph.ts src/services/planningGraph.test.ts src/components/canvas/nodes/PlanningNode.tsx
git commit -m "feat: warn on prop visual conflicts"
```

---

### Task 11: Full Verification

**Files:**
- Potentially modify: `vitest.config.ts` only if Vitest fails with `ReferenceError: __dirname is not defined`.

- [ ] **Step 1: Run TypeScript check**

Run: `npm run lint:tsc`

Expected: PASS.

If it fails with `ReferenceError: __dirname is not defined` from Vitest config during tests, fix `vitest.config.ts` as:

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['developer-kit/**', 'node_modules/**', 'dist/**'],
  },
});
```

- [ ] **Step 2: Run focused test suite**

Run:

```bash
npm run test -- src/services/planning.test.ts src/services/planningGraph.test.ts src/components/canvas/nodes/PlanningNode.test.tsx src/components/chrome/ToolDock.test.tsx src/components/properties/PropertiesPanel.test.tsx src/hooks/useGlobalShortcuts.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 4: Run ESLint**

Run: `npm run lint:eslint`

Expected: PASS.

- [ ] **Step 5: Manual browser verification**

Run: `npm run dev`

Open `http://localhost:3000` and verify:

1. Add menu shows `企划节点`.
2. Pressing `P` creates a selected planning node titled `项目种子`.
3. Planning node Chinese labels are readable.
4. A plot node with pending requirements can confirm and dismiss items.
5. A confirmed requirement can become a production task node.
6. A production task node can copy-convert into an image or text node while the original task remains.
7. Dragging and selecting existing text/image/OmniScript nodes still works.

- [ ] **Step 6: Commit verification-only fixes**

If verification required small fixes, commit them:

```bash
git add <changed-files>
git commit -m "fix: polish planning loop verification"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Canvas-first planning loop: Tasks 2, 5, 7, 8.
- Project seed to story bible: Tasks 3, 7.
- Character production packages and plot nodes: Tasks 3, 4, 7.
- Restrained material requirements: Tasks 3, 5, 8.
- User confirmation before task nodes: Tasks 5, 8.
- Production task nodes with references: Tasks 4, 8, 9.
- Copy-conversion to execution nodes: Task 9.
- Prop visibility and visual conflict: Tasks 6, 10.
- V1 exclusions preserved: no asset library, no storyboard system, no video quality loop.

Placeholder scan:

- No implementation step depends on unspecified future behavior.
- All test commands and expected outcomes are listed.
- Open product questions from the spec are resolved for V1 by choosing one generic `planning` type and copy-conversion.

Type consistency:

- `PlanningElement.kind`, `PlanningRequirement.status`, `recommendedTaskType`, and `PropVisibility` are used consistently across service, UI, and tests.
- Concrete node conversion maps `image`, `text`, `video`, and `audio` to existing canvas element types.
