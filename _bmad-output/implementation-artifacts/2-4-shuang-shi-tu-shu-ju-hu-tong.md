# Story 2.4: 双视图数据互通

Status: review

## Story

作为用户，
我希望在画布上对 scene 节点的任何修改自动反映到分镜视图，反之亦然，
以便两个视图始终展示同一份数据，我不需要手动同步。

## Acceptance Criteria

### AC1 — 画布 → 分镜：scene 节点编辑

**Given** 用户在画布视图中选中了 scene 节点
**When** 在属性面板中修改 title 或 content
**Then** `useCanvasStore` 中对应 scene 节点数据更新
**And** 切换到分镜视图时，scene 卡片显示新标题/内容

**Given** 用户在画布视图中删除了 scene 节点
**When** 切换到分镜视图
**Then** 分镜网格中该 scene 卡片消失

### AC2 — 分镜 → 画布：scene 节点编辑

**Given** 用户在分镜视图中点击了 scene 卡片
**When** 详情面板显示完整 content
**Then** 可编辑 content 和 title 字段（内联编辑）
**And** 保存后 `useCanvasStore` 更新，画布视图 scene 节点同步更新

### AC3 — 分镜 → 画布：scene 节点删除

**Given** 用户在分镜视图中选中 scene 卡片
**When** 点击删除按钮并确认
**Then** `useCanvasStore.deleteElements` 删除该 scene 节点
**And** 分镜网格中卡片消失
**And** undo 栈记录为"删除分镜"

### AC4 — 关联缩略图显示

**Given** scene 4 关联了 image 子节点（位置接近）
**When** 分镜视图渲染 scene 4 卡片
**Then** 卡片顶部显示该 image 节点的缩略图
**And** `object-fit: cover` 不拉伸变形

### AC5 — 分组标记

**Given** scene 节点属于某个 group
**When** 分镜视图渲染该 scene 卡片
**Then** 卡片显示分组角标（颜色标签）
**And** 分组信息不影响网格排序

## Tasks / Subtasks

### Task 1 (AC: 1) — PropertiesPanel scene 节点编辑

- [x] Subtask 1.1: `PropertiesPanel.tsx` 检测 `el.type === 'scene'` 时显示 title 和 content 编辑字段
- [x] Subtask 1.2: title/content 修改调用 `updateElement(id, { title/content })`
- [x] Subtask 1.3: scene 节点也显示删除按钮（已有）

### Task 2 (AC: 2) — StoryboardView 详情面板内联编辑

- [x] Subtask 2.1: `DetailPanel` 增加 title 和 content 的 textarea/input 编辑框
- [x] Subtask 2.2: 编辑后调用 `useCanvasStore.updateElement` 保存
- [x] Subtask 2.3: 编辑保存后自动关闭详情面板

### Task 3 (AC: 3) — StoryboardView 删除 scene

- [x] Subtask 3.1: `DetailPanel` 添加"删除此分镜"按钮
- [x] Subtask 3.2: 点击后弹出确认提示（避免误删）
- [x] Subtask 3.3: 确认后调用 `deleteElements([scene.id])`，关闭面板

### Task 4 (AC: 4) — 关联缩略图

- [x] Subtask 4.1: 在 `StoryboardView` 中扫描 `elements`，找位置与 scene 接近的 image 节点
- [x] Subtask 4.2: 接近判断：image 节点 x 落在 scene 右侧 0-200px 且 y 在 scene 下 0-250px
- [x] Subtask 4.3: `SceneCard` 顶部渲染 `<img>` 缩略图，`object-fit: cover`

### Task 5 (AC: 5) — 分组标记

- [x] Subtask 5.1: scene 卡片预留分组角标 UI（颜色圆点，groupColor prop）
- [x] Subtask 5.2: 分组数据结构待 Story 3.3 实现；角标显示逻辑已预置，传入 `groupColor` 即可渲染

## 实现细节

### 数据流

```
画布 PropertiesPanel (scene 编辑)
  → useCanvasStore.updateElement()
  → StoryboardView 自动重新渲染（Zustand 响应式）

分镜 DetailPanel (scene 编辑/删除)
  → useCanvasStore.updateElement() / deleteElements()
  → CanvasElements 自动重新渲染（Zustand 响应式）

缩略图检测（proximity heuristic）：
  scene 节点 → 找右侧/下方最近的 image 节点 → 显示缩略图
```

### PropertiesPanel scene 编辑字段

```typescript
// 在 PropertiesPanel.tsx 中，当 el.type === 'scene' 时显示：
{el.type === 'scene' && (
  <>
    <div className="hairline-b" style={{ padding: '10px 14px' }}>
      <label className="field-label">场次标题</label>
      <input value={el.title} onChange={e => updateElement(el.id, { title: e.target.value })} />
    </div>
    <div style={{ padding: '10px 14px' }}>
      <label className="field-label">内容</label>
      <textarea value={el.content} onChange={e => updateElement(el.id, { content: e.target.value })} />
    </div>
  </>
)}
```

### 缩略图 proximity 算法

```
for each scene:
  nearbyImages = elements.filter(el =>
    el.type === 'image' &&
    Math.abs(el.x - scene.x) < 150 &&  // 水平接近
    el.y > scene.y &&                    // 在 scene 下方
    el.y - scene.y < 150               // 但不太远
  )
  if nearbyImages.length > 0:
    thumb = nearest(nearbyImages, by y)
```

### StoryboardView DetailPanel 删除流程

```
删除按钮 → setConfirmDelete(true) → 显示确认弹窗
  → 确认：deleteElements([scene.id]) + onClose()
  → 取消：setConfirmDelete(false)
```

## Dev Notes

### 项目既有实现模式（必须遵循）

**PropertiesPanel 模式（来自 `PropertiesPanel.tsx`）：**
- `updateElement(id, { ... })` 更新字段
- `deleteElements([id])` 删除
- 字段使用 `.input-paper` CSS 类

**StoryboardView 模式（来自 `StoryboardView.tsx`）：**
- `useCanvasStore.updateElement` 更新
- `useCanvasStore.deleteElements` 删除
- DetailPanel 底部滑出动画

**缩略图检测策略：**
- 使用 proximity heuristic（无显式关联字段时）
- story 2.4 后，任何显式关联设计都应该基于 scene 与 image 节点的 proximity

### 关键实现约束

1. **undo 通过 canvasStore 自动处理**：`updateElement` 和 `deleteElements` 已有 undo 记录
2. **双视图同步**：两个视图共享同一 Zustand store，天然互通
3. **缩略图 heuristic**：无显式关联字段时用 proximity，后续可被 Story 2.4 后的显式关联替代

## Dev Agent Record

### Agent Model Used

claude-opus-4-7-thinking-max

### Debug Log

N/A

### Completion Notes

- [x] All 5 tasks completed. TypeScript type check passes (only pre-existing `jspdf` error).
- [x] PropertiesPanel新增 scene 类型专属编辑区（title/content/sceneNum）
- [x] StoryboardView DetailPanel 支持内联编辑、删除（含二次确认）、缩略图、预置分组角标
- [x] 双视图通过 Zustand store 天然互通，无需额外同步逻辑
- [x] undo 通过 canvasStore 自动处理（`deleteElements` 有 `past.push(snapshot)`）

### File List

**修改：**
- `src/components/properties/PropertiesPanel.tsx` — scene 节点 title/content 编辑
- `src/components/StoryboardView.tsx` — DetailPanel 编辑/删除、缩略图、分组角标

### Change Log

- 2026-05-05: Story 2-4 implementation.

### Review Findings

- [ ] [Review][Patch] CRITICAL：viewMode 未加入 persist version，刷新后 viewMode === undefined，导致画布完全不可见 [useCanvasStore.ts]
