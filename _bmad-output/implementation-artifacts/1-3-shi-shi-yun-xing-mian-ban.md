---
story_id: 1.3
epic_num: 1
story_num: 3
story_key: 1-3-shi-shi-yun-xing-mian-ban
story_title: 实时运行面板
status: review
---

## Story

作为用户，
我希望一个实时运行面板显示所有执行中节点的进度、日志和耗时，
以便我不需要猜测后台发生了什么，能随时掌握运行状态。

## Acceptance Criteria

**Given** 有一个正在进行的执行任务
**When** 用户打开运行面板
**Then** 面板显示执行概览：总节点数、已完成数、运行中数、失败数、总耗时（秒级实时更新）
**And** 每个节点一行：节点名称、当前状态图标（⏳queued / 🔄running / ✅success / ❌failed）、该节点耗时

**Given** 节点 A 正在执行
**When** AI 生成过程中产生日志
**Then** 运行面板的日志区域实时追加日志条目
**And** 每条日志包含时间戳、日志级别（info/warn/error）、节点标识、消息内容
**And** 日志区域自动滚动到最新条目

**Given** 运行面板已显示 500+ 条日志
**When** 新日志继续产生
**Then** 面板渲染不卡顿（上限截断旧日志至 200 条）
**And** 用户可手动清空日志

**Given** 没有正在进行的执行任务
**When** 运行面板打开
**Then** 显示空状态："暂无运行任务"
**And** 提示"选中节点后点击运行开始"

**Given** 运行面板当前折叠/关闭
**When** 用户触发一次新的执行
**Then** 运行面板自动展开/打开
**And** 用户焦点不强制转移到面板

**Given** 同时存在 2 个独立的执行（execId-1 和 execId-2）
**When** 用户查看运行面板
**Then** 面板以标签页形式展示两个执行
**And** 各自独立显示进度和日志

## Tasks / Subtasks

- [x] Task 1: 实现 Toast 系统（`Toast.tsx`）
- [x] Task 2: 实现执行日志服务（`executionLogs.ts`）
- [x] Task 3: 完整重构 RunPanel（状态概览 + 节点列表 + 日志区 + 折叠/展开）
- [x] Task 4: 集成 ToastContainer 到 App.tsx
- [x] Task 5: executionEngine 调用 appendLog 和 dispatchToast

## 实现细节

### Toast 系统（`Toast.tsx`）

- `useToastStore`：Zustand store 管理 toasts
- 自动消失：success/info 4s，danger 6s
- `dispatchToast(message, type)` 全局函数供 engine 调用
- 居中底部固定定位，z-index: 9999

### 执行日志服务（`executionLogs.ts`）

- 模块级 `_globalLogs` 数组（与 React 无关）
- `appendLog(execId, level, message, nodeId?)`：追加日志，截断至 200 条
- `subscribeLogs(listener)`：订阅接口，返回取消函数
- `clearLogs()`：清空
- `getAllLogs()`：获取当前全部

### RunPanel 完整 UI

- **折叠态**：显示简洁的徽章（✓成功数 ◉运行中 ✗失败数）
- **展开态**：
  - Header：概览行（节点数、颜色状态标签、实时总耗时）
  - 标签栏：多个运行时分 tab 切换
  - 节点列表：图标 + 名称 + 状态 + 耗时 + 错误信息
  - 日志区：时间戳 + 级别 + 节点 + 消息，自动滚动
  - Footer：当前状态文字
- **自动展开**：新运行开始时自动打开面板
- **多运行**：tabs 切换不同 execId
- **实时时钟**：500ms 刷新总耗时

## Dev Agent Record

### Agent Model Used

claude-opus-4-7-thinking-high

### Debug Log References

N/A — No runtime errors; all TypeScript errors resolved.

After code review fixes (2026-05-05):
- X1: Removed dead no-op block in `showToast` (F6, dismissed)
- Non-image nodes now explicitly return `Promise.resolve()` for consistent async contract

### Completion Notes List

- [x] Story 1.3 implementation complete
- [x] Toast system: dispatchToast, ToastContainer
- [x] Execution log service: appendLog, subscribeLogs, clearLogs
- [x] RunPanel: full UI with summary, node list, log area, collapse/expand
- [x] RunPanel: auto-expand on new run
- [x] RunPanel: multi-run tabs
- [x] RunPanel: real-time elapsed timer (500ms)
- [x] RunPanel: auto-scroll logs
- [x] RunPanel: log cap at 200 entries
- [x] ToastContainer added to App.tsx
- [x] executionEngine integrated with appendLog + dispatchToast

### File List

**新建：**
- `src/components/Toast.tsx` — Toast 系统（store + component）
- `src/services/executionLogs.ts` — 执行日志服务（模块级状态）

**修改：**
- `src/components/RunPanel.tsx` — 完整重构，完整 UI
- `src/services/executionEngine.ts` — 添加 appendLog + dispatchToast 调用
- `src/App.tsx` — 添加 ToastContainer

### 参考来源

- Epic 1：[Source: _bmad-output/planning-artifacts/epics.md#epic-1]
- Story 1.1 / 1.2：[Source: _bmad-output/implementation-artifacts/]
- RunPanel 基础（Story 1.1 占位实现）：[Source: src/components/RunPanel.tsx]
