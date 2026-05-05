# Story 2.2: 画布/分镜视图切换

Status: review

## Story

作为用户，
我希望在 TopBar 一键切换画布视图和分镜视图，
以便两种工作模式之间无缝切换，不被工具打断创作流。

## Acceptance Criteria

### AC1 — 视图状态管理

**Given** 用户当前在画布视图
**When** 点击 TopBar 中的"分镜模式"按钮（或使用快捷键）
**Then** `useCanvasStore.viewMode` 从 `'canvas'` 切换为 `'storyboard'`
**And** 画布淡出，分镜视图淡入（过渡动画 ≤ 300ms）

**Given** 用户当前在分镜视图
**When** 点击 TopBar 中的"画布模式"按钮
**Then** `viewMode` 切换回 `'canvas'`
**And** 画布淡入，分镜视图淡出

**Given** 用户上次关闭页面时在分镜视图
**When** 重新打开页面
**Then** `viewMode` 从 persist 恢复，直接显示分镜视图

**Given** 视图切换按钮在 TopBar 中
**When** 渲染
**Then** 当前选中模式高亮指示
**And** 键盘快捷键提示显示在 tooltip 中

### AC2 — 空状态引导

**Given** 当前没有剧本节点和 scene 节点
**When** 用户切换到分镜视图
**Then** 显示引导提示："画布上没有剧本节点。创建剧本节点并粘贴 Markdown 剧本开始。"
**And** 提供"创建剧本节点"快捷按钮

## Tasks / Subtasks

### Task 1 (AC: 1) — viewMode 状态与动作

- [x] Subtask 1.1: 在 `src/store/useCanvasStore.ts` 的 `CanvasState` 接口添加 `viewMode: 'canvas' | 'storyboard'`
- [x] Subtask 1.2: 添加 `setViewMode` action 到 store
- [x] Subtask 1.3: store 初始值 `viewMode: 'canvas'`，persist 存储 `viewMode` 字段
- [x] Subtask 1.4: 键盘快捷键 `Ctrl+Shift+V` 在画布/分镜视图间切换

### Task 2 (AC: 1, 2) — TopBar + App.tsx 视图切换

- [x] Subtask 2.1: 在 `src/components/chrome/TopBar.tsx` 添加视图切换按钮组（画布/分镜）
- [x] Subtask 2.2: 按钮显示当前视图模式，高亮选中项
- [x] Subtask 2.3: `App.tsx` 中根据 `viewMode` 条件渲染 `InfiniteCanvas` 或 `StoryboardView`
- [x] Subtask 2.4: 过渡动画（淡入淡出 ≤ 300ms）

### Task 3 (AC: 2) — StoryboardView 组件

- [x] Subtask 3.1: 创建 `src/components/StoryboardView.tsx` — 纯 DOM 组件（非 Konva）
- [x] Subtask 3.2: 从 `useCanvasStore` 读取 scene 节点列表
- [x] Subtask 3.3: scene 数量为 0 时显示空状态引导（"创建剧本节点"按钮）
- [x] Subtask 3.4: scene 数量 > 0 时显示 CSS Grid 卡片列表

## 实现细节

### 类型定义

```typescript
// src/store/useCanvasStore.ts
type ViewMode = 'canvas' | 'storyboard';
```

### 数据流

```
TopBar (viewMode buttons)
  → useCanvasStore.setViewMode()
  → App.tsx reads viewMode
  → conditionally renders <InfiniteCanvas /> or <StoryboardView />
```

### 架构决策（来自 architecture.md AD2）

- `StoryboardView` 与 `InfiniteCanvas` 同级组件
- 纯 DOM 渲染（非 Konva），用 `chip-paper` CSS 类
- 读 `useCanvasStore` 获取 scene 节点
- `viewMode` 在 canvasStore（persist）—— 刷新后恢复视图状态

### 视图切换按钮 UI

- 两个按钮："画布" / "分镜"（使用 LayoutGrid / LayoutPanel 图标）
- 当前选中模式高亮（accent 背景色）
- 非选中模式显示为 ghost 样式

### 过渡动画

- 使用 CSS transition 或 Framer Motion
- canvas → storyboard：canvas opacity 1→0, storyboard opacity 0→1（≤ 300ms）
- 使用 `will-change: opacity` 优化性能

### 键盘快捷键

- `Ctrl+Shift+V`：切换视图模式（`viewMode === 'canvas' ? 'storyboard' : 'canvas'`）

## Dev Notes

### 项目既有实现模式（必须遵循）

**视图切换模式：**
- viewMode 在 canvasStore（persist），刷新后恢复
- StoryboardView 用 DOM 不是 Konva（关键约束，见 architecture.md conflict prevention）
- TopBar 按钮使用 lucide-react 图标

**CSS 动画模式（来自 Atmosphere.tsx）：**
- `will-change: opacity` 用于性能优化
- `transition: opacity 250ms ease-out`（≤ 300ms）

**Zustand Store 模式（来自 useCanvasStore.ts）：**
- 纯不可变更新
- 新字段追加到 `CanvasState` 接口
- persist 存储所有需要恢复的字段

### 关键实现约束

1. **StoryboardView 用 DOM 不是 Konva**（来自 architecture.md conflict prevention #2）
2. **viewMode 在 canvasStore（persist）**（来自 architecture.md conflict prevention #3）
3. **过渡动画 ≤ 300ms**（来自 AC）
4. **空状态引导**（来自 AC2）

### 依赖图谱

```
useCanvasStore.viewMode    → StoryboardView (read)
                      → App.tsx (conditional render)
                      → TopBar (highlight active button)

TopBar                  → onToggleViewMode callback
App.tsx                → <InfiniteCanvas /> or <StoryboardView />
StoryboardView.tsx     → useCanvasStore (read scene nodes)
```

### 既有代码复用

| 既有文件 | 复用方式 |
|---------|---------|
| `src/store/useCanvasStore.ts` | 添加 viewMode 字段和 setViewMode action |
| `src/components/chrome/TopBar.tsx` | 添加视图切换按钮组 |
| `src/App.tsx` | 条件渲染 InfiniteCanvas / StoryboardView |
| `src/components/chrome/ToolDock.tsx` | 参考 ToolDock 按钮样式 |

### 技术约束速查

- Zustand 5 API（`create<Interface>()`）
- React 19 + TypeScript 5.8
- `Html` from `react-konva-utils`（不是 Konva 内置）
- 不 throw，解析失败返回空数组
- 过渡动画 ≤ 300ms

## Dev Agent Record

### Agent Model Used

claude-opus-4-7-thinking-max

### Debug Log

**TS2448 修复**：`handleCreateNode` 使用前声明。`useCallback` hook 必须在 `useEffect` 前声明，否则 TypeScript 报错"Block-scoped variable used before its declaration"。

### Completion Notes

- [x] Story 2-2 implementation complete
- [x] `viewMode: 'canvas' | 'storyboard'` 添加到 `CanvasState` 接口
- [x] `setViewMode` action 添加并 persist
- [x] TopBar 添加视图切换按钮组（LayoutGrid / LayoutPanelLeft 图标）
- [x] `App.tsx` 条件渲染 InfiniteCanvas / StoryboardView（lazy）
- [x] CSS transition 过渡动画 250ms ease-out（≤ 300ms）
- [x] `Ctrl+Shift+V` 键盘快捷键切换视图
- [x] `StoryboardView` 纯 DOM 组件（空状态 + CSS Grid 卡片）
- [x] AC1: 视图切换 ✅, AC2: 空状态引导 ✅

### File List

**新建：**
- `src/components/StoryboardView.tsx` — 分镜卡片网格组件

**修改：**
- `src/store/useCanvasStore.ts` — 添加 viewMode 字段和 setViewMode action
- `src/components/chrome/TopBar.tsx` — 添加视图切换按钮
- `src/App.tsx` — 条件渲染 + 键盘快捷键

### Change Log

- 2026-05-05: Story 2-2 implementation.

### Review Findings

- [ ] [Review][Patch] handleCreateNode 依赖数组包含自身 handleCreateNode，潜在 ESLint 警告和闭包陷阱 [App.tsx:handleCreateNode]
- [ ] [Review][Patch] 分镜视图滚动位置在视图切换时保留（两个视图始终挂载，opacity 切换），体验可能与用户预期不符 [App.tsx]
