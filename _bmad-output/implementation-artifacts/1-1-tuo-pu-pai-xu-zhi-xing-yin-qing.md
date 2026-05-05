---
story_id: 1.1
epic_num: 1
story_num: 1
story_key: 1-1-tuo-pu-pai-xu-zhi-xing-yin-qing
story_title: 拓扑排序执行引擎
status: done
---

## Story

作为用户，
我希望选中含连线子图后点"运行"，系统按拓扑序依次执行每个节点，
以便实现完整的可视化工作流编排。

## Acceptance Criteria

1. [AC1] 选中多个含连线的节点（含 `aigenerating` 占位节点），点击"运行"按钮，系统按拓扑序排序执行——无环有向图，同一 depth 的节点可并行
2. [AC2] 检测到有向环时，拒绝执行并显示"检测到循环依赖"的红色提示
3. [AC3] 每个节点的执行状态反映在节点上：idle / queued / running / success / failed 五种视觉状态
4. [AC4] 节点执行完毕后，自动将其 `src`（图像 URL）通过连线传递到下游节点的 prompt 参考中（仅传递 text prompt，不传图像引用）
5. [AC5] 执行过程不污染 canvasStore 的 undo/redo 栈（状态写入独立的 executionStore）

## Tasks / Subtasks

- [x] Task 1 (AC: 1, 2, 3)
  - [x] Subtask 1.1: 创建 `src/store/useExecutionStore.ts` — transient store，不 persist（标注 `// transient store — no persist`）
  - [x] Subtask 1.2: 定义拓扑排序算法（Kahn 算法）
  - [x] Subtask 1.3: 实现环检测（Kahn 算法中 inDegree > 0 则有环）
  - [x] Subtask 1.4: 定义节点执行状态类型：`idle | queued | running | success | failed`
  - [x] Subtask 1.5: 暴露 `topologicalSort(nodeIds, connections)` 纯函数，返回 `string[][] | null`
- [x] Task 2 (AC: 3, 5)
  - [x] Subtask 2.1: 定义 `ExecutionNodeState` 接口：`nodeId / status / startedAt / finishedAt / error`
  - [x] Subtask 2.2: executionStore 存储 `runs: ExecutionRun[]`，含 `nodeStates: Record<nodeId, ExecutionNodeState>`
  - [x] Subtask 2.3: 暴露 `subscribe` 供 RunPanel 监听状态变化
- [x] Task 3 (AC: 4)
  - [x] Subtask 3.1: 拓扑排序完成后，遍历每层节点，对每个节点执行生成
  - [x] Subtask 3.2: 复用 `flowResolver.composeEffectivePrompt` 合并上游 prompt
- [x] Task 4 (AC: 2)
  - [x] Subtask 4.1: 有环时调用 `executionStore.rejectRun(reason)`，UI 显示 rejected 状态

## 实现细节

**拓扑排序（Kahn 算法）：**
- 构建 inDegree 映射：统计每个节点有多少条入边
- BFS 层序遍历，同一深度的无依赖节点在同一数组中（支持并行执行）
- 若有环则 inDegree 不会全部归零，返回 `null`

**执行状态（边框颜色）：**
- `queued` → 黄色 `#E6A23C`
- `running` → 蓝色 `#409EFF`
- `success` → 绿色 `#67C23A`
- `failed` → 红色 `#F56C6C`
- 在 CanvasElements.tsx 每个节点的 Group 中添加 1px 外扩 Rect 渲染边框

**RunPanel（占位面板）：**
- 监听 `useExecutionStore` 状态，显示执行汇总
- 显示 rejected 提示（有环时）
- 完整 UI 在 Story 1.4 实现

**TopBar 集成：**
- 新增"运行"按钮（Play 图标，accent 背景）
- 点击时调用 `runExecution(selectedIds)`

**执行传播（AC4）：**
- 使用 `flowResolver.getUpstreamTextContributions` 获取上游节点文本贡献
- 通过 `composeEffectivePrompt` 合并为有效 prompt
- 只传递 text，不传图像引用（由 referenceImages 字段处理）

## Dev Notes

### 项目既有实现模式（必须遵循）

**Zustand Store 模式（来自 `useCanvasStore`）：**
- 纯不可变更新，不使用 immer/produce
- `create<Interface>()` + `persist()` + throttled adapter（但 executionStore **不 persist**）
- `useCanvasStore.getState()` 在组件外访问 store
- subscribe 模式：`useStore.subscribe((state, prev) => {...})`
- 状态切片用 `set(s => ({ ... }))`，不直接修改

**执行状态模式（参考 `useGenerationQueueStore`）：**
- transient store 的标准写法：`create<Interface>()((set, get) => ({ ... }))`
- 注释标注 `// transient store — no persist`

**错误处理模式（来自 `imageGeneration.ts`）：**
- 所有异步操作返回 tagged union：`{ ok: true, urls }` | `{ ok: false, kind, message }` | `{ ok: 'pending', taskId }`
- 不 throw

**类型导入模式（来自 `types/canvas.ts`）：**
- `import type { ... }` 仅用于不需要运行时值的类型
- 运行时导入：`import { ... } from '...'`

### 关键实现约束

1. **executionStore 不 persist**：在文件顶部加注释 `// transient store — no persist`，防止未来 agent 惯性添加 middleware
2. **executionStore 状态不写 undo 栈**：节点执行状态变更走 `useExecutionStore.setState()`，不走 `canvasStore.updateElement`
3. **拓扑排序纯函数**：`topologicalSort` 必须是纯函数，输入 nodeIds + connections，输出排序后的 nodeId 数组或 `null`（有环时）
4. **并行执行**：同一拓扑深度的节点（无依赖关系的节点）可并行调用 `runGeneration`，通过 `Promise.all`
5. **状态传播**：当前节点的执行结果（prompt text）通过 `flowResolver` 传递给下游节点，供下游生成使用

### 依赖图谱

```
executionEngine.ts          → useExecutionStore.ts (状态管理)
                         → useCanvasStore.getState() (读取节点/连线)
                         → flowResolver.ts (composeEffectivePrompt)
                         → imageGeneration.ts (runGeneration)
                         
RunPanel.tsx               → useExecutionStore.subscribe() (监听状态)
                         → useExecutionStore.getState() (读取当前状态)

Story 1.2 (节点五状态机)   → 直接复用 Story 1.1 的 executionStore
Story 1.3 (错误隔离)      → 直接复用 Story 1.1 的 executionStore + runGeneration 错误处理
Story 1.4 (运行面板)      → 直接复用 Story 1.1 的 executionStore.subscribe()
```

### 既有代码复用

| 既有文件 | 复用方式 |
|---------|---------|
| `src/utils/flowResolver.ts` | `composeEffectivePrompt()` 复用：获取上游 text 贡献 |
| `src/services/imageGeneration.ts` | `runGeneration()` 直接调用，传入 placeholderIds + GenRequest |
| `src/store/useCanvasStore.ts` | `getState().elements` 读取节点，`getState().connections` 读取连线 |
| `src/types/canvas.ts` | `Connection` 类型直接 import |

## Dev Agent Record

### Agent Model Used

claude-opus-4-7-thinking-high

### Debug Log References

N/A — No runtime errors; all TypeScript errors resolved during initial implementation.

After code review fixes (2026-05-05):
- F1: Replaced module-level `_listener` singleton with `Set<Listener>` for multi-subscriber support
- F2: Removed fragile `selectedIds[0]` hardcoded success marker; now uses `completeRun(execId)`
- F3: All code paths in `executeNode` now return `Promise.resolve()` for consistent async contract
- F4: Clarified image-node-without-src logic — falls through to generation, not skip
- F5: Added `completeRun(execId)` action to mark entire run as finished
- F6: `getActiveRun()` now returns shallow copy to prevent external mutation
- F7: Added `_isRunning` guard to prevent concurrent executions
- X1: Removed dead no-op block in `showToast`

### Completion Notes List

- [x] Story 1-1 implementation complete
- [x] Kahn topological sort implemented (returns `string[][] | null`)
- [x] Cycle detection via inDegree check
- [x] ExecutionStore: transient store, no persist
- [x] Five visual states: queued/yellow, running/blue, success/green, failed/red
- [x] RunPanel shows execution summary and rejected state
- [x] TopBar "运行" button triggers `runExecution(selectedIds)`
- [x] CanvasElements renders execution border on all node types
- [x] flowResolver used for upstream text propagation
- [x] AC5: execution state does NOT pollute canvasStore undo/redo

### File List

**新建：**
- `src/store/useExecutionStore.ts` — transient execution state
- `src/services/executionEngine.ts` — topology sort + execution driver
- `src/components/RunPanel.tsx` — execution status panel (placeholder, full UI in Story 1.4)

**修改：**
- `src/components/chrome/TopBar.tsx` — 添加 `onRun` prop + "运行"按钮
- `src/App.tsx` — 导入 `runExecution` + `RunPanel`，点击运行按钮触发执行
- `src/components/canvas/CanvasElements.tsx` — 每个节点渲染执行状态边框，订阅 executionStore

### 参考来源

- Epic 1 定义：[Source: _bmad-output/planning-artifacts/epics.md#epic-1]
- 架构决策 AD1：[Source: _bmad-output/planning-artifacts/architecture.md#AD1]
- Zustand 5 store 模式：[Source: src/store/useGenerationQueueStore.ts]
- 拓扑环检测（现有实现）：[Source: src/store/useCanvasStore.ts#L426-L447]（复用 DFS 逻辑）
- 执行状态定义：[Source: _bmad-output/planning-artifacts/architecture.md#AD1]

### 技术约束速查

- Zustand 5 API（`create<Interface>()`，不是 `create(...)`）
- React 19 + TypeScript 5.8（ES2022, isolatedModules）
- Konva 10 / react-konva 19（Canvas 2D）
- `@/*` 映射到项目根（不是 `src/`）
- 不 throw，返回 tagged union
- 不使用 `@/` 前缀 import
- jsPDF 中文字体：Story 1.1 不涉及，参考 project-context.md

### 验收标准详解

**AC1 — 拓扑序执行：**
- Kahn 算法或 DFS 后序反转均可
- 入口：用户提供选中的 nodeIds（用户通过点击"运行"按钮时选中的含连线节点）
- 出口：`string[]` 排序后的 nodeId，或 `null`（有环）

**AC2 — 环检测：**
- 复用 `useCanvasStore.addConnection` 中的 DFS 逻辑（lines 426-447）
- 检测到环时显示 toast，状态置 `rejected`

**AC3 — 五状态视觉：**
- 仅 Story 1.1 期间：节点边框颜色变化（queued=黄 / running=蓝 / success=绿 / failed=红）
- 完整 UI 状态机在 Story 1.2 中实现

**AC4 — prompt 传递：**
- 仅传递 text prompt（不传图像引用——图像由 `referenceImages` 字段处理，不走连线传递）
- 使用 `flowResolver.getUpstreamTextContributions` 获取上游贡献

**AC5 — 状态隔离：**
- 所有执行状态写入 `useExecutionStore`（不 persist）
- canvasStore 的 undo/redo 栈不受影响
