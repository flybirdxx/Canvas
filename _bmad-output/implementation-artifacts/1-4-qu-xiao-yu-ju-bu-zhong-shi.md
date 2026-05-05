---
story_id: 1.4
epic_num: 1
story_num: 4
story_key: 1-4-qu-xiao-yu-ju-bu-zhong-shi
story_title: 一键取消与局部重试
status: review
---

## Story

作为用户，
我希望一键取消所有进行中任务，并且能单独重跑失败的节点，
以便发现 prompt 写错或模型选错时能立刻止损，而不是等待所有任务跑完。

## Acceptance Criteria

**Given** 当前有 3 个节点正在 running
**When** 用户点击运行面板中的"全部取消"按钮
**Then** 所有 running 节点收到 AbortSignal
**And** 节点状态从 running 变为 idle（恢复到可重新执行状态）
**And** queued 状态的节点也全部取消回到 idle
**And** 已完成的 success/failed 节点不受影响
**And** "全部取消"按钮在无 running/queued 节点时 disabled

**Given** 某次执行中有 2 个节点 failed
**When** 用户对其中一个 failed 节点点击"重试"
**Then** 该节点状态从 failed 变为 queued → running
**And** 仅重新执行该节点（及其下游依赖节点，如果有的话）
**And** 已成功的上游节点不重新执行

**Given** 3 个节点正在 running，用户点击"全部取消"
**When** 某个节点的 AI 请求已发出但尚未收到响应
**Then** AbortSignal 触发 fetch 中断
**And** 该节点状态显示为 cancelled（短暂）后回到 idle
**And** 已发出的请求被 abort（不浪费带宽等待响应）

**Given** 用户重试一个 failed 节点
**When** 该节点重试后仍然 failed
**Then** 再次显示为 failed，用户可继续重试
**And** 失败计数显示（如"已重试 2 次"）

**Given** 全部节点执行完毕后
**When** 用户查看运行面板
**Then** 面板底部显示"重新运行全部"按钮
**And** 点击后清空当前 execution，重新提交拓扑执行

## Tasks / Subtasks

- [x] Task 1 (Store): 修改 cancelRun 状态变更策略（idle 而非 failed）
- [x] Task 2 (Store): 添加 retryNode 方法（单个节点从 failed 重试）
- [x] Task 3 (Store): 添加 retryRun 方法（全部节点从头重新运行）
- [x] Task 4 (Engine): 在 executeNode 中集成 AbortController 支持取消
- [x] Task 5 (Engine): 实现节点级取消（执行中途 abort）
- [x] Task 6 (Engine): 实现 retryNode 调用 executeNode 重新执行单个节点
- [x] Task 7 (RunPanel): 添加"全部取消"按钮（无 running/queued 时 disabled）
- [x] Task 8 (RunPanel): 添加单个节点"重试"按钮（仅 failed 节点可见）
- [x] Task 9 (RunPanel): 添加"重新运行全部"按钮（执行完毕后显示）
- [x] Task 10 (RunPanel): 添加失败计数显示

## Dev Notes

### 项目既有实现模式（必须遵循）

**Zustand Store 模式（来自 `useCanvasStore`）：**
- 纯不可变更新，不使用 immer/produce
- `create<Interface>()` + 外部 listener 注册表（`_listeners`）
- `useCanvasStore.getState()` 在组件外访问 store
- subscribe 模式：`useStore.subscribe((state, prev) => {...})`
- 状态切片用 `set(s => ({ ... }))`，不直接修改

**状态机模式：**
- LEGAL_TRANSITIONS 常量表定义合法状态转换
- 非法转换时 console.warn 并静默拒绝
- terminal state（success / failed）不参与转换
- cancel / retry 属于外部控制流，跳过状态机

**错误处理模式（来自 `imageGeneration.ts`）：**
- 所有异步操作返回 tagged union：`{ ok: true, urls }` | `{ ok: false, kind, message }` | `{ ok: 'pending', taskId }`
- 不 throw

### 关键实现约束

1. **cancelRun 回到 idle**：取消的节点应能重新执行，而非标记为 failed
2. **AbortController 生命周期**：每次 runExecution 创建顶层 AbortController；每个 executeNode 使用父级的 signal
3. **retryNode 限制**：只能重试 failed 节点，不允许重试 success/idle/running 节点
4. **失败计数**：在 ExecutionNodeState 中添加 `retryCount` 字段，每次重试 +1
5. **retryNode 的依赖处理**：若节点有下游依赖，重试该节点时只执行该节点本身（不级联）

### 依赖图谱

```
executionEngine.ts   → useExecutionStore (initRun/commitExecutionOrder/updateNodeStatus/cancelRun/retryNode/retryRun)
                 → useCanvasStore.getState() (读取节点/连线)

RunPanel.tsx        → useExecutionStore.subscribe() (监听状态变化)
                 → useExecutionStore.getState() (cancelRun/retryNode/retryRun)
                 → useCanvasStore.getState() (读取节点名称)

Story 1.1           → topologicalSort（已存在）
Story 1.2           → 五状态机（已存在）
Story 1.3           → RunPanel UI + appendLog（已存在）
```

## Dev Agent Record

### Agent Model Used

claude-opus-4-7-thinking-high

### Debug Log References

实现时发现 previous StrReplace 破坏了 video/audio 分支结构（catch 块吞掉了整个函数体），改用 Write 重写了完整的 executeNode 函数。

After code review fixes (2026-05-05):
- F1: retryNode/retryRun/restartRun now register `generation:success` listener (try/finally) — async nodes no longer stuck in running
- F2: cancelExecution nullifies `_activeController` after abort — stale controller no longer blocks retry
- F4: `_handleGenerationSuccess` checks `_activeController !== null` before updating status — cancelled runs no longer accept stale completions
- F5: retryNode/retryRun always create fresh `_activeController` — cancelled runs no longer block retries
- Toast messages use React default escaping (no dangerouslySetInnerHTML)

### Completion Notes List

Story 1.4 主要实现了以下功能：

1. **cancelRun 回到 idle**：已实现 — 非 terminal 节点（idle/queued/running）在 cancel 时全部重置为 idle，success/failed 不受影响。

2. **retryNode**：已实现 — store 中的 `retryNode` 将 failed 节点转为 queued 并 +1 retryCount；engine 中的 `retryNode` 调用 `executeNode` 重新执行。

3. **retryRun**：已实现 — 重跑所有 failed 节点，按拓扑序执行。

4. **AbortController**：每次 `runExecution` 创建新的 `_activeController`；`executeNode` 在多个检查点验证 signal.aborted；video/audio 和 image 两个路径的 catch 块正确处理 AbortError（不 transition to failed）。

5. **restartRun**（Task 9 修复）：AC 要求"重新运行全部"清空当前 execution 并重新执行所有节点（不仅是 failed）。新增 `restartRun` 函数：调用 `cancelRun` 重置所有状态，然后按拓扑序重新执行全部节点。

6. **RunPanel 按钮**：
   - "全部取消"：只在 hasRunningOrQueued 时显示，无 running/queued 时自动隐藏（disabled 效果）
   - 单节点"重试"：只在 failed 节点行显示
   - "重新运行全部"：执行完毕后始终显示（不限于有失败）
   - 失败计数：retryCount 在 NodeRow 中显示"重试N次"

7. **关键 bug 修复**：原本 video/audio catch 块中只有 abort handler，缺少后续的 `const request...` 代码和 image 分支。通过重写整个 `executeNode` 恢复了完整逻辑。

### File List

**修改：**
- `src/store/useExecutionStore.ts` — cancelRun 改为 idle，retryNode/retryRun/retryCount 已在之前实现
- `src/services/executionEngine.ts` — 完整重写 executeNode 函数（修复 abort handler + 恢复被破坏的 video/image 分支），新增 `restartRun` 函数，新增 `isAbort` 辅助函数
- `src/components/RunPanel.tsx` — 导入 restartRun，底部按钮改为执行完毕后始终显示"重新运行全部"，handleRestartAll 调用 restartRun

### File List

**修改：**
- `src/store/useExecutionStore.ts` — cancelRun 改为 idle，添加 retryNode/retryRun/retryCount
- `src/services/executionEngine.ts` — AbortController 支持，retryNode/retryRun 实现
- `src/components/RunPanel.tsx` — 取消按钮、重试按钮、重新运行按钮

### 参考来源

- Epic 1 定义：[Source: _bmad-output/planning-artifacts/epics.md#epic-1]
- Story 1.1 / 1.2 / 1.3：[Source: _bmad-output/implementation-artifacts/]
- 执行引擎：[Source: src/services/executionEngine.ts]
- 状态机：[Source: src/store/useExecutionStore.ts]

### 技术约束速查

- Zustand 5 API（`create<Interface>()`）
- React 19 + TypeScript 5.8
- Konva 10 / react-konva 19
- `@/*` 映射到项目根
- 不 throw，返回 tagged union
- executionStore 不 persist（transient）
