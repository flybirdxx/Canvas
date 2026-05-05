---
project_name: 'Canvas'
user_name: 'Smile'
date: '2026-05-05'
sections_completed: ['technology_stack', 'typescript', 'react_konva_zustand_tailwind', 'testing', 'code_quality', 'workflow', 'critical_rules']
status: 'complete'
rule_count: 58
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

**Core:**
- React 19.0 / TypeScript 5.8 (ES2022 target, isolatedModules, jsx: react-jsx, noEmit)
- Vite 6.2 — plugins: `@vitejs/plugin-react` + `@tailwindcss/vite`
- Konva 10.2 / react-konva 19.2 — Canvas 2D 渲染（非 WebGL）

**State & UI:**
- Zustand 5.0 — persist middleware + 自定义 throttled localStorage 适配器（300ms 防抖）
- TailwindCSS 4.1 — CSS-first 配置（`@import "tailwindcss"` + `@theme`，无 `tailwind.config.js`）
- CSS 自定义属性 token 系统 — `--bg-*`, `--ink-*`, `--accent`, `--signal`, `data-theme` 切换主题
- Lucide React 0.546 (icons) / Motion 12.23 (animations) / jsPDF 4.2 (PDF export)

**AI & Server:**
- @google/genai 1.50 — Gemini API
- Express 4.21 — 仅用于静态文件托管 `dist/`

**无测试框架、无 linter、无 CI。** 类型检查：`tsc --noEmit`。

### 关键版本约束（agent 不知道就会出 bug）

1. **Zustand 5 破坏性变更** — v5 的 API 签名与 v4 不同。AI 训练数据多为 v4 模式。生成 store 代码时必须参考现有 store 文件的实际写法，不可从记忆生成。
2. **react-konva 19.x 锁定 React 19** — 大版本号绑定 React 主版本。跨版本混用导致 ref 契约断裂、Stage 渲染白屏。
3. **Vite `define` 是编译时常量替换，不是运行时 env** — `process.env.GEMINI_API_KEY` 在 build 时被替换为字面量字符串，硬编码进 bundle。`process.env.OTHER_VAR` 在浏览器端直接 `ReferenceError: process is not defined`。换 Key 需要重新 build。
4. **TailwindCSS 4 废弃 `tailwind.config.js`** — 全部配置在 CSS 中：`@import "tailwindcss"`；自定义 token 用 `@theme`。按 TW3 惯性生成的配置代码不生效。
5. **`@/*` 映射到项目根目录（非 `src/`）** — `vite.config.ts` 中 `'@': path.resolve(__dirname, '.')`。`@/components/Foo` → `项目根/components/Foo`，不是 `src/components/Foo`。
6. **Canvas 2D 无 DOM 语义** — 所有交互（hover、focus、选中态）必须手动在 Konva 层级绘制。aria 属性对 Canvas 无效。主题切换必须同时更新 CSS 变量和触发 Canvas 重绘。
7. **jsPDF 默认不含中文字体** — 导出中文 PDF 需要显式嵌入 TTF 字体文件 + `pdf.addFont()`，否则输出全是空白方块。

## Critical Implementation Rules

### TypeScript Rules

- **isolatedModules + noEmit** — 禁止 `const enum`（被忽略）。`export default` 与 `export *` 不混用于同一文件
- **`import type`** — 仅运行时不需要的类型用 `import type` 导入（`CanvasElement`, `Connection`, `GatewayErrorKind` 等均此模式）
- **相对路径导入** — 代码库一致使用相对路径（`'../store/useCanvasStore'`），不使用 `@/` 别名。保持此约定
- **扩展名省略** — import 不写 `.ts` / `.tsx` 后缀，Vite 模块解析自动处理
- **判别联合错误处理** — 不 throw。异步操作返回 tagged union：`{ ok: true, urls }` | `{ ok: false, kind, message }` | `{ ok: 'pending', taskId }`。Gateway provider 必须遵循此契约
- **`as any` 显式标记** — 仅在极少数不可避免的场景使用（如 `replaceElement` 跨类型替换），附简短注释说明原因
- **类型单一出口** — 所有元素类型集中在 `src/types/canvas.ts`，新增类型优先追加于此
- **null vs undefined** — `null` 表示有意为空（`drawingConnection: null`），`undefined` 表示未提供/缺省。不混用

### React Rules

- **React 19 ref 模式** — 不用字符串 ref、不用 `findDOMNode`。Konva 节点 ref 通过 `useRef<Konva.Stage>(null)` 建立
- **App.tsx 是纯 shell** — chrome 布局 + 快捷键 + 生命周期（resume、migration queue）。业务逻辑在子组件。新功能面板作为顶层组件挂入 App
- **window CustomEvent 松耦合** — 跨组件通信通过 `window.dispatchEvent(new CustomEvent(...))`（如 `'open-settings'`），避免 prop drilling
- **组件文件** — PascalCase 命名，一个文件一个默认导出。不使用 barrel export

### Konva / Canvas Rules

- **Stage → Layer → Group 层级** — 不变。新增渲染内容挂在 Layer 下
- **`stageRegistry` 全局引用** — 导出/截图通过 `getStage()` 获取 Stage 实例，不 prop-drilling
- **Html 叠加层限制** — text / sticky 用 `<Html>` 叠加 DOM 实现富文本。这些节点不参与 Konva `toDataURL()`（PNG/SVG/PDF 导出不可见）
- **Transformer 锚点** — 节点缩放/旋转通过 Konva.Transformer。新增节点类型需定义其 bounding box
- **点格背景跟踪 scale** — `backgroundSize` 跟踪 `stageConfig.scale`，锚定纸面。修改 scale 逻辑时保持
- **坐标换算** — 节点坐标是 canvas-space。screen-space 转换：`screenX = stageX + canvasX * scale`

### Zustand Store Rules

- **纯不可变更新** — 不使用 immer/produce（除 2 个辅助 store）。手动 spread
- **`replaceElement` 原子替换** — 必须优先于 `deleteElements + addElement`（后者删除关联 connection）
- **Undo coalescing** — 同元素同属性在 500ms 内连续 `updateElement` 合并为一个快照（`_coalesceKey` + `_coalesceAt`）
- **persist 版本迁移** — 改动持久化结构必须递增 `version` + 添加 `migrate` 逻辑。当前版本：v7
- **throttled localStorage** — `setItem` 300ms 防抖，`beforeunload`/`pagehide` flush。拖拽位置帧级更新不直接写盘
- **独立 persist key** — Asset Library / Gen History / Prompt Library 各自独立 key，不耦合主 store 生命周期

### Tailwind / CSS Rules

- **CSS 自定义属性优先** — 颜色/间距/圆角/阴影全部通过 token 变量。禁止 inline 魔法值
- **`data-theme` 主题切换** — 不是 Tailwind `dark:` 类前缀。JS 侧 `setAttribute('data-theme', ...)`。Canvas 渲染层需同步响应
- **设计系统基础类** — `chip-paper`（浮层面板）、`btn-ghost`、`btn-primary`、`anim-fade-in`。新组件沿用
- **字体栈不跨 Canvas** — CSS `font-family` ≠ Konva `fontFamily`。Konva 文本需显式设字体，回退链取决于浏览器 Canvas API

### Testing Rules

- **当前状态：零测试** — 无 Vitest、Jest、Playwright、Cypress。唯一自动化检查：`tsc --noEmit`
- **不要擅加测试框架** — 实现功能时，不自行引入测试依赖。除非用户明确要求
- **手动验证路径** — 重构后必须手动验证：画布渲染、节点拖拽、AI 生成流程、导出功能
- **Konva 测试特殊性** — jsdom 不支持 Canvas API。未来若引入测试，需 Playwright 像素截图对比，不可用单元测试覆盖 Konva 节点渲染
- **导出产物验证** — SVG/PDF/HTML 导出结果只能目视确认。自动化需 PDF 解析库 + 图片像素对比

### Code Quality & Style Rules

- **无 ESLint / Prettier** — 代码风格依赖开发者自律 + TypeScript 编译器。人工审查是唯一质量门
- **命名约定** — 组件：PascalCase。函数/变量：camelCase。CSS 类：kebab-case。类型/接口：PascalCase
- **Commit 格式** — Conventional Commits：`feat:`, `fix:`, `docs:`, `refactor:`，描述用中文
- **文件组织** — `components/`（UI）、`store/`（Zustand）、`services/`（业务逻辑/IO）、`types/`（类型）、`utils/`（纯函数）、`data/`（静态数据/模板）
- **无 barrel export** — 不通过 `index.ts` 重导出。每个 import 直接指向源文件
- **注释约定** — 业务逻辑/类型 JSDoc 用中文。不写描述 what 的注释（代码自解释），只写解释 why 的（非显而易见的决策/约束/workaround）
- **空值检查** — 不写防御性校验处理不可能发生的场景。只在系统边界（用户输入、API 响应）做校验

### Development Workflow Rules

- **开发命令** — `npm run dev`（:3000），`npm run build`，`npm run lint`（`tsc --noEmit`）
- **API Key** — `.env.local` 中设 `GEMINI_API_KEY`。build-time define，非运行时 env
- **HMR 控制** — `DISABLE_HMR=true` 禁用热更新（AI Studio 编辑模式）。不修改此行为
- **分支策略** — `main` 唯一分支。直接在 main 提交，无 PR 流程，无 CI/CD
- **部署** — `npm run build` → `dist/`，Express 静态托管

### Critical Don't-Miss Rules

**绝对禁止：**
1. 不用 `deleteElements + addElement` 替换节点 — 必须用 `replaceElement`（前者删除关联 connection）
2. 不 throw — 所有异步操作走 `{ ok, kind?, message? }` 判别联合返回
3. 不在 import 中加 `@/` 前缀 — 项目使用相对路径
4. 不在浏览器端引用未定义的 `process.env.*` — 仅 `GEMINI_API_KEY` 通过 Vite define 编译时注入
5. 不把 `toDataURL()` 产物当完整导出 — Html 覆盖层节点不参与
6. 不按 Tailwind 3 惯性改 `tailwind.config.js` — 不存在。配置在 `src/index.css` 的 `@theme` 中
7. 不跨 react-konva ↔ React 大版本混用

**容易遗漏的细节：**
- 画布坐标 ≠ 屏幕坐标 — `screenX = stageX + canvasX * scale`
- 主题切换需双轨同步 — CSS 变量变更后，Canvas 层需显式重绘
- jsPDF 中文字体 — 必须嵌入 TTF。不嵌入 = 空白方块，静默数据丢失
- IndexedDB blob 模式 — `FileElement.src` 为空字符串且 `persistence: 'blob'` 是正常的，需异步 rehydrate
- AIGeneratingElement 是瞬态 — 不长期持久化，不在其他逻辑中当成稳定节点类型
- 拖拽不入 undo 栈 — 帧级 dragmove 不记历史，mouseup 时 `batchUpdatePositions` 一步入栈

---

## Usage Guidelines

**For AI Agents:**

- 在编写任何代码之前阅读此文件
- 严格遵循所有规则，按文档精确执行
- 不确定时，选择更保守/更受限的做法
- 如果发现新的重复模式，建议更新此文件

**For Humans:**

- 保持此文件精简，聚焦 agent 需要的内容
- 技术栈或核心模式变更时同步更新
- 每季度审查一次，移除已过时的规则
- 删除随时间推移变得显而易见的规则

最后更新：2026-05-05
