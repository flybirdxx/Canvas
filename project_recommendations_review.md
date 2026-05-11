# 📋 项目建议方案 — 逐条评估

> 对 `project_recommendations.md` 中每一项建议，基于当前代码实际状态（2025-07）给出**验证结论**、**风险评估**和**优先级修正**。

---

## 一、总体判断

原方案对代码库的**问题识别准确率约 90%**，拆分策略和技术方向基本正确。但有 1 处事实错误（CanvasElements.tsx 的 import），部分建议的优先级和预估工作量需要调整。

---

## 二、逐项评估

### 🔴 高优先级：巨型文件拆解

#### 1. NodeInputBar.tsx 拆分

| 项目 | 评估 |
|------|------|
| **当前状态** | 1770 行，含 5 个内部子组件（QuickChip、ThumbChip、Dropdown、MoreMenu、ToolbarDivider）+ 主组件 + buildModelOptions 纯函数 + 三种模式的 handleSubmit（image/video/text/inpaint）全部耦合 |
| **方案判断** | ✅ **完全同意**。推荐的 8 文件结构合理 |

**补充建议**：

- `Dropdown` 和 `MoreMenu` 是通用 UI 组件，建议放在 `src/components/ui/` 而非 `input-bar/` 下，以便 PropertiesPanel 等其他组件复用
- 拆分的**最大风险点**是 `handleSubmit` 函数（近 200 行），深度耦合 placeholder 创建、锚点替换、参考图合并、telemetry 埋点。建议先把 `handleSubmit` 内部按模式提取为独立函数，再分配到对应子模块

**建议结构（微调）**：

```
src/
├── components/
│   ├── input-bar/
│   │   ├── NodeInputBar.tsx          # 薄壳分发
│   │   ├── ImageGenControls.tsx
│   │   ├── VideoGenControls.tsx
│   │   ├── TextGenControls.tsx
│   │   ├── PromptTextarea.tsx
│   │   ├── ModelSelector.tsx
│   │   ├── ReferenceManager.tsx
│   │   └── utils.ts
│   └── ui/
│       ├── Dropdown.tsx              # 通用下拉（纳入 QuickChip 的 popup-claim 逻辑）
│       ├── MoreMenu.tsx
│       └── ToolbarDivider.tsx
```

| 预估工时 | 风险 | 收益/成本比 |
|----------|------|-------------|
| 3-4 小时 | 中（handleSubmit 分支复杂） | ⭐⭐⭐⭐⭐ 最高 |

---

#### 2. useCanvasStore.ts 切片

| 项目 | 评估 |
|------|------|
| **当前状态** | 799 行，15 个 actions + persist middleware + migrate chain (v1→v9) + throttled adapter |
| **方案判断** | ✅ 方向正确，6 个 slice 的划分边界合理 |

**风险警告**：

- `replaceElement` action 跨越 elements / connections / selection 三个关注点，slice 化后跨 slice 操作需要 Zustand 的 `set((state) => ...)` 模式手动组合，可能损失内聚性
- Migrate chain (v1→v9) 有 100+ 行，建议单独放入 `migrations.ts`
- `persistMiddleware.ts` 独立为文件已基本完成（`createThrottledLocalStorage` 纯函数可直接外提）
- **这是对核心状态层的重构，当前对此模块的测试覆盖为零**。强烈建议在拆分前先给核心算法建回归网

| 预估工时 | 风险 | 收益/成本比 |
|----------|------|-------------|
| 5-6 小时 | 高（无测试、核心状态层） | ⭐⭐⭐ 中等 |

---

### 🟡 中优先级：架构改进

#### 3. 消除 `as any` 类型断言

| 项目 | 评估 |
|------|------|
| **当前状态** | 遍布 `App.tsx`、`NodeInputBar.tsx`、`InfiniteCanvas.tsx`、`executionEngine.ts`、`CanvasElements.tsx` |
| **方案判断** | ✅ 方向正确 |

**分步执行建议**：

**第一步（低成本，覆盖 ~60%）**：`addElement` 泛型重载

```typescript
// 只需改 store 签名，调用方不改
addElement<T extends CanvasElement>(element: T): void;
```

**第二步（中等成本）**：为 `updateElement` 增加泛型约束

```typescript
// 当前
updateElement(id: string, attrs: Partial<CanvasElement>, label?: string): void;

// 改进
updateElement<T extends CanvasElement['type']>(
  id: string,
  attrs: Partial<Extract<CanvasElement, { type: T }>>,
  label?: string
): void;
```

这需要更深层的类型体操，可能引入复杂的条件类型。建议第一阶段先行。

| 预估工时 | 风险 | 收益/成本比 |
|----------|------|-------------|
| 第一阶段 1-2 小时 | 低 | ⭐⭐⭐⭐ 高 |

---

#### 4. App.tsx 全局快捷键迁移到 Hook

| 项目 | 评估 |
|------|------|
| **当前状态** | `useKeyboardShortcuts` 仅管理 Space/Alt/Shift 按下状态。App.tsx 第 192-261 行有 70+ 行的 `handleKeyDown` 处理 Ctrl+Z/Y/A/D/G、Delete、单键工具切换、Home 重置视图等 |
| **方案判断** | ✅ 完全同意。`useGlobalShortcuts` 与 `useKeyboardShortcuts` 职责分明 |

**技术注意**：快捷键处理函数中引用了 `selectedIds`、`elements`、`viewMode` 等 Zustand state，需确保 hook 内通过 `useCanvasStore.getState()` 或精确 selector 读取，避免闭包过期问题。

| 预估工时 | 风险 | 收益/成本比 |
|----------|------|-------------|
| 30 分钟 | 极低 | ⭐⭐⭐⭐⭐ 极高 |

---

#### 5. CustomEvent 通信替换为 Typed Event Bus

| 项目 | 评估 |
|------|------|
| **当前状态** | 4 种 CustomEvent，11 处使用 |

| Event 名 | 使用场景 | 处理建议 |
|----------|----------|----------|
| `generation:success` | executionEngine ↔ imageGeneration | **最需要 typed bus** — 携带 `{ placeholderId, execId }`，当前零类型安全 |
| `canvas:popup-claim` | NodeInputBar 内部 | 拆分时用 React Context 替代，不需要 event bus |
| `open-settings` | AIGeneratingNode → App | 适合 event bus 或 Zustand subscribe |
| `canvas:start-marquee-export` | ExportMenu / 快捷键 → InfiniteCanvas | 适合 event bus |

**优先级下调理由**：当前 CustomEvent 模式功能上没问题，引入 typed event bus 需要新增依赖或手写工具代码。建议等 NodeInputBar 拆分时顺带处理 `popup-claim`，其余逐步替换。

| 建议优先级 | 🟢 降低为低优先级 |
|------------|-------------------|

---

### 🟢 低优先级：体验与工程质量

#### 6. 测试覆盖扩展

| 项目 | 当前实际状态 |
|------|-------------|
| 现有测试文件 | 3 个：`parseScript.test.ts`、`storyboardSync.test.ts`、`useKeyboardShortcuts.test.tsx` |

> ⚠️ 原方案说"7 个测试用例"，实际是 3 个测试文件。

| 推荐目标 | 优先级 | 说明 |
|----------|--------|------|
| `topologicalSort` | 🔴 最高 | 纯函数，核心算法，应先写 |
| `flowResolver.ts` | 🔴 最高 | 上游贡献计算直接影响生成结果 |
| `alignmentUtils.ts` | 🟡 建议 | 吸附精度，纯函数可测 |
| `useCanvasStore` history | ⚠️ 延后 | 需 mock Zustand，集成测试复杂性高 |
| `exportPng/exportSvg` | ⚠️ 延后 | 依赖 Konva Stage + DOM + canvas，快照测试不稳定 |

| 预估工时 | 风险 | 收益/成本比 |
|----------|------|-------------|
| 前三个 2 小时 | 低 | ⭐⭐⭐⭐⭐ |

---

#### 7. 性能优化

| 建议 | 评估 |
|------|------|
| NodeInputBar `React.memo` + 可见性判断 | ✅ 可行 |
| useCanvasStore 订阅粒度（`useShallow` 或精确 selector） | ✅ 方向正确 |
| 连线计算预建 `elementMap` 缓存 | ✅ 5 行内解决 |

**总体意见**：这些都是微优化，建议在性能瓶颈实际出现时处理，**不作为独立任务排期**。

---

#### 8. 代码卫生

| 建议 | 验证结果 | 结论 |
|------|----------|------|
| 清理 `fileNodeTelemetry.ts` | 完整 telemetry 系统约 150 行，注释 "2 周观察窗，结束后删这一行" 确实存在 | ✅ 可执行，需先确认观察窗是否已过期 |
| `parseScript.ts` 多余 `uuid` import | 第 1 行 `import { v4 as uuidv4 } from 'uuid'` 存在，需确认是否仍被使用 | ✅ 可执行 |
| `CanvasElements.tsx` 多余 `ScriptElement`/`SceneElement` import | 第 161 行 `as ScriptElement`、第 163 行 `as SceneElement` **仍在使用中** | ❌ **不可删除** |

> **重要纠正**：`CanvasElements.tsx` 中的 `ScriptElement` 和 `SceneElement` 类型仍在 script/scene 节点的类型断言中实际使用，删除会导致类型错误。原方案此条判断有误。

---

#### 9. 开发体验 (DX)

| 建议 | 验证结果 | 结论 |
|------|----------|------|
| ESLint + Prettier | 当前无配置 | ✅ 建议正确。CRLF/LF 混用可能也需 `.gitattributes` |
| 路径别名 | `tsconfig.json` 已配置 `@/*` → `./*`，但代码中未使用 | ✅ 基础设施已有，改动是批量 import 替换 |
| Storybook | 无 | 对 11 种节点组件有价值，但属于独立项目 |

---

## 三、优先级重排序

```
🔴 立刻做（本周）：
  [1] NodeInputBar 拆分                   3-4h   收益最大（文件占项目 ~9%）
  [2] App.tsx 快捷键迁移到 hook           0.5h   零风险，即时见效
  [3] topologicalSort + flowResolver      2h     建回归网，为后续重构铺路
      + alignmentUtils 单元测试

🟡 尽快做（本月）：
  [4] addElement 泛型重载                 1-2h   消除 ~60% 的 as any
  [5] useCanvasStore slice 化             5-6h   需先完成 [3] 建测试网
  [6] 清理 fileNodeTelemetry              0.5h   确认观察窗到期后

🟢 有余力时：
  [7] CustomEvent → typed event bus       2h
  [8] 路径别名批量替换 import             1h
  [9] ESLint 配置                         1h
  [10] 性能微优化                         1h
```

---

## 四、事实勘误

| 位置 | 原方案说法 | 实际情况 |
|------|-----------|----------|
| 3.3 节 | `CanvasElements.tsx` 中 `ScriptElement`, `SceneElement` import 可能不再需要 | 第 161/163 行仍用于 `as ScriptElement` / `as SceneElement` 类型断言，**不可删除** |
| 3.1 节 | "目前有 7 个测试用例" | 实际是 3 个测试**文件**（非用例） |
| 2.3 节 路径别名 | "配置 tsconfig.json 的 paths 别名" | `@/*` 别名已配好，只是代码中未使用 |
| 全局健康度总结 | 路径别名建议作为待做项 | 基础设施已有，应改为"批量替换相对 import 为 @/ 别名" |

---

## 五、建议起点

如果时间有限，从 **NodeInputBar 拆分** 或 **App.tsx 快捷键迁移** 起步，这两项收益/成本比最高且互不依赖，可并行。
