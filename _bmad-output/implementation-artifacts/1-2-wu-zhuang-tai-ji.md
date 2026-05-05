---
story_id: 1.2
epic_num: 1
story_num: 2
story_key: 1-2-wu-zhuang-tai-ji
story_title: 节点五状态机
status: done
---

## Story

作为用户，
我希望每个参与运行的节点在 idle / queued / running / success / failed 五状态间正确流转，
以便我清楚看到每个节点的执行进度，出问题时快速定位。

## Acceptance Criteria

**Given** 一个执行计划包含 3 个节点
**When** executionEngine 提交执行计划到 useExecutionStore
**Then** 所有节点初始状态为 idle
**And** executionStore 创建一条 execution 记录，包含唯一 execId、节点列表、拓扑顺序、创建时间

**Given** 节点 A 拓扑排序第一位
**When** 执行引擎开始处理节点 A
**Then** 节点 A 状态流转为 idle → queued → running
**And** 状态变更通过 Zustand subscribe 通知订阅者

**Given** 节点 A 执行中
**When** AI 生成成功返回结果
**Then** 节点 A 状态流转为 running → success
**And** executionStore 记录该节点的耗时（开始到结束的毫秒数）

**Given** 节点 B 执行中
**When** AI 生成返回错误（如 API 限流、网络超时）
**Then** 节点 B 状态流转为 running → failed
**And** executionStore 记录错误信息（错误类型、消息、时间戳）
**And** 不影响同层其他无依赖节点的执行

**Given** 一个节点当前状态为 running
**When** 外部尝试将其直接设为 success（跳过 running）
**Then** 状态机拒绝非法转换
**And** 记录警告日志（实际状态 vs 预期状态）

**Given** 所有节点执行完毕（全部 success 或 success + failed 混合）
**When** 最后一个节点状态变更
**Then** executionStore 标记该 execution 为 completed
**And** 计算总耗时

**Given** 用户刷新页面
**When** 页面重新加载
**Then** useExecutionStore 为空（transient store，不 persist）
**And** 之前的执行状态不恢复

## Tasks / Subtasks

- [x] Task 1 (状态机核心): 重构 ExecutionNodeState 接口，添加 durationMs / errorKind
- [x] Task 2 (状态机): 实现 LEGAL_TRANSITIONS 表，isLegalTransition 检查，拒绝非法转换
- [x] Task 3 (Store): 重构 initRun / commitExecutionOrder / updateNodeStatus / completeRun
- [x] Task 4 (Store): 添加 isRunComplete / getRunStats / getRunElapsedMs 辅助函数
- [x] Task 5 (Engine): 更新 executionEngine 使用新的 store API（initRun → commitExecutionOrder）
- [x] Task 6 (Engine): 正确触发 running → success / running → failed 转换

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

**错误处理模式（来自 `imageGeneration.ts`）：**
- 所有异步操作返回 tagged union：`{ ok: true, urls }` | `{ ok: false, kind, message }` | `{ ok: 'pending', taskId }`
- 不 throw

### 关键实现约束

1. **executionStore 不 persist**：transient store，页面刷新后清空
2. **状态机强制**：非法转换（idle → success、running → queued 等）被拒绝
3. **非法转换日志**：console.warn 记录实际状态 vs 尝试设置的状态
4. **durationMs 计算**：在状态转换到 terminal 时计算，不在 getter 中计算
5. **完成判断**：所有节点达到 success 或 failed 时 completeRun

### 依赖图谱

```
executionEngine.ts   → useExecutionStore (initRun/commitExecutionOrder/updateNodeStatus/completeRun)
                 → useCanvasStore.getState() (读取节点/连线)
                 → flowResolver.ts (composeEffectivePrompt)

RunPanel.tsx        → useExecutionStore.subscribe() (监听状态变化)
                 → useCanvasStore.getState() (读取节点名称)

Story 1.3           → 直接复用 useExecutionStore.subscribe()
Story 1.4           → 直接复用 useExecutionStore + cancelRun / removeRun
```

## Dev Agent Record

### Agent Model Used

claude-opus-4-7-thinking-high

### Debug Log References

N/A — No runtime errors; all TypeScript errors resolved.

### Completion Notes List

- [x] Story 1.2 implementation complete
- [x] Complete state machine: idle→queued→running→success|failed
- [x] LEGAL_TRANSITIONS table enforces valid transitions only
- [x] Illegal transitions: console.warn with before/after state
- [x] executionOrder stored in run for display ordering
- [x] durationMs computed on terminal state transition
- [x] Error classification: api-limit / network / timeout / unknown
- [x] completeRun marks entire run as completed
- [x] Helper functions: isRunComplete, getRunStats, getRunElapsedMs
- [x] executionEngine updated to use initRun → commitExecutionOrder API
- [x] Toast dispatched via 'execution:toast' CustomEvent

After code review fixes (2026-05-05):
- F1: Fixed durationMs NaN — only compute on terminal transition, not running
- F2: Added finally{} safety net in executeNode — pending aigenerating gets failed after settle
- F3: cancelRun bypasses state machine with clear comment; updateNodeStatus guards still protect normal paths
- F4: _listeners documented with cleanup comment (module lifetime is app lifetime, acceptable)
- F5: getActiveRun now returns deep snapshot {..., nodeStates: {...}}
- F6: resolveSize validates with Number/isFinite/positive check; invalid → '560x560'
- F7: updateNodeStatus accepts optional execId; falls back to last-match for legacy callers
- F8: rejectRun now accepts nodeIds and fills executionOrder for correct UI rendering
- F9: completeRun warns via console.warn if called before all nodes are terminal
- F10: classifyError takes string msg; non-Error caught values String()-coerced
- F11: runExecution refreshes element snapshot at each topo-sort level

### File List

**修改：**
- `src/store/useExecutionStore.ts` — 完整五状态机重构，LEGAL_TRANSITIONS，辅助函数
- `src/services/executionEngine.ts` — 使用新 store API（initRun → commitExecutionOrder）
- `src/components/canvas/CanvasElements.tsx` — 订阅方式不变（使用 _listeners 注册表）

### 参考来源

- Epic 1 定义：[Source: _bmad-output/planning-artifacts/epics.md#epic-1]
- Story 1.1：[Source: _bmad-output/implementation-artifacts/1-1-tuo-pu-pai-xu-zhi-xing-yin-qing.md]
- 架构决策 AD1：[Source: _bmad-output/planning-artifacts/architecture.md#AD1]
- Zustand 5 store 模式：[Source: src/store/useGenerationQueueStore.ts]
- 错误处理模式：[Source: src/services/imageGeneration.ts]

### 技术约束速查

- Zustand 5 API（`create<Interface>()`）
- React 19 + TypeScript 5.8
- Konva 10 / react-konva 19
- `@/*` 映射到项目根
- 不 throw，返回 tagged union
- jsPDF 中文字体：Story 1.1 不涉及
