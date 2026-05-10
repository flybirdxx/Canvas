# Project Instructions

This file provides context for AI assistants working on this project.

## Project Type: Node.js / React SPA

### Commands
- Install: `npm install`
- Dev: `npm run dev` (Vite dev server on :3000, binds 0.0.0.0)
- Build: `npm run build` (production build to dist/)
- Preview: `npm run preview` (preview production build)
- Lint: `npm run lint` (TypeScript type-check via `tsc --noEmit`)

### Environment Variables
- Set `GEMINI_API_KEY` in `.env.local`
- Set `DISABLE_HMR=true` to disable HMR

### Framework: Vite 6 + React 19 + TypeScript 5.8

### Version Control
This project uses Git. See `.gitignore` for excluded files.

---

## Project Overview

**AI Canvas Pro (Warm Paper Studio)** — an infinite canvas for AI-assisted creative work. Users place nodes (text, image, video, audio, sticky, rectangle, file, scene, script) on an infinite canvas, connect them with typed ports to form generation pipelines, and dispatch AI generation via a provider-agnostic gateway.

### Key Features
- Infinite canvas with pan/zoom (Konva Stage)
- Node-based visual programming with typed port connections
- AI image/video/audio generation via pluggable providers (T8Star, RunningHub)
- Script/Scene authoring workflow with structured ScriptLine editing
- Storyboard grid view with batch execution
- Cross-session async generation resume (task polling)
- File storage with IndexedDB fallback for large files (>1MB)
- Undo/redo (50 steps, 500ms coalescing window)

---

## Architecture

### Rendering Pipeline
- `src/App.tsx` — shell: dot-grid background, z-indexed chrome layers, keyboard shortcuts, blob migration runner
- `src/components/canvas/InfiniteCanvas.tsx` — Konva Stage + Layer, pan/zoom/wheel handling, quick-add menu, batch generation toolbar, marquee export, drag-and-drop file ingest
- `src/components/canvas/CanvasElements.tsx` — renders each `CanvasElement` as a Konva node; handles blob rehydration for IndexedDB-backed file elements and broken-attachment placeholders
- Nodes render as Konva primitives **except** text and sticky notes which use `<Html>` overlays — these are DOM outside Konva's pipeline and will not appear in `stage.toDataURL()` exports

### State Management
- `src/store/useCanvasStore.ts` — **central store**: elements, connections, selection, stageConfig (scale/x/y), undo/redo stack (50 steps), active tool, inpainting transient state. Persisted via a throttled localStorage adapter (300ms debounce, flush on `beforeunload`). Undo coalesces same-key updates within 500ms.
- `src/store/useSettingsStore.ts` — API keys and per-provider config (persisted)
- `src/store/useGenerationHistoryStore.ts` — cross-session generation log entries (persisted)
- `src/store/useGenerationQueueStore.ts` — transient in-flight generation queue
- `src/store/useAssetLibraryStore.ts` — uploaded/generated asset catalog (persisted, separate key)
- `src/store/usePromptLibraryStore.ts` — built-in + user prompt presets (persisted)
- `src/store/useExecutionStore.ts` — execution run state (runs, node statuses, execution order)

### AI Gateway
- `src/services/gateway/` — provider abstraction layer. Each provider implements the `GatewayProvider` interface. Registry holds a static `PROVIDERS[]` array. Currently: `T8StarProvider` (sync), `RunningHubProvider` (async, with `pollImageTask` for cross-session resume).
- Generation flow: `runOneSlot` in `src/services/imageGeneration.ts` → replace node with `AIGeneratingElement` placeholder → call `generateImageByModelId` → on success, `replacePlaceholderWithImage` atomically swaps placeholder for result node (preserving connections via `replaceElement`). Async providers write `pendingTask` to the placeholder; `taskResume.ts` polls on startup and every 3 minutes.

### Element Types
- 8 concrete types: `rectangle`, `circle`, `text`, `image`, `sticky`, `video`, `audio`, `file`
- 2 special types: `aigenerating` (transient placeholder), `scene`, `script`
- Connections use typed ports (`DataType`: `any` | `text` | `image` | `video` | `audio`); `any` ports accept all types
- Cycles are prevented via DFS
- Bezier curves rendered with double-stroke ink effect
- `replaceElement` is the atomic in-place swap (critical for preserving connections during generation)

### File Storage
- Files >1MB route to IndexedDB (`src/services/fileStorage.ts`) instead of localStorage
- `FileElement.persistence` is either `'data'` (small, inline) or `'blob'` (IndexedDB key)
- A v6→v7 migration in the persist middleware auto-migrates existing large files on load
- Broken blobs render a "file lost, click to re-upload" placeholder

### Execution Engine
- `src/services/executionEngine.ts` — Kahn's topological sort execution engine
  - `topologicalSort(nodeIds, connections)` — returns `string[][]` (levels of parallel-executable nodes) or `null` on cycle
  - `runExecution(selectedIds)` — main entry; sorts, inits run, executes level by level
  - `executeNode(nodeId, execId, ...)` — per-node executor; handles scene/script/image/video/audio types
  - `retryNode` / `retryRun` / `restartRun` — retry mechanisms
  - `cancelExecution(execId)` — abort, nullify controller, sync store, clean up aigenerating placeholders
  - Scene nodes: auto-create linked image node + connection, then delegate to image execution
  - Script nodes: execute all child scenes in sceneNum order
- `src/hooks/canvas/useSceneExecution.ts` — batch scene execution hook with progress polling
- `src/store/useExecutionStore.ts` — run state management (initRun, completeRun, rejectRun, updateNodeStatus, getRun, cancelRun, isRunComplete, etc.)

### Flow Resolution
- `src/utils/flowResolver.ts` — upstream connection resolution
  - `getUpstreamTextContributions(targetId, elements, connections)` — collects all text upstream (text, sticky, scene, script nodes)
  - `getUpstreamImageContributions(targetId, elements, connections)` — collects all image upstream (image, file/image, scene via linkedImageId)
  - `composeEffectivePrompt(localPrompt, upstream)` — merges upstream contributions + local prompt
  - Sort order: canvas position (top-to-bottom, left-to-right) for predictable concatenation

### Script/Scene System (E7 Epic)
- `SceneElement` — structured scene with `sceneNum`, `lines: ScriptLine[]`, `title`, `content`, `scriptId`, `linkedImageId`, `groupId`
- `ScriptElement` — script container; aggregates child scene texts via `scriptId` references
- `ScriptLine` — structured line with `role`, `content`, `emotion`, `emotionEmoji`, `emotionIntensity`
- `src/services/scenePromptComposer.ts` — composes structured lines into prompt text
- Scene nodes have ports: Prompt input (text), Image output, Text output
- Script nodes have ports: 剧本 output (text)

### Views
- Canvas view — infinite Konva canvas with all node types
- Storyboard view — DOM grid of scene cards with multi-select, drag-reorder, image linking, batch execution toolbar
- `src/components/StoryboardExecuteBar.tsx` — execution toolbar (Generate All / Generate Selected + progress bar)
- `src/components/StoryboardView.tsx` — scene card grid with selection, drag-reorder, thumbnail display
- `src/components/canvas/nodes/SceneNode.tsx` — Konva scene node with structured ScriptLine preview

---

## Design Language

**Warm Paper Studio** aesthetic:
- Cream paper background, serif wordmark, terracotta accent, ink-line connections
- CSS token system: `--bg-0/1/2/3` (background layers), `--ink-0/1/2/3` (foreground/text), `--accent`, `--accent-fg`, `--line-1`, `--grid-dot`, `--r-sm/md/lg/pill` (border radii), `--shadow-ink-1/2`, `--font-serif/sans/mono`
- Light/dark via `data-theme` attribute on root element

---

## Path Aliases
- `@/*` resolves to project root (`./*`), configured in both `tsconfig.json` paths and `vite.config.ts` resolve alias

---

## Key Patterns

- **`stageRegistry`** (`src/utils/stageRegistry.ts`) — singleton holding the active Konva Stage reference. Export utilities and anything needing `stage.toDataURL()` read it rather than prop-drilling.
- **`flowResolver`** (`src/services/flowResolver.ts`) — walks upstream connections from a node's prompt input port, collects all text node content and reference images for AI generation.
- **Undo labels** use Chinese strings (e.g., `'移动 3 个元素'`, `'批量生成'`). The `typeLabelMap` in canvasStore maps element types to Chinese.
- **CSS token system** — all visual design uses CSS custom properties defined in theme stylesheets.
- **Port initialization** — single source of truth in `src/store/portDefaults.ts`; both `addElement` in elementSlice and `makePorts` utility use it.
- **Store versioning** — `useCanvasStore` uses `version: 10` with `migrate()` function handling all schema migrations sequentially.
- **`isSceneElement`** / **`isScriptElement`** type guards from `src/types/canvas.ts` — always use these instead of `el.type === 'scene'` for proper TypeScript narrowing.
- **Html-overlay nodes** (text, sticky) are invisible to Konva's `toDataURL()` — PNG exports capture shapes and images only.
- **API keys** live in `useSettingsStore` (per-provider), read fresh per call via `ProviderRuntimeConfig` — providers must not cache them.

---

## Constraints

- No test suite exists yet. `npm run lint` (tsc --noEmit) is the only automated check.
- The `aigenerating` placeholder node type is transient — never persisted long-term; it either resolves to a concrete type or shows an error panel.
- Large data URLs in elements degrade localStorage performance; the throttled adapter mitigates but doesn't eliminate this. IndexedDB path is preferred for files >1MB.
- `Html`-overlay nodes (text, sticky) are invisible to Konva's `toDataURL()` — PNG exports capture shapes and images only.
- API keys are read fresh per call via `ProviderRuntimeConfig` — providers must not cache them.

---

## Guidelines

### 变更纪律（严格执行）

**每次功能修改、优化或修复必须遵循以下流程：**

1. **分析上下文** — 先阅读问题涉及的所有相关源代码，理解数据流、调用链和依赖关系。不只看报错的那一行，要追溯上游调用方和下游被调用方。
2. **给出方案，等待用户决定** — 在动手修改任何代码之前，向用户提交修复方案（包含涉及的文件、修改内容、影响面），由用户决定是否执行。方案未获批准前不得修改代码。
3. **修改时同步上下游** — 执行修改时，分析本次改动是否会导致上游调用方或下游依赖方行为不一致。如果有影响，必须同步修改上下游代码，**不可留"稍后修"的坑**。
4. **验证** — 修改完成后运行 `npx tsc --noEmit` 和项目已有测试，确认零新增错误。

- Follow existing code style and patterns
- Keep changes focused and atomic
- Document public APIs with JSDoc
- Use Chinese for UI labels and undo history labels
- All element types must have corresponding port templates in `src/store/portDefaults.ts`
- When adding a new element type, update: `portDefaults.ts`, `elementSlice.ts` (addElement), `elementSlice.ts` (migration), `CanvasElements.tsx` (render), `types/canvas.ts` (type definition + type guard)
- Execution engine changes must handle scene/script node types specially (see `executeNode` patterns)
- Use `isSceneElement` / `isScriptElement` type guards from `src/types/canvas.ts` for TypeScript narrowing
- Always register `generation:success` event listener in try/finally blocks in execution functions
- AbortController must be nullified after cancel/abort to avoid stale signal reuse
