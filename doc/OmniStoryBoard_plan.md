# OmniStoryboard 联动功能方案

当前项目中，画布上的分镜节点（SceneNode）与分镜视图（StoryboardView）处于孤立状态。本方案旨在建立两者之间的深度联动，打造一个成熟、一体化的创作流。

## 用户评审要求

> [!IMPORTANT]
> 本方案建议将分镜视图的「局部选中状态」与画布的「全局选中状态」合并，这将改变现有的交互行为。
> 同时，建议将双击分镜节点的行为由「原位简易编辑」改为「唤起高级分镜面板」。

## 方案核心目标

1. **选中状态同步**：画布选中分镜节点时，分镜视图自动高亮并打开详情。
2. **双向导航**：在画布和分镜视图之间实现一键跳转和定位。
3. **编辑体验统一**：将分镜视图中更强大的「结构化剧本编辑器」引入画布，取代简易文本框。
4. **显式素材关联**：超越现有的 300px 邻近启发式算法，允许用户显式建立分镜与图片的关联。

---

## 拟定变更

### 1. 选中状态与数据层同步
- **[MODIFY] [useCanvasStore.ts](file:///d:/Programs/Board/Canvas/src/store/useCanvasStore.ts)**:
    - 确保 `selectedIds` 能够驱动分镜视图的详情展示。
- **[MODIFY] [StoryboardView.tsx](file:///d:/Programs/Board/Canvas/src/components/StoryboardView.tsx)**:
    - 移除本地 `selectedId` 状态，改为从 store 读取 `selectedIds`。
    - 如果 `selectedIds` 包含且仅包含一个 `scene` 类型的 ID，则自动打开 `DetailPanel`。

### 2. 画布与分镜视图的双向跳转 (Jump-to-Context)
- **[MODIFY] [SceneNode.tsx](file:///d:/Programs/Board/Canvas/src/components/canvas/nodes/SceneNode.tsx)**:
    - 在预览模式下增加一个「分镜视图」图标按钮。点击后：
        1. 执行 `setViewMode('storyboard')`。
        2. 自动滚动/定位到分镜视图中的对应卡片。
- **[MODIFY] [StoryboardView.tsx](file:///d:/Programs/Board/Canvas/src/components/StoryboardView.tsx)**:
    - 在分镜卡片（SceneCard）上增加「在画布中查看」图标。点击后：
        1. 执行 `setViewMode('canvas')`。
        2. 调用画布的 `centerOnNode(id)` 功能（如果已实现）或手动调整 `stageConfig` 以定位到该节点。

### 3. 统一高级编辑体验
- **[NEW] [SceneDetailOverlay.tsx](file:///d:/Programs/Board/Canvas/src/components/canvas/SceneDetailOverlay.tsx)**:
    - 提取 `StoryboardView` 中的 `DetailPanel` 逻辑，封装成一个可重用的浮动面板。
    - 当用户在画布双击 `SceneNode` 或点击编辑按钮时，不再进入原位的 Html 文本框，而是弹出此高级面板。
- **[DELETE] [SceneNode.tsx 中的 editing 模式]**: 移除老旧的原位编辑逻辑，保持 UI 纯净。

### 4. 显式素材关联功能
- **[MODIFY] [types/canvas.ts](file:///d:/Programs/Board/Canvas/src/types/canvas.ts)**:
    - 在 `SceneElement` 中增加 `linkedImageId?: string` 字段。
- **[MODIFY] [StoryboardView.tsx](file:///d:/Programs/Board/Canvas/src/components/StoryboardView.tsx)**:
    - 支持将画布上的图片节点（或素材库图片）拖拽到分镜卡片上，从而建立永久关联。
    - `findThumbnailForScene` 优先使用 `linkedImageId`，其次才是邻近搜索。

---

## 验证计划

### 自动化测试
- 编写 unit test 验证选中 SceneNode 后 store 的 `selectedIds` 正确更新。
- 验证 `StoryboardView` 是否在 store 变化时正确响应详情展开。

### 手动验证
- **场景一**：在画布上双击一个分镜，观察是否弹出了结构化编辑器。
- **场景二**：在分镜视图点击「在画布中查看」，观察是否成功切换并定位到该节点。
- **场景三**：在画布移动分镜位置，观察分镜视图中的缩略图（若基于邻近搜索）是否随之更新。
