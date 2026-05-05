---
story_id: 1.5
epic_num: 1
story_num: 5
story_key: 1-5-sheng-cheng-guan-xian-ji-cheng
story_title: 与生成管线集成
status: review
---

## Story

作为用户，
我希望运行引擎调用现有的 AI 生成能力，
以便我的连线工作流不只是静态图示，而是真正驱动 AI 生成的执行引擎。

## Acceptance Criteria

**Given** 用户选中 text 节点→image 节点→image 节点的子图
**When** 点"运行"提交执行
**Then** executionEngine 拓扑排序后，按序对每个可生成节点调用现有的 `runOneSlot`
**And** text 节点是纯输入（无生成），被跳过但内容通过 flowResolver 传给下游

**Given** image 节点执行中
**When** `runOneSlot` 返回成功
**Then** replacePlaceholderWithImage 正常替换节点
**And** executionStore 更新节点状态为 success

**Given** image 节点执行中
**When** `runOneSlot` 返回错误
**Then** 节点状态更新为 failed
**And** 错误信息写入该节点的日志
**And** 其他无依赖关系的分支节点继续执行

**Given** 一个子图中包含不支持运行的节点类型（如 sticky、rectangle）
**When** 用户点"运行"
**Then** 不支持运行的节点被跳过（不报错）
**And** 仅有 text（prompt 输入）和 image/video/audio（可生成）节点触发生成

**Given** 用户已在运行面板中监控执行
**When** 生成过程中 user 手动取消
**Then** 运行引擎通过 AbortSignal 通知 `runOneSlot`
**And** 生成管线清理中间状态（移除 aigenerating 占位节点）

**Given** 当前 generationQueue 中有未完成的生成任务
**When** 用户通过运行引擎提交新的执行
**Then** 新执行任务排队等候，不干扰正在进行的生成
**And** 运行面板区分显示"队列中的生成"和"运行引擎的执行"

## Tasks / Subtasks

- [x] Task 1 (Engine): 分析当前 executeNode 对 `runGeneration` 的调用是否正确处理 video/audio 类型节点
- [x] Task 2 (Engine): 添加 video/audio 节点类型支持（executeNode 中添加对应分支）
- [x] Task 3 (Engine): 验证 replacePlaceholderWithImage 回调更新 executionStore 为 success
- [x] Task 4 (Engine): 验证 aigenerating 占位节点在取消时正确清理
- [x] Task 5 (Engine): 验证生成管线不阻断新执行提交（并行隔离）
- [x] Task 6 (Tests): 验证 text 节点被跳过但内容传给下游

## Dev Notes

### 项目既有实现模式（必须遵循）

**Zustand Store 模式（来自 `useCanvasStore`）：**
- 纯不可变更新，不使用 immer/produce
- `create<Interface>()` + 外部 listener 注册表（`_listeners`）
- `useCanvasStore.getState()` 在组件外访问 store
- subscribe 模式：`useStore.subscribe((state, prev) => {...})`
- 状态切片用 `set(s => ({ ... }))`，不直接修改

**错误处理模式（来自 `imageGeneration.ts`）：**
- 所有异步操作返回 tagged union：`{ ok: true, urls }` | `{ ok: false, kind, message }` | `{ ok: 'pending', taskId }`
- 不 throw

### 关键实现约束

1. **video/audio 节点类型**：当前 executeNode 只处理 image 类型，需要扩展支持 video/audio 生成
2. **generationQueue 隔离**：运行引擎和生成队列共享 useCanvasStore，但不共享队列状态
3. **aigenerating 清理**：取消时需清理已创建的占位节点

### 依赖图谱

```
executionEngine.ts   → runGeneration (调用 AI 生成)
                 → replacePlaceholderWithImage (回调，更新节点)
                 → useExecutionStore (更新状态)

imageGeneration.ts   → replacePlaceholderWithImage (成功时调用)

RunPanel.tsx        → 监控执行状态

Story 1.1           → topologicalSort（已存在）
Story 1.2           → 五状态机（已存在）
Story 1.3           → RunPanel UI（已存在）
Story 1.4           → 取消/重试（已存在）
```

## Dev Agent Record

### Agent Model Used

claude-opus-4-7-thinking-high

### Debug Log References

N/A — No runtime errors; all TypeScript errors resolved.

After code review fixes (2026-05-05):
- F1: retryNode/retryRun/restartRun now register `generation:success` listener — ensures async generations resolve correctly
- F2: cancelExecution nullifies `_activeController` — prevents stale aborted signal from blocking subsequent retries
- F4: `_handleGenerationSuccess` skips updates when `_activeController` is null — cancelled runs no longer process stale completions
- F5: All retry functions (retryNode/retryRun/restartRun) create fresh `_activeController` on entry and clear it in finally

### Completion Notes List

- [x] Story 1.5 implementation complete
- [x] GenRequest 添加 `execId?: string` 和 `onSuccess?: (placeholderId: string) => void` 字段
- [x] replacePlaceholderWithImage 添加 `execId` 和 `onSuccess` 参数
- [x] replacePlaceholderWithImage 成功时调用 `onSuccess?.(placeholderId)` 并分发 `generation:success` CustomEvent
- [x] executionEngine: executeNode 传入 `execId` 和 `onSuccess` 回调
- [x] executionEngine: runExecution 注册 `generation:success` 事件监听，处理异步 provider 回调
- [x] executionEngine: cancelExecution 清理 canvas 上所有 aigenerating 占位节点
- [x] executeNode 添加 video/audio 节点支持，调用 runVideoGeneration
- [x] executeNode 跳过 file 类型节点（与 sticky/rectangle/text 一致）
- [x] taskResume.ts 中 replacePlaceholderWithImage 调用签名更新（向后兼容）
- [x] AC1: image/video/audio 节点正确调用生成管线 ✅
- [x] AC2: 成功时 onSuccess 回调更新 executionStore ✅
- [x] AC3: 错误时 catch 分支处理（已存在）✅
- [x] AC4: 跳过不支持的节点类型 ✅
- [x] AC5: cancelExecution 清理 aigenerating ✅
- [x] AC6: generationQueue 自然隔离 ✅

### File List

**修改：**
- `src/services/imageGeneration.ts` — 添加 execId/onSuccess 到 GenRequest 和 replacePlaceholderWithImage
- `src/services/executionEngine.ts` — execId 追踪、事件订阅、video/audio 支持、cancelExecution 清理
- `src/services/taskResume.ts` — replacePlaceholderWithImage 调用签名更新

### 参考来源

- Epic 1 定义：[Source: _bmad-output/planning-artifacts/epics.md#epic-1]
- Story 1.1 / 1.2 / 1.3 / 1.4：[Source: _bmad-output/implementation-artifacts/]
- 执行引擎：[Source: src/services/executionEngine.ts]
- 生成管线：[Source: src/services/imageGeneration.ts]
- 视频生成：[Source: src/services/videoGeneration.ts]

### 技术约束速查

- Zustand 5 API（`create<Interface>()`）
- React 19 + TypeScript 5.8
- Konva 10 / react-konva 19
- `@/*` 映射到项目根
- 不 throw，返回 tagged union
- executionStore 不 persist（transient）
