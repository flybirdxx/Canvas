---
stepsCompleted: ['step-01-init', 'step-02-context', 'step-03-starter', 'step-04-decisions', 'step-05-patterns', 'step-06-structure', 'step-07-validation', 'step-08-complete']
status: 'complete'
completedAt: '2026-05-05'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/prd-validation-report.md
  - _bmad-output/project-context.md
  - docs/architecture/overview.md
  - docs/architecture/components.md
  - docs/architecture/data-flow.md
  - docs/architecture/ai-gateway.md
  - docs/roadmap-RICE.md
  - docs/prd/existing-features.md
workflowType: 'architecture'
project_name: 'Canvas'
user_name: 'Smile'
date: '2026-05-05'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:** 45 条 FR，10 个能力域，分三阶段交付。

已交付（MVP — 28 FRs）：画布交互、AI 生成管线、连线工作流、节点系统、资源模板、导出、持久化、主题。

当前待实现（V1 — 12 FRs）：
- FR1-2（对齐吸附/多选成组）— 画布交互增强
- FR12（局部重绘）— AI 生成扩展
- FR16-18（链式运行引擎）— 核心新增：拓扑排序 + 节点状态机 + 错误隔离
- FR24-25（运行面板）— 实时日志推送 + 任务取消
- FR26-28（叙事分镜）— 双视图架构 + Markdown 解析
- FR33（模板保存）— 画布序列化/反序列化
- FR35-37（多格式导出）— PDF/SVG/HTML/ZIP 导出管线
- FR44-45（桌面壳）— web-to-desktop 打包

远期（V2 — 5 FRs）：视频生成、Inpaint、角色一致性、LLM 拆分、新节点类型

**Non-Functional Requirements:** 15 条。关键架构驱动：
- NFR1-5 — 性能预算（100 节点 55fps、冷启 <2.5s、AI P95 ≤25s）
- NFR6-9 — 安全（Key 加密存储、直连 Provider、遥测本地）
- NFR10-12 — 存储（500 节点/500MB、大对象独立存储、异步持久化）
- NFR13-14 — 可访问性（WCAG AA DOM 层、Canvas 层限制）
- NFR15 — i18n（当前 zh-CN，V1 英文）

### Scale & Complexity

- **技术领域**: Canvas-heavy web app（非典型 DOM SPA）
- **复杂度**: Medium-High — Canvas 渲染 + AI 网关 + 链式执行引擎
- **架构组件**: ~8 核心系统（Canvas / 状态 / AI 网关 / 持久化 / 导出 / 连线引擎 / 运行引擎 / 分镜）

### Technical Constraints & Dependencies

**既有约束（brownfield）：**
- React 19 + Konva 10 Canvas 2D（非 WebGL）
- Zustand 5 纯不可变 + throttled persist（300ms 防抖）
- AI 网关 Provider 注册模式（静态 PROVIDERS[] 数组）
- localStorage/IndexedDB 混合存储（迁移链 v0→v7）
- `@/*` → 项目根（非 src/）
- Html 覆盖层不参与 Konva 导出管线

**V1 新需求依赖：**
- FR16 链式执行 → 依赖 FR14-15（连线 + 环检测）— 已有基础
- FR27 分镜视图 → 依赖 FR26 剧本节点数据模型
- FR35-37 多格式导出 → 依赖 stageRegistry，Html 节点限制仍然存在

### Cross-Cutting Concerns

1. **Canvas/DOM 双轨渲染** — 新组件必须在正确渲染层实现
2. **持久化链路一致性** — V1 新状态必须纳入 persist migrate 链
3. **AI Provider 扩展** — 新增一个文件 + push 数组，V1 不改此架构
4. **主题同步** — CSS 变量 + Canvas 属性双轨，双轨同步
5. **导出管线** — 共享数据源，各格式有不同渲染限制
6. **运行引擎状态隔离** — 拓扑状态机不污染 undo/redo 栈

## Foundation: Established Technology Stack

本项目的"starter"决策已在 MVP 阶段完成。

### Primary Technology Domain

**Canvas-heavy web app** — 基于浏览器的 SPA，核心交互面为 Konva Canvas 2D 引擎。

### 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 框架 | React | 19.0 |
| 语言 | TypeScript | 5.8 (ES2022, isolatedModules) |
| 构建 | Vite | 6.2 |
| 画布 | Konva / react-konva | 10.2 / 19.2 |
| 状态 | Zustand | 5.0 (persist + throttled adapter) |
| 样式 | TailwindCSS | 4.1 (CSS-first + token system) |
| 动画 | Motion | 12.23 |
| 导出 | jsPDF | 4.2 |
| AI | @google/genai | 1.50 |
| 服务 | Express | 4.21 (static only) |
| 桌面 | Tauri | V1 planned |

### 已建立的架构模式

- Canvas/DOM 双轨渲染
- Zustand 纯不可变 + throttled persist (300ms)
- AI 网关 Provider 注册模式
- localStorage/IndexedDB 混合存储 (v7 migration)
- stageRegistry 全局引用
- replaceElement 原子替换
- Undo coalescing (500ms window)
- CSS 自定义属性 token 系统 + data-theme 双轨

### 现状

- 类型检查: `tsc --noEmit`
- 無 Vitest / Playwright / ESLint / Prettier
- 手动验证为唯一质量门

## Core Architectural Decisions

### Decision Priority

**Critical (V1 blocked without these):**
1. 链式执行引擎 → `useExecutionStore`（独立 Zustand store）
2. 分镜双视图 → `StoryboardView` 组件（与 InfiniteCanvas 平级）

**Important (shape V1 architecture):**
3. 运行面板实时更新 → Zustand subscribe 事件驱动
4. 多格式导出 → 各自独立 util（保持现有模式）

### AD1: Chain Execution Engine — Independent Store

- **Decision**: 新建 `src/store/useExecutionStore.ts`，不 persist
- **Rationale**: 运行态是瞬时数据，刷新后不恢复。独立 store 防止污染 canvasStore undo/redo 栈
- **State**: `{ executions: Map<execId, { nodeStates, topology, logs }> }`
- **Status flow**: idle → queued → running → success/failed
- **Notification**: `set()` → Zustand subscribers → 运行面板自动更新
- **Implements**: FR16, FR17, FR18

### AD2: Storyboard Dual-View — Peer Components

- **Decision**: `StoryboardView` 与 `InfiniteCanvas` 同级组件
- **Rationale**: Canvas 渲染 vs DOM 卡片网格是不同渲染范式。平级隔离
- **Data**: 共享 `useCanvasStore`，双视图数据自动互通
- **Toggle**: `useCanvasStore.viewMode: 'canvas' | 'storyboard'`
- **Implements**: FR26, FR27, FR28

### AD3: Run Panel — Zustand Subscribe

- **Decision**: 运行面板通过 `useExecutionStore.subscribe()` 监听
- **Rationale**: Zustand 原生能力，无额外依赖。per-node 状态变更触发重渲染
- **Implements**: FR24, FR25

### AD4: Multi-Format Export — Independent Utilities

- **Decision**: 每格式独立 util 文件
- **Rationale**: 各格式渲染逻辑差异大。6 种格式下独立 > 统一抽象
- **Existing**: `exportPng.ts`, `exportSvg.ts`, `exportPdf.ts`, `exportHtml.ts`
- **V1 new**: `exportZip.ts`, `exportMp4.ts`
- **Data source**: `useCanvasStore.getState()` + `getStage()`
- **Implements**: FR35, FR36, FR37

## Implementation Patterns & Consistency Rules

> 基础模式见 `_bmad-output/project-context.md`（58 条）。本章只定义 V1 新增决策带来的约束。

### V1-New Patterns

**Execution Store (AD1):**
- 文件: `src/store/useExecutionStore.ts` — **不 persist**
- 标注: `// transient store — no persist`（防止 agent 惯性加 middleware）
- 参考 `useGenerationQueueStore` 的模式

**StoryboardView (AD2):**
- 文件: `src/components/StoryboardView.tsx` — 默认导出
- 纯 DOM 渲染（非 Konva），用 `chip-paper` CSS 类
- 读 `useCanvasStore` 获取 scene 节点

**Run Panel (AD3):**
- `useExecutionStore.subscribe()` 驱动更新
- 日志: `{ timestamp, level, nodeId, message }`
- 与 GenerationQueuePanel 区分——运行面板看执行状态，队列面板看生成状态

**Export Utilities (AD4):**
- 新文件: `src/utils/exportZip.ts`, `src/utils/exportMp4.ts`
- 签名: `export function exportXxx(): boolean`（与现有约定一致）
- 数据源: `useCanvasStore.getState()` + `getStage()`

### Conflict Prevention

AI agent 最易出错的 4 个点:

1. **useExecutionStore 不 persist** — agent 可能惯性加 middleware
2. **StoryboardView 用 DOM 不是 Konva** — agent 可能尝试用 Canvas 渲染卡片
3. **viewMode 在 canvasStore（persist）** — 刷新后恢复视图状态
4. **运行状态不写 undo 栈** — 节点执行状态变更走 useExecutionStore，不走 canvasStore.updateElement

## Project Structure & Boundaries

### V1 Additions to Existing Structure

```
src/
├── components/
│   ├── StoryboardView.tsx           # NEW — 分镜网格 DOM 视图
│   └── RunPanel.tsx                 # NEW — 运行面板
├── store/
│   └── useExecutionStore.ts         # NEW — 瞬态，不 persist
├── services/
│   └── executionEngine.ts           # NEW — 拓扑排序 + 状态机
└── utils/
    ├── exportZip.ts                 # NEW — ZIP 导出
    └── exportMp4.ts                 # NEW — MP4 拼接导出
```

### Requirements → Structure Mapping

| FR | 能力 | 文件 |
|----|------|------|
| FR1-2 | 对齐/成组 | InfiniteCanvas + AlignmentToolbar |
| FR12 | 局部重绘 | InpaintOverlay（扩展） |
| FR16-18 | 链式执行 | executionEngine + useExecutionStore |
| FR24-25 | 运行面板 | RunPanel + subscribe |
| FR26-28 | 分镜 | StoryboardView + canvasStore.viewMode |
| FR33 | 模板保存 | canvasStore + TemplatesModal |
| FR35-37 | 导出 | exportZip + exportMp4 + 现有 utils |
| FR44-45 | 桌面 | src-tauri/（Tauri CLI） |

### Data Boundaries

| 边界 | Store | Persist? | Writer | Reader |
|------|-------|----------|--------|--------|
| 画布数据 | canvasStore | ✓ | actions | all |
| 执行状态 | executionStore | ✗ | engine | RunPanel |
| API Keys | settingsStore | ✓ | SettingsModal | gen services |
| 生成历史 | genHistoryStore | ✓ | gen pipeline | HistoryPanel |
| 视图模式 | canvasStore.viewMode | ✓ | TopBar | App |

## Architecture Validation

### Coherence ✅
- 所有决策兼容 React 19 + Konva + Zustand 现有栈
- useExecutionStore（transient）与 canvasStore（persist）职责分离清晰
- StoryboardView（DOM）与 InfiniteCanvas（Konva）正确隔离
- subscribe 模式与 Zustand 架构一致

### Requirements Coverage ✅
- V1 FR 12 条全部映射到架构组件
- NFR 15 条全部由现有 + V1 架构支撑
- V2 FR 5 条标记为远期

### Readiness ✅
- 4 AD 含决策/理由/影响范围
- 4 conflict prevention 规则覆盖高频 error
- V1 新增文件位置明确标注

### Gap Analysis
- Critical: 0
- Minor: 2（executionEngine 内部实现留待细化，exportMp4 框架可先行）

**Status:** READY FOR IMPLEMENTATION
