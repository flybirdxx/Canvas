# omniScript × Canvas 深度联动 PRD

> **文档版本：** 1.0
> **创建日期：** 2026-05-10
> **作者：** AI Canvas Pro 产品团队
> **状态：** 草稿
> **目标版本：** AI Canvas Pro v2.x

---

## 1. Overview / 概述

### 1.1 Problem Statement / 问题陈述

当前 AI Canvas Pro 中的 **omniScript 剧本分镜系统**与**画布执行系统**是两条独立的数据流：

- **ScriptElement** 解析出 **SceneElement**，仅用于 Storyboard 视图浏览
- **executionEngine** 执行选中的节点时，不感知 Scene 的台词/角色/情绪语义
- **flowResolver** 只能从 text/sticky 节点收集文字，无法从 scene 提取结构化内容
- **SceneElement** 没有任何端口，无法连接到生成管线
- 生成结果（图片）与 Scene 没有自动关联，需手动拖拽建立 `linkedImageId`

结果是：用户写好剧本后，必须手动在每个 Scene 旁边创建一个 image 节点、连线、写 prompt，重复劳动，体验割裂。

### 1.2 Proposed Solution / 解决方案

将 omniScript 的结构化剧本语义（场次、角色、台词、情绪）**深度嵌入**画布执行管线，实现：

> **"剧本即流水线"** — 从结构化 Scene 自动推导 prompt，从生成结果自动回填 linkedImageId，让剧本创作和 AI 生成无缝衔接。

### 1.3 Scope / 范围

**In Scope（本期）：**
- E1: Scene 节点接入执行引擎（端口系统）
- E2: 从 Scene 的 ScriptLine 自动推导 prompt
- E3: 执行结果自动回填 linkedImageId
- E4: Storyboard 视图联动（选中执行 → 结果回显）
- E5: 分镜执行模式（从 Storyboard 一键批量生成）

**Out of Scope（下期）：**
- ScriptElement 的端口化（作为编排容器）
- Scene 重新排序后自动重排执行顺序
- 视频生成与 scene 的时间轴对齐
- 协作/评论系统

---

## 2. User Stories / 用户故事

### 2.1 主用户故事

> **作为** 创意内容创作者（编剧、广告创意、短视频策划），
> **我想要** 在剧本编辑器中完成台词和场景描述后，一键驱动 AI 生成对应的画面，
> **这样** 不需要来回切换视图、手动复制粘贴 prompt，大幅缩短从剧本到视觉稿的创作周期。

### 2.2 子用户故事

| ID | 角色 | 故事 |
|----|------|------|
| US-01 | 编剧 | 我在 SceneDetailOverlay 中精修了对白和情绪，希望执行时这些信息能自动汇入 prompt |
| US-02 | 导演 | 我选中画布上多个 scene 节点，希望按从上到下的拓扑顺序批量生成图片 |
| US-03 | 设计师 | 我从 Storyboard 视图一键执行整部剧本的生成，生成的图片自动出现在对应 scene 旁 |
| US-04 | 审核 | 执行完成后，我能在 Storyboard 视图中看到每个 scene 的生成结果缩略图和 prompt |

---

## 3. Current State Analysis / 开发现状分析

### 3.1 已实现的功能

| 模块 | 文件 | 功能 |
|------|------|------|
| ScriptNode | `nodes/ScriptNode.tsx` | Markdown 剧本编辑，保存时调用 `parseScriptMarkdown` |
| Storyboard Sync | `services/storyboardSync.ts` | 剧本改动后自动增删 SceneElement |
| StoryboardView | `components/StoryboardView.tsx` | 网格视图、拖拽排序、图片关联 |
| SceneDetailOverlay | `SceneDetailOverlay.tsx` | 双 Tab 编辑（剧本行 + 分析） |
| Execution Engine | `services/executionEngine.ts` | 拓扑排序执行，支持 AbortController |
| Flow Resolver | `utils/flowResolver.ts` | 收集上游 text/image 贡献 |
| Port System | `store/portDefaults.ts` | 定义各元素类型的默认端口 |
| NodeInputBar | `components/NodeInputBar.tsx` | 选中节点的 prompt 输入栏 |

### 3.2 关键缺口（Gap Analysis）

```
现有数据流（断裂）：
┌──────────────┐     parseScriptMarkdown      ┌──────────────┐
│ ScriptElement │ ─────────────────────────▶  │ SceneElement  │
│ (markdown)    │                             │ (lines[])    │
└──────────────┘                             └──────┬───────┘
                                                     │ 独立存在
                         executionEngine           ✗  不感知
                         flowResolver              ✗  不读取
                         prompt 生成               ✗  无法利用
                                                      │
                         生成结果图片               ✗  不回填 linkedImageId
```

| 缺口编号 | 缺口描述 | 影响范围 |
|----------|----------|----------|
| G1 | `SceneElement` 的 `portDefaults` 为空数组，无端口 | 无法与 image 节点连线 |
| G2 | `flowResolver` 不识别 `scene` 类型节点 | scene 台词无法汇入 prompt |
| G3 | `executeNode` 中 scene 被当作 file 跳过（line 289） | 无法触发生成 |
| G4 | 生成结果成功后不更新 scene 的 `linkedImageId` | 图片与 scene 割裂 |
| G5 | Storyboard 视图无法触发执行 | 只能浏览，不能行动 |
| G6 | 分镜节点没有"一键批量生成"入口 | 需手动选节点再 Run |

---

## 4. Feature Specifications / 功能规格

### 4.1 Epic 1: Scene 节点端口化

**目标：** 将 `SceneElement` 从"纯展示节点"升级为"可执行节点"，赋予端口使其能接入画布管线。

#### 4.1.1 F1: Scene 端口扩展

**描述：** 修改 `portDefaults.ts` 中 scene 的端口模板：

```typescript
// 修改前
scene: { inputs: [], outputs: [] }

// 修改后
scene: {
  inputs: [{ type: 'text', label: 'Prompt' }],
  outputs: [{ type: 'image', label: 'Image' }, { type: 'text', label: 'Text' }],
}
```

**新增输出端口说明：**
- `Image` 输出：当 scene 关联了 `linkedImageId` 时，输出该图片 URL
- `Text` 输出：输出 scene 的台词内容（所有 ScriptLine 的文本拼接）

**影响文件：**
- `src/store/portDefaults.ts`

**向后兼容：** 已有 scene 节点不自动重新生成端口（按需生成，或通过 migration 在加载时补充）

#### 4.1.2 F2: 新增 `isScene` 类型守卫

**描述：** 在 `src/types/canvas.ts` 中新增：

```typescript
export function isSceneElement(el: CanvasElement): el is SceneElement {
  return el.type === 'scene';
}
export function isScriptElement(el: CanvasElement): el is ScriptElement {
  return el.type === 'script';
}
```

**影响文件：**
- `src/types/canvas.ts`

---

### 4.2 Epic 2: Flow Resolver 集成 Scene 语义

**目标：** 让执行引擎能够从 scene 的 `ScriptLine[]` 自动提取 prompt 内容。

#### 4.2.1 F3: scene 作为文字源

**描述：** 修改 `flowResolver.ts` 的 `getOutgoingText()`，新增 scene 分支：

```typescript
case 'scene':
  // 拼接所有 ScriptLine 的 content，按 lineType 分类组织
  return composeScenePrompt(el as SceneElement);
```

新增 `composeScenePrompt()` 函数，将 scene 的结构化台词转为自然语言 prompt：

```
格式：[场景描述]
角色：
- 角色名（情绪）：台词
- 角色名（情绪）：台词

动作描述：
[环境描写]
```

#### 4.2.2 F4: scene 作为图像源

**描述：** 修改 `getUpstreamImageContributions()`，新增 scene 分支：

```typescript
case 'scene': {
  const scene = src as SceneElement;
  if (!scene.linkedImageId) continue;
  const linked = elementsById.get(scene.linkedImageId) as ImageElement;
  if (!linked?.src) continue;
  url = linked.src;
  label = `分镜${scene.sceneNum} · ${scene.title || '未命名'}`;
}
```

---

### 4.3 Epic 3: 执行引擎集成 Scene

**目标：** 让 `executeNode` 能正确处理 scene 类型节点，触发 AI 生成。

#### 4.3.1 F5: scene 执行逻辑

**描述：** 修改 `executionEngine.ts` 中 `executeNode()` 的节点类型判断逻辑：

```typescript
// 修改前（line 289）：scene 落入 file 分支被跳过
// 修改后：scene 单独处理

if (el.type === 'scene') {
  // 策略：scene 本身不生成内容，而是驱动关联的 image 节点
  // 做法：在 scene 的 outputs 中找到 linkedImageId 对应的 image，
  //       对该 image 节点递归调用 executeNode
  const scene = el as unknown as SceneElement;
  if (scene.linkedImageId) {
    const linked = elements.find(e => e.id === scene.linkedImageId);
    if (linked) {
      await executeNode(linked.id, execId, elements, connections);
      return;
    }
  }
  // 无关联图片：自动创建一个 image 节点（宽高继承 scene 尺寸）
  const newImageEl: ImageElement = {
    id: uuidv4(),
    type: 'image',
    x: el.x + el.width + 60,
    y: el.y,
    width: Math.min(el.width, 512),
    height: Math.min(el.height, 512),
    src: '',
    prompt: composeScenePrompt(el as SceneElement),
    inputs: makePorts(PORT_DEFAULTS.image.inputs),
    outputs: makePorts(PORT_DEFAULTS.image.outputs),
  };
  addElement(newImageEl, '自动创建分镜图像节点');
  // 连线: scene → newImageEl
  const sceneOutPort = el.outputs?.find(p => p.type === 'image');
  if (sceneOutPort && newImageEl.inputs?.[0]) {
    addConnection({
      id: uuidv4(),
      fromId: el.id,
      fromPortId: sceneOutPort.id,
      toId: newImageEl.id,
      toPortId: newImageEl.inputs[0].id,
    });
  }
  // 更新 scene.linkedImageId
  updateElement(el.id, { linkedImageId: newImageEl.id });
  await executeNode(newImageEl.id, execId, elements, connections);
  return;
}
```

#### 4.3.2 F6: scene 生成 prompt 自动推导

**描述：** `composeScenePrompt()` 实现：

```
输入：SceneElement { sceneNum, title, content, lines, analysisNote }

输出字符串：
```
[场景 ${sceneNum}: ${title || '未命名'}]
${content ? content + '\n' : ''}
${lines?.length ? lines.map(l => {
  if (l.lineType === 'dialogue') return `  ${l.role || '旁白'}${l.emotion ? `（${l.emotion}）` : ''}：${l.content}`;
  if (l.lineType === 'action') return `  [动作] ${l.content}`;
  if (l.lineType === 'environment') return `  [环境] ${l.content}`;
  return `  ${l.content}`;
}).join('\n') : ''}
${analysisNote ? `\n[导演备注] ${analysisNote}` : ''}
```
```

---

### 4.4 Epic 4: 生成结果自动回填

**目标：** AI 图片生成成功后，自动将结果与对应的 scene 关联。

#### 4.4.1 F7: image 生成成功后自动关联 scene

**描述：** 修改 `imageGeneration.ts` 中 `replacePlaceholderWithImage()` 函数：

```typescript
// 在 replacePlaceholderWithImage 末尾新增：
// 自动查找该 image 是否被某个 scene 的 linkedImageId 引用
// 或该 image 的 inputs 中是否有来自 scene 的连接
const canvasState = useCanvasStore.getState();
const connections = canvasState.connections;
const elements = canvasState.elements;

// 查找所有 linkedImageId === placeholderId 的 scene
const linkedScenes = elements.filter(el =>
  el.type === 'scene' && (el as any).linkedImageId === placeholderId
);

// 查找是否有 scene 输出端口连接到该 image
const sceneInputs = connections.filter(c =>
  c.toId === placeholderId &&
  elements.find(e => e.id === c.fromId)?.type === 'scene'
);

if (linkedScenes.length > 0) {
  // scene 已有 linkedImageId，已关联，无需操作
} else if (sceneInputs.length > 0) {
  // scene 通过连线提供了图像输入
  // 更新 scene.linkedImageId = placeholderId
  for (const conn of sceneInputs) {
    const scene = elements.find(e => e.id === conn.fromId);
    if (scene) {
      canvasState.updateElement(scene.id, { linkedImageId: placeholderId });
    }
  }
}
```

#### 4.4.2 F8: Storyboard 视图缩略图实时更新

**描述：** `StoryboardView` 中 `findThumbnailForScene` 已经支持 `linkedImageId`。问题在于当前生成结果不会写入 `linkedImageId`。F7 修复后，Storyboard 视图无需修改即可自动显示生成结果。

同时在 `SceneCard` 中新增"查看生成结果"按钮，点击后在画布上高亮对应的 image 节点。

---

### 4.5 Epic 5: 分镜执行模式

**目标：** 在 Storyboard 视图中提供一键批量执行入口。

#### 4.5.1 F9: Storyboard 执行面板

**描述：** 在 `StoryboardView` 顶部新增执行工具栏：

```typescript
// 新增组件 StoryboardExecuteBar
interface StoryboardExecuteBarProps {
  scenes: SceneElement[];
  onExecuteAll: (sceneIds: string[]) => void;
  onExecuteSelected: (sceneIds: string[]) => void;
}
```

**UI 元素：**
- **"生成全部"** 按钮（primary，accent 配色）
  - 执行所有 scene（按 sceneNum 顺序）
  - 显示总进度：X/Y 场次完成
- **"生成选中"** 按钮（secondary）
  - 执行选中的 scene（可多选）
- **"查看结果"** 按钮（链接样式）
  - 切换到画布视图，聚焦第一个有 `linkedImageId` 的 scene

**执行逻辑：**
```typescript
async function handleExecuteAll(sceneIds: string[]) {
  // 按 sceneNum 排序
  const sorted = [...sceneIds].sort((a, b) => {
    const sa = scenes.find(s => s.id === a)!;
    const sb = scenes.find(s => s.id === b)!;
    return sa.sceneNum - sb.sceneNum;
  });

  // 批量触发执行（串行：每场等上一场完成）
  for (const sceneId of sorted) {
    await runExecution([sceneId]);
    // 轮询执行状态直到完成（isRunComplete）
  }

  // 全部完成：切换到画布视图
  setViewMode('canvas');
}
```

#### 4.5.2 F10: Storyboard 场景多选

**描述：** 当前 `StoryboardView` 只支持单选 scene。扩展为多选：

```typescript
// 支持 Ctrl+点击多选，Shift+点击范围选
const handleSceneClick = (sceneId: string, e: React.MouseEvent) => {
  if (e.ctrlKey || e.metaKey) {
    // 切换选中
    if (selectedSceneIds.includes(sceneId)) {
      setSelection(selectedSceneIds.filter(id => id !== sceneId));
    } else {
      setSelection([...selectedSceneIds, sceneId]);
    }
  } else if (e.shiftKey && selectedSceneIds.length > 0) {
    // 范围选择
    const sortedScenes = [...scenes].sort((a, b) => a.sceneNum - b.sceneNum);
    const lastSelected = sortedScenes.find(s => s.id === selectedSceneIds[selectedSceneIds.length - 1])!;
    const current = sortedScenes.find(s => s.id === sceneId)!;
    const inRange = sortedScenes.filter(s =>
      s.sceneNum >= Math.min(lastSelected.sceneNum, current.sceneNum) &&
      s.sceneNum <= Math.max(lastSelected.sceneNum, current.sceneNum)
    );
    setSelection([...new Set([...selectedSceneIds, ...inRange.map(s => s.id)])]);
  } else {
    setSelection([sceneId]);
  }
};
```

---

### 4.6 Epic 6: 剧本节点执行（可选增强）

**目标：** 将 ScriptElement 本身变成可执行节点，点击后执行其所有子 scene。

#### 4.6.1 F11: Script 节点执行

**描述：** 在 `executeNode` 中新增对 `script` 类型的处理：

```typescript
if (el.type === 'script') {
  const script = el as ScriptElement;
  const childScenes = elements.filter(
    e => e.type === 'scene' && (e as any).scriptId === script.id
  );
  if (childScenes.length === 0) {
    store.updateNodeStatus(nodeId, 'success');
    appendLog(execId, 'info', `${nodeId} 无子分镜，跳过`, nodeId);
    return;
  }
  // 递归执行所有子 scene（串行）
  for (const scene of childScenes.sort((a, b) => a.sceneNum - b.sceneNum)) {
    await executeNode(scene.id, execId, elements, connections);
  }
  store.updateNodeStatus(nodeId, 'success');
  return;
}
```

---

## 5. Technical Specifications / 技术规格

### 5.1 数据流（改动后）

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        改动后的数据流                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ScriptElement (markdown)                                               │
│       │                                                                │
│       ▼ parseScriptMarkdown()                                           │
│  SceneElement[] (sceneNum, title, lines, analysisNote)                 │
│       │                                                                │
│       ├─► portDefaults[scene] = { inputs:[text], outputs:[image,text] }│
│       │                                                                │
│       ├─► Flow Resolver ──► composeScenePrompt() ──► effectivePrompt   │
│       │                                                                │
│       ├─► executeNode(scene) ──► 自动创建/查找 linkedImageId          │
│       │                   │                                            │
│       │                   ▼                                            │
│       │                   ImageElement 生成                             │
│       │                   │                                            │
│       ▼                   │                                            │
│  linkedImageId ◄──────────┘ (replacePlaceholderWithImage)             │
│       │                                                                │
│       ▼                                                                │
│  StoryboardView 缩略图自动更新                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 核心改动文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `src/store/portDefaults.ts` | 修改 | scene 端口模板扩展 |
| `src/types/canvas.ts` | 新增 | 类型守卫函数 |
| `src/utils/flowResolver.ts` | 修改 | scene 作为文字/图像源 |
| `src/services/executionEngine.ts` | 修改 | scene 执行逻辑 + F6 prompt 推导 |
| `src/services/imageGeneration.ts` | 修改 | 生成成功后回填 linkedImageId |
| `src/components/StoryboardView.tsx` | 修改 | 多选支持 + 执行面板 |
| `src/components/StoryboardExecuteBar.tsx` | 新增 | 批量执行工具栏 |
| `src/services/scenePromptComposer.ts` | 新增 | composeScenePrompt 纯函数 |
| `src/hooks/canvas/useSceneExecution.ts` | 新增 | 分镜执行 Hook |

### 5.3 API / 接口设计

#### 5.3.1 `composeScenePrompt(scene: SceneElement): string`

纯函数，输入 scene，输出自然语言 prompt 字符串。无副作用。

#### 5.3.2 `linkSceneToImage(sceneId: string, imageId: string)`

更新 scene 的 `linkedImageId` 字段。幂等操作。

#### 5.3.3 `findOrCreateLinkedImage(sceneId: string): ImageElement`

查找 scene 已有的 linkedImageId 对应 image；若不存在，在 scene 右侧自动创建一个 image 节点并连线。

### 5.4 新增依赖

无新增外部依赖。所有改动基于现有堆栈（React 19 + Konva + Zustand）。

---

## 6. User Flows / 用户流程

### 6.1 流程一：剧本 → 批量生成

```
1. 用户创建 ScriptElement，输入 Markdown 剧本
       ↓
2. parseScriptMarkdown() → SceneElement[] 出现在画布上
       ↓
3. 用户切换到 Storyboard 视图
       ↓
4. 点击「生成全部」
       ↓
5. 按 sceneNum 顺序执行每个 scene：
   - 有 linkedImageId → 直接执行 image 节点
   - 无 linkedImageId → 自动创建 image 节点，连线
       ↓
6. 每场完成后：replacePlaceholderWithImage → linkedImageId 回填
       ↓
7. Storyboard 视图缩略图逐帧更新
       ↓
8. 全部完成，切换到画布，高亮有生成结果的 scene
```

### 6.2 流程二：手动连线执行（进阶）

```
1. 用户选中 scene 节点 → 显示输入/输出端口
       ↓
2. 从 scene 的 Text 输出拖拽到 image 节点的 Prompt 输入
       ↓
3. scene 台词作为上游贡献汇入 image 的 prompt
       ↓
4. 用户选中 image，点击 Run
       ↓
5. flowResolver.composeEffectivePrompt() 合并 scene 台词 + image 自有 prompt
       ↓
6. 生成完成，scene.linkedImageId 自动更新
```

---

## 7. Edge Cases / 边界情况

| 场景 | 处理方式 |
|------|----------|
| scene 无 lines 且无 content | 使用 title 作为 prompt，若 title 也为空 → 提示用户完善内容 |
| scene 已有 linkedImageId 且 image 有 src | 视为"已完成"，跳过生成 |
| scene 已有 linkedImageId 但 image 无 src | 继续执行该 image 节点 |
| scene 的输出连线到已有图片的 image 节点 | 执行该 image，使用 scene 内容作为 prompt 的一部分 |
| 批量执行中途取消 | `cancelExecution()` 清理，保留已生成的结果 |
| scene 无 scriptId（独立创建的 scene） | 正常执行，不尝试从 script 获取上下文 |
| 生成失败 | scene 保持无 linkedImageId 状态，RunPanel 显示失败，用户可 retry |
| scene 已连线到多个 image | 执行第一个 image 节点（拓扑顺序第一个） |
| 分镜重新排序后（drag reorder） | 保持 linkedImageId 不变，sceneNum 更新 |

---

## 8. Open Questions / 开放问题

| # | 问题 | 建议方案 | 优先级 |
|---|------|----------|--------|
| Q1 | Scene 的 `width/height` 从何而来？自动布局还是手动？ | 暂时继承当前固定 320x200，后续支持手动拖拽调整 | P1 |
| Q2 | scene 执行时自动创建的 image 节点，尺寸如何设定？ | 默认使用 scene.height（最大 512px），宽高比保持 1:1 | P1 |
| Q3 | scene 的 `analysisNote` 是否应加入 prompt？ | 是，F6 方案中已包含 | P2 |
| Q4 | scene 能否输出多个 image（多图生成）？ | 本期不支持，N=1 | P3 |
| Q5 | ScriptNode 执行时，是否需要等待所有子 scene 完成？ | 是，串行执行 | P2 |
| Q6 | 批量执行时，是否显示总进度条？ | 使用 RunPanel 的 per-node 进度 + StoryboardExecuteBar 的 X/Y 完成数 | P2 |

---

## 9. Acceptance Criteria / 验收标准

### AC1: Scene 端口
- [ ] 选中 scene 节点时，显示 1 个 Text 输入端口 + 2 个输出端口（Image + Text）
- [ ] 可以从 scene 的 Text 输出端口拖拽连线到 image 节点的 Prompt 输入端口
- [ ] 连线后，flowResolver 能识别 scene 并收集其台词

### AC2: Prompt 自动推导
- [ ] 执行无连接的 scene 节点时，自动生成包含 sceneNum、title、lines 内容的 prompt
- [ ] lines 中的 dialogue/action/environment 以不同格式区分
- [ ] analysisNote 以 `[导演备注]` 标签追加

### AC3: 自动创建节点
- [ ] 执行无 linkedImageId 的 scene 时，在右侧自动创建一个 image 节点
- [ ] 自动创建的 image 节点与 scene 有正确的连线（scene output → image input）
- [ ] scene.linkedImageId 在 image 创建后立即更新

### AC4: 生成结果回填
- [ ] image 生成成功后，对应的 scene.linkedImageId 自动更新
- [ ] Storyboard 视图中该 scene 的缩略图立即刷新显示
- [ ] 通过连线连接的 scene→image，生成后同样更新 linkedImageId

### AC5: 批量执行
- [ ] Storyboard 视图支持 Ctrl+点击多选 scene
- [ ] 点击「生成选中」按 sceneNum 顺序执行选中的 scene
- [ ] 执行进度在 StoryboardExecuteBar 中显示（已完成/总场次）
- [ ] 全部完成后自动切换到画布视图

### AC6: 向后兼容
- [ ] 已有 linkedImageId 的 scene 执行时跳过创建步骤
- [ ] 已有正确连线（scene→image）的 scene 复用现有连线，不重复创建
- [ ] 没有端口的旧 scene 节点在选中时自动补充端口

---

## 10. Non-Functional Requirements / 非功能性需求

| 维度 | 要求 |
|------|------|
| **性能** | 100 个 scene 的批量执行，启动时间 < 2s（执行引擎本身无性能问题，瓶颈在 AI 网关） |
| **稳定性** | 任何单场生成失败不影响其他场次；取消操作不留孤儿节点 |
| **可逆性** | 所有操作均可撤销（store 已有 historySlice） |
| **隐私** | 剧本内容通过 gateway 上传至 AI 服务，需在 UI 上提示用户 |
