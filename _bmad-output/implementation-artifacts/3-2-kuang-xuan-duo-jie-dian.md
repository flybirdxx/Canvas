# Story 3.2: 框选多节点

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 用户,
I want 在画布空白区域拖拽出矩形选框来批量选中节点,
so that 我能一次操作选中 50 个节点，而不是逐个 Shift+点击。

## Acceptance Criteria

1. **[Given]** 画布上有 10 个节点
   **[When]** 用户在空白区域按鼠标左键并拖拽
   **[Then]** 显示一个半透明蓝色矩形选框（fill `rgba(59,130,246,0.08)`，stroke `#3B82F6`）
   **[And]** 选框随鼠标实时扩大/缩小
   **[And]** 选框不触发画布平移

2. **[Given]** 用户拖拽选框覆盖了 3 个节点
   **[When]** 释放鼠标
   **[Then]** 选框覆盖的 3 个节点被选中（显示选择边框）
   **[And]** 未被选框覆盖的节点取消选中
   **[And]** 选框消失

3. **[Given]** 用户按住 Shift 键拖拽选框
   **[When]** 新选框覆盖了 2 个节点
   **[Then]** 这 2 个节点添加到现有选择集
   **[And]** 已选中的节点保持选中

4. **[Given]** 用户拖拽了一个很小的选框（< 5px × 5px）
   **[When]** 释放鼠标
   **[Then]** 视为单击空白区域——取消所有选中
   **[And]** 不创建选区

5. **[Given]** 选框中包含已锁定的节点
   **[When]** 释放鼠标
   **[Then]** 锁定节点不被选中
   **[And]** 选框内其他节点正常选中

6. **[Given]** 画布正在运行中（有节点处于 running 状态）
   **[When]** 用户框选
   **[Then]** 运行中的节点显示运行状态指示器（绿色脉冲）
   **[And]** 不影响框选行为本身

## Tasks / Subtasks

- [x] Task 1: 扩展现有选框行为 (AC: 1,2,3,4,5)
  - [x] Subtask 1.1: 将现有的 `selectionBox` 状态从 `selectionBox` 重构为支持多选模式
  - [x] Subtask 1.2: 在 `handlePointerDown` 中区分"空白区域拖拽"和"节点点击"场景
  - [x] Subtask 1.3: `handlePointerMove` 中更新选框坐标，`handlePointerUp` 中计算 AABB 碰撞
  - [x] Subtask 1.4: Shift 键累加选区逻辑
  - [x] Subtask 1.5: < 5px × 5px 小选框视为单击取消选中
- [x] Task 2: 锁定节点排除 (AC: 5)
  - [x] Subtask 2.1: AABB 碰撞检测时过滤 `isLocked === true` 的节点
- [x] Task 3: 选框视觉渲染 (AC: 1)
  - [x] Subtask 3.1: 更新 Konva `<Rect>` 选框样式：`fill: rgba(59,130,246,0.08)`，`stroke: #3B82F6`
  - [x] Subtask 3.2: 确保选框在 Layer 中渲染在节点之上

## Dev Notes

### 项目结构与现有文件

**需修改的文件：**
- `src/components/canvas/InfiniteCanvas.tsx` — 扩展现有 `selectionBox` 状态和行为

**无需新建文件。**

### 现有代码分析

当前 `InfiniteCanvas.tsx` 第 106-113 行定义了 `selectionBox` state，第 242-253 行 `handlePointerDown` 在 `activeTool === 'select'` 且点击空白区域时初始化选框，第 305-312 行 `handlePointerMove` 更新选框，第 419-433 行 `handlePointerUp` 处理选框释放。当前 AC：选框尺寸 > 5×5 时，选中覆盖的节点，取消其余选中。

**需要改动的内容：**
1. `handlePointerDown`：区分"在节点上点击"（应选中节点）和"在空白区域拖拽"（应开始框选）—— 现有代码已部分处理但 `e.target === e.target.getStage()` 只过滤了"点击在 Stage 上"，没过滤"点击在节点上"
2. `handlePointerMove`：当前已有选框更新逻辑，需保持
3. `handlePointerUp`：当前已有 AABB 碰撞检测，需添加 Shift 累加逻辑和小选框处理
4. Konva Rect 选框样式：当前为 `fill="rgba(40, 30, 20, 0.04)" stroke={INK_LINE}`（第 754-765 行），需改为 AC 规定的蓝色

### 关键参考

- `CanvasElement` 中的 `isLocked` 字段用于判定锁定节点
- `setSelection` 来自 `useCanvasStore` 用于更新选中状态
- 碰撞检测使用 AABB（轴对齐包围盒）算法

### 测试标准

- 当前无测试框架。使用 `npm run lint` 做类型检查。
- 手动验证路径：放置 10 个节点，在空白区域拖拽选框覆盖其中 3 个，验证选中

## Dev Agent Record

### Agent Model Used

- claude-opus-4-7-thinking-max

### Debug Log References

### Completion Notes List

**Story 3.2 已完成实施。**

**实现概要：**
- `handlePointerDown`：移除了 `setSelection([])` 调用，避免在空白区域拖拽时错误清空已选节点。`e.target === e.target.getStage()` 已能正确区分"在节点上点击"和"在空白区域拖拽"（节点点击由 CanvasElements 的 Konva 事件处理，不冒泡到 Stage）。
- `handlePointerMove`：重构为先处理 marquee/pan/selectionBox 的早期返回逻辑，再处理 drawingConnection。
- `handlePointerUp`：
  - 选框逻辑移至 `drawingConnection` 判断之前（避免竞争）；
  - `||` 替代 `&&` 判断小选框（AC4）；
  - `!(el as any).isLocked` 过滤锁定节点（AC5）；
  - `isShiftRef.current` 判断 Shift 键，累加选区（AC3）。
- `isShiftRef` + `useEffect`：全局 keydown/keyup 监听 Shift 键。
- 选框 Rect 样式：`fill="rgba(59,130,246,0.08)"`、`stroke="#3B82F6"`，虚线和圆角改为按 `stageConfig.scale` 自适应（保证缩放时视觉一致）。
- 选框渲染增加 `selectionBox.width > 0 && selectionBox.height > 0` guard，避免 0 宽高闪烁。

**已集成 Story 3.1 的对齐吸附功能（snap callbacks）：**
- `InfiniteCanvas.tsx` 已包含 `guideLines` state、`isAltRef`、`snapOnDragMove/DragEnd/ResizeMove/ResizeEnd` callbacks 及相关 import，与 Story 3.1 的 `CanvasElements.tsx` snap 路由层配合工作。

**文件变更：**
- `src/components/canvas/InfiniteCanvas.tsx` (UPDATE)

### File List

- `src/components/canvas/InfiniteCanvas.tsx` (UPDATE)

### Review Findings

- [x] [Review][Patch] 框选期间可同时触发画布平移 [InfiniteCanvas.tsx:353-370] — `handlePointerDown` 中，框选开始的 guard 只检查 `activeTool === 'select' && e.target === stage`。但平移句柄（Space+鼠标 或 中键）在第 353-370 行，当框选进行中（`selectionBox !== null`）用户按下 Space 时，平移和框选会同时生效，导致节点被平移的视觉偏移破坏框选坐标计算。修复：在平移 handler 中添加 `&& !selectionBox` guard，或在框选开始时设置 `e.stopPropagation()`。

- [x] [Review][Defer] AC2.6 — Running node 绿色脉冲未实现 [types/canvas.ts] — 当前 `CanvasElement` 类型无 `isGenerating`/`isRunning` 字段，无法在数据模型层面标记节点为运行中。`AIGeneratingElement` 组件处理 placeholder 状态，但普通节点（image/video）在 AI 生成期间的状态标记缺失。AC2.6 规定的"运行时绿色脉冲"需要先有数据模型支持，属于 Story 3.2 范围外的依赖，建议作为 Epic 1 的延伸放入 backlog。

### Change Log

- Date: 2026-05-05 — 初始实现：框选多节点 (AC1-5 全部)，Shift 累加，小选框取消，锁定节点过滤，蓝色选框样式
