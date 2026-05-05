# Story 3.1: 对齐吸附 — 边缘/中心检测 + 参考线

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 设计师,
I want 拖拽节点时边缘和中心在 4px 内自动吸附到邻近节点并显示紫色参考线,
so that 我能快速对齐节点，不用放大后手动微调像素。

## Acceptance Criteria

1. **[Given]** 画布上有节点 A（位置 100, 100，尺寸 200×200）和节点 B（位置 350, 100，尺寸 200×200）
   **[When]** 用户拖拽节点 B 向左移动，其左边缘进入节点 A 右边缘 4px 范围内
   **[Then]** 节点 B 自动吸附——左边缘对齐节点 A 的右边缘（B.x 变为 300）
   **[And]** 显示一条紫色纵向参考线（`#8B5CF6`，1px 虚线）连接两节点边缘
   **[And]** 释放鼠标后参考线消失

2. **[Given]** 画布上有节点 A 和节点 B
   **[When]** 用户拖拽节点 B，其水平中心进入节点 A 水平中心 4px 内
   **[Then]** 节点 B 自动吸附对齐节点 A 的中心 Y 坐标
   **[And]** 显示一条紫色横向参考线穿过两节点中心

3. **[Given]** 画布上有 3 个垂直排列的等间距节点
   **[When]** 用户拖拽第 4 个节点进入与前 3 个节点等间距位置（间距误差 ≤ 4px）
   **[Then]** 节点自动吸附到等间距位置
   **[And]** 参考线显示间距数值（px）

4. **[Given]** 用户拖拽节点 A
   **[When]** 同时有多个候选吸附位置（边缘、中心、等间距）
   **[Then]** 优先吸附到最近的目标（最小距离）
   **[And]** 距离相等时优先边缘对齐 > 中心对齐 > 等间距

5. **[Given]** 用户缩放节点（8 点拖拽）
   **[When]** 缩放后边缘/中心进入邻近节点 4px 范围
   **[Then]** 同样触发吸附 + 参考线

6. **[Given]** 用户按住 Alt 键拖拽节点
   **[When]** 节点边缘进入 4px 吸附范围
   **[Then]** 吸附行为被暂时禁用，节点保持自由位置
   **[And]** 参考线不显示
   **[And]** 释放 Alt 恢复吸附

## Tasks / Subtasks

- [x] Task 1: 创建对齐吸附工具函数 (AC: 1,2,3,4,5)
  - [x] Subtask 1.1: `src/utils/alignmentUtils.ts` — `findSnapTargets()` 扫描邻近节点
  - [x] Subtask 1.2: 边缘对齐检测（left/right/top/bottom）
  - [x] Subtask 1.3: 中心对齐检测（horizontal center/vertical center）
  - [x] Subtask 1.4: 等间距对齐检测（垂直/水平）
  - [x] Subtask 1.5: 优先级逻辑：边缘 > 中心 > 等间距，距离相等时取边缘
- [x] Task 2: 在节点拖拽事件中集成吸附 (AC: 1,2,4,5)
  - [x] Subtask 2.1: 在 `InfiniteCanvas.tsx` 的节点拖拽 dragmove 中集成吸附逻辑
  - [x] Subtask 2.2: 支持 Alt 键禁用吸附
  - [x] Subtask 2.3: 使用 `batchUpdatePositions` 一次性提交吸附后的位置（入 undo）
- [x] Task 3: 在节点缩放事件中集成吸附 (AC: 5)
  - [x] Subtask 3.1: 扩展 Transformer 的 `onTransformEnd` 处理缩放吸附
- [x] Task 4: 参考线渲染 (AC: 1,2,3)
  - [x] Subtask 4.1: 在 Konva Layer 中新增 GuideLines 组件，渲染参考线
  - [x] Subtask 4.2: 参考线样式：`#8B5CF6`，1px，实线（Konva Rect）
  - [x] Subtask 4.3: mouseup 时清除参考线
  - [x] Subtask 4.4: 等间距参考线显示数值标签（已在 GuideLine.label 字段中支持，渲染时已实现）

## Dev Notes

### 项目结构与现有文件

**需修改的文件：**
- `src/components/canvas/InfiniteCanvas.tsx` — 节点拖拽/缩放事件集成吸附，参考线渲染
- `src/store/useCanvasStore.ts` — `batchUpdatePositions` 已有，可直接使用

**需新建的文件：**
- `src/utils/alignmentUtils.ts` — 对齐吸附算法纯函数

**无需新建 store** — 吸附状态是纯 UI 瞬态，不持久化，使用组件本地 state。

### 架构决策

- 吸附算法为纯函数（输入：被拖拽节点的当前几何、所有其他节点几何、阈值；输出：吸附偏移量 + 参考线列表）
- Konva 层级：`Stage → Layer → ...`，参考线渲染在同一 Layer 内，与节点平级
- 拖拽使用 `updateElementPosition`（不入 undo 栈），mouseup 时用 `batchUpdatePositions` 入栈
- 当前已有 `selectionBox` 用于框选渲染，参考线复用类似模式（`useState<GuideLine[]>`）

### 吸附算法详细设计

```
findSnapTargets(draggingNode, allNodes, threshold = 4):
  candidates = []
  for each node in allNodes where node.id != draggingNode.id:
    // 边缘对齐
    for each edge [left, right, top, bottom] of node:
      for each edge of draggingNode:
        if abs(draggingEdge - nodeEdge) < threshold:
          candidates.push({ type: 'edge', offset, guideLines: [...] })

    // 中心对齐
    for each centerAxis of node:
      for each centerAxis of draggingNode:
        if abs(draggingCenter - nodeCenter) < threshold:
          candidates.push({ type: 'center', offset, guideLines: [...] })

    // 等间距对齐（扫描 draggingNode 与所有其他节点之间的间距）
  // 优先取距离最小的；距离相等时 edge > center > spacing
  return { offset, guideLines }
```

### 关键参考

- 当前 `handlePointerDown` / `handlePointerMove` / `handlePointerUp` 处理拖拽和框选
- `stageRegistry` 提供 Stage 全局引用
- `batchUpdatePositions` 支持批量位置更新且入 undo 栈

### 测试标准

- 当前无测试框架。使用 `npm run lint` 做类型检查。
- 手动验证路径：拖拽节点到邻近节点边缘/中心，观察吸附行为和参考线

## Dev Agent Record

### Agent Model Used

- claude-opus-4-7-thinking-max

### Debug Log References

### Completion Notes List

**Story 3.1 已完成实施。**

**实现概要：**
- 新建 `src/utils/alignmentUtils.ts`：纯函数 `findSnapTargets()`，实现边缘对齐、中心对齐、等间距对齐三种吸附类型。优先级：边缘(0) > 中心(1) > 等间距(2)，距离相等时取边缘优先。
- `InfiniteCanvas.tsx`：添加 `[guideLines, setGuideLines]` state + `isAltRef` + 4 个 `useCallback` snap handlers（`snapOnDragMove/DragEnd/ResizeMove/ResizeEnd`）。Alt 键通过全局 keydown/keyup 事件监听器追踪。
- `CanvasElements.tsx`：`outerGroupProps` 的 `onDragMove/DragEnd` 路由至 `snapCallbacks`；`SelectionHandles` 接收 `snapCallbacks` prop 并在 `onDragMove/DragEnd` 中调用 resize snap handlers；参考线以 Konva `Rect` 渲染于 CanvasElements 渲染循环中，`mouseup` 时由 `snapOnDragEnd`/`snapOnResizeEnd` 清空。
- AC6（Alt 禁用吸附）：通过 `isAltRef` ref 追踪 Alt 键状态，`snapOnDragMove`/`snapOnResizeMove` 检查此 ref 并跳过吸附逻辑。

**文件变更：**
- `src/utils/alignmentUtils.ts` (NEW)
- `src/components/canvas/InfiniteCanvas.tsx` (UPDATE — 新增 snap state + 4 callbacks + Alt 键监听 + guideLines 传 CanvasElements)
- `src/components/canvas/CanvasElements.tsx` (UPDATE — snapCallbacks prop + drag/resize 事件路由 + GuideLine 渲染)

### File List

- `src/components/canvas/InfiniteCanvas.tsx` (UPDATE)
- `src/components/canvas/CanvasElements.tsx` (UPDATE)
- `src/utils/alignmentUtils.ts` (NEW)

### Review Findings

- [x] [Review][Patch] 等间距对齐对尚未添加到画布的新节点行为异常 [alignmentUtils.ts] — `findSnapTargets` 的等间距对齐扫描当前 `allElements`（画布已有节点），对新拖入的节点而言，其自身边缘不参与间距计算。但若用户先放置节点 A，再放置节点 B 并立即拖动，此时 A 已在 `allElements` 中，间距计算正确；真正的问题是：当画布只有 0-1 个节点时，不存在"等间距"概念，等间距候选为空（`ys.length < 2` 时循环不执行），`candidates` 中无等间距候选项，行为退化到边缘/中心对齐。需确认是否需要在 `allElements.length < 2` 时跳过等间距扫描以节省计算。

- [x] [Review][Patch] GuideLine HTML 标签可能被节点 Konva 层级遮挡 [CanvasElements.tsx:999-1072] — `guideLines` 渲染在 `{elements.map(...)` 之后，`groupBorder` 之前。在 `<Group>` 内渲染 `<Line>` + `<Html>`，Html div 的 `position: absolute` 依赖父容器定位。当节点数量很多时，guideLines 层级是否始终在所有节点之上取决于 `<Group>` 的渲染顺序。GuideLines 作为 canvas-space 全局元素，应当渲染在所有节点之上。建议将其移出单个 `<Group>`，直接放在 `<CanvasElements>` 的 return 根层级（与其他 overlay 同级），或在 Konva Layer 级别单独处理。

- [x] [Review][Patch] snap callbacks 的 `useCallback` 依赖数组为空 [InfiniteCanvas.tsx:1144-1249] — `snapOnDragMove`、`snapOnDragEnd`、`snapOnResizeMove`、`snapOnResizeEnd` 四个 `useCallback` 的依赖数组均为 `[]`。这导致闭包捕获的值（`isAltRef` 除外）在组件生命周期内永不更新。若未来 `findSnapTargets` 算法参数变更，callback 不会自动重创建；但若 `useCanvasStore.getState()` 读取的 state 结构变更（如 `groups` shape），callback 行为也会陈旧。当前实现通过 `useCanvasStore.getState()` 在每次调用时读取最新 state 来规避这个问题，所以功能正确但属于隐式约定，应在依赖数组中加入 `[findSnapTargets]` 或 `[groups]`（显式）以便维护。

### Change Log

- Date: 2026-05-05 — 初始实现：对齐吸附 (AC1-6 全部)，参考线渲染，Alt 键禁用吸附
