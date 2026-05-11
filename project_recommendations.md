# 🧭 AI Canvas 项目建议方案

> 基于对全部 96 个源文件（793 KB）的深度审查，我从**架构健康度**、**性能**、**可维护性**和**产品体验**四个维度提炼出以下建议。

---

## 1. 🔴 高优先级：巨型文件拆解

当前项目中仍有数个"巨型文件"会严重拖慢开发效率和代码可审查性：

| 文件 | 大小 | 核心问题 |
|------|------|----------|
| [NodeInputBar.tsx](file:///d:/Programs/Board/Canvas/src/components/NodeInputBar.tsx) | **70 KB / 1770 行** | 一个组件承担了图像/视频/文本三种模式的全部生成UI逻辑 |
| [useCanvasStore.ts](file:///d:/Programs/Board/Canvas/src/store/useCanvasStore.ts) | **33 KB / 799 行** | 巨型 Zustand store，包含 20+ actions + 持久化 + 历史 |
| [InfiniteCanvas.tsx](file:///d:/Programs/Board/Canvas/src/components/canvas/InfiniteCanvas.tsx) | **28 KB** | 虽然 Phase 2 已瘦身，但 Drop 处理和覆盖层 UI 仍然很重 |
| [StoryboardView.tsx](file:///d:/Programs/Board/Canvas/src/components/StoryboardView.tsx) | **23 KB** | 分镜视图独立组件，但内部逻辑密度很高 |
| [executionEngine.ts](file:///d:/Programs/Board/Canvas/src/services/executionEngine.ts) | **23 KB / 600 行** | 拓扑排序 + 节点执行 + 重试/取消/重启全部混在一起 |

### 建议：NodeInputBar 的拆分策略

这是整个项目中最大的单文件，建议按**生成模式**拆解为：

```
src/components/input-bar/
├── NodeInputBar.tsx          # 薄壳：根据 element.type 分发
├── ImageGenControls.tsx      # 图像生成控件（aspect/quality/references/inpaint）
├── VideoGenControls.tsx      # 视频生成控件（duration/quality/seed）
├── TextGenControls.tsx       # 文本生成控件
├── PromptTextarea.tsx        # 共享的 prompt 输入区 + 预设条
├── ModelSelector.tsx         # 模型下拉 + provider 状态显示
├── ReferenceManager.tsx      # 参考图上传/拖拽/预览
└── utils.ts                  # buildModelOptions, resolveImageSize 等纯函数
```

### 建议：useCanvasStore 的切片方案

当前 store 承载了太多关注点。Zustand 原生支持 `slice pattern`：

```
src/store/
├── useCanvasStore.ts         # 组合入口 (combine slices)
├── slices/
│   ├── elementsSlice.ts      # elements CRUD + batch operations
│   ├── connectionsSlice.ts   # connections + drawingConnection
│   ├── historySlice.ts       # undo/redo + coalescing
│   ├── selectionSlice.ts     # selectedIds + groups
│   ├── viewSlice.ts          # stageConfig + activeTool + viewMode
│   └── persistMiddleware.ts  # throttled localStorage adapter
```

---

## 2. 🟡 中优先级：架构改进

### 2.1 消除 `as any` 类型断言

当前代码中大量使用 `as any` 来绕过 TypeScript 类型系统，这削弱了类型安全的价值：

```typescript
// 当前 — 随处可见：
addElement({ id, type: 'scene', ...props } as any);
updateElement(element.id, { prompt: v } as any);
```

**根因**：`CanvasElement` 是一个联合类型，但 `addElement` 接收的是 `CanvasElement`，创建时编译器无法自动判断你要添加哪种子类型。

**建议**：为 `addElement` 增加泛型重载，或引入工厂函数：

```typescript
// 方案 A：工厂函数
function createSceneElement(props: Omit<SceneElement, 'type'>): SceneElement {
  return { ...props, type: 'scene' };
}

// 方案 B：类型守卫式 store action
addElement<T extends CanvasElement>(element: T): void;
```

### 2.2 App.tsx 中的全局快捷键应移至 Hook

[App.tsx](file:///d:/Programs/Board/Canvas/src/App.tsx) 中 192-261 行有一个庞大的 `handleKeyDown` 函数（70+ 行），处理了 Ctrl+Z/Y、Ctrl+A/D/G、Delete、工具切换等所有全局快捷键。这与 Phase 2 中已经提取的 `useKeyboardShortcuts` 是**平行且重复**的关注点。

**建议**：创建 `useGlobalShortcuts` hook，把 App.tsx 中的快捷键逻辑迁移过去，与 `useKeyboardShortcuts`（目前只管修饰键状态）形成互补。

### 2.3 Window CustomEvent 通信应逐步替换

当前多处使用 `window.dispatchEvent(new CustomEvent(...))` 进行组件间通信：
- `canvas:start-marquee-export`
- `open-settings`
- `generation:success`

这种模式难以追踪数据流且没有类型安全。

**建议**：用 Zustand 的 `subscribe` 或一个轻量的类型化事件总线替代：

```typescript
// src/utils/eventBus.ts
type EventMap = {
  'marquee:start': void;
  'settings:open': void;
  'generation:success': { placeholderId: string; execId?: string };
};

const bus = createTypedEventBus<EventMap>();
```

---

## 3. 🟢 低优先级：体验与工程质量

### 3.1 测试覆盖扩展

Phase 4 建立了测试基础设施，目前有 7 个测试用例。建议优先覆盖以下高风险模块：

| 模块 | 理由 | 测试类型 |
|------|------|----------|
| `topologicalSort` (executionEngine) | 核心算法，可纯函数测试 | 单元测试 |
| `flowResolver.ts` | upstream 贡献计算直接影响生成结果 | 单元测试 |
| `alignmentUtils.ts` | 吸附和对齐的精度至关重要 | 单元测试 |
| `useCanvasStore` (history) | undo/redo + coalescing 容易有边界 bug | 集成测试 |
| `exportPng / exportSvg` | 导出质量影响交付物 | 快照测试 |

### 3.2 性能优化空间

- **`NodeInputBar` 反复重渲**：每个选中的节点都挂载一个完整的 1770 行组件。考虑对非激活的 InputBar 使用 `React.memo` + 可见性判断来延迟渲染。
- **`useCanvasStore` 订阅粒度**：当前 `CanvasElements` 通过 `useCanvasStore()` 一次性订阅了 `elements`, `selectedIds`, `deleteElements`, `activeTool`, `drawingConnection`, `groups` 六个字段。任何一个变化都会触发整个列表的重渲。建议使用 Zustand 的 `useShallow` 或精确选择器。
- **连线计算**：`InfiniteCanvas` 中的 `connections.map(...)` 每帧都对所有连线做 `elements.find()`，复杂度 O(connections × elements)。建议预建一个 `elementMap: Map<string, CanvasElement>` 缓存。

### 3.3 代码卫生

- **清理遗留 telemetry**：`fileNodeTelemetry.ts` 的注释写着"2 周观察窗，结束后删这一行"，如果观察窗已过，应当清理。
- **`parseScript.ts` 多余 import**：`uuid` 被导入但已不再使用（`convertScriptToScenes` 已删除）。
- **`CanvasElements.tsx` 多余 import**：`ScriptElement`, `SceneElement` 类型导入在 `syncSceneNodes` 删除后可能不再需要（被 `useStoryboardSync` 内部使用了）。

### 3.4 开发体验 (DX)

- **ESLint + Prettier**：目前项目没有格式化工具配置，导致部分文件 LF、部分 CRLF 混用（git 已在 warning）。
- **路径别名**：当前深层组件的导入路径形如 `../../store/useCanvasStore`。配置 `tsconfig.json` 的 `paths` 别名（如 `@/store`）可大幅改善可读性。
- **Storybook / 组件文档**：对于 11 种节点组件，一个轻量的 Storybook 能极大降低后续接手者的认知门槛。

---

## 📊 全局健康度总结

| 维度 | 评级 | 说明 |
|------|------|------|
| **架构分层** | ⭐⭐⭐⭐ | Phase 1-3 后已形成清晰的 View / Controller / Model 三层 |
| **类型安全** | ⭐⭐⭐ | 有完整的类型定义，但 `as any` 泛滥削弱了实际效果 |
| **测试覆盖** | ⭐⭐ | 基础设施已有，但只覆盖了外围工具函数 |
| **代码复杂度** | ⭐⭐ | NodeInputBar (70KB) 和 useCanvasStore (33KB) 仍然是风险点 |
| **性能** | ⭐⭐⭐ | throttled persist + dragBoundFunc 优化到位，但重渲粒度可改进 |
| **DX/工程规范** | ⭐⭐ | 缺少 ESLint、路径别名、组件文档 |

---

> [!IMPORTANT]
> **我的排序建议**：如果时间有限，最值得立即做的是 **NodeInputBar 拆分**（70KB 是整个项目体积的 ~9%，一个文件！）和 **`as any` 清理**（消除类型隐患）。其次是 `useCanvasStore` 的 slice 化和全局快捷键的 hook 提取。
