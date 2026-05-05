# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Vite dev server on :3000, binds 0.0.0.0
npm run build            # Production build to dist/
npm run preview          # Preview production build
npm run lint             # tsc --noEmit type-check
```

Set `GEMINI_API_KEY` in `.env.local`. HMR is disabled when `DISABLE_HMR=true`.

## Architecture

**AI Canvas Pro (Warm Paper Studio)** — an infinite canvas for AI-assisted creative work. Users place nodes (text, image, video, audio, sticky, rectangle, file), connect them with typed ports to form generation pipelines, and dispatch AI generation via a provider-agnostic gateway.

### Stack

React 19 + TypeScript 5.8 + Vite 6 / Konva 10 (react-konva) / Zustand 5 / TailwindCSS 4 / Lucide React

### Rendering

- `src/App.tsx` — shell: dot-grid background, z-indexed chrome layers, keyboard shortcuts, blob migration runner
- `src/components/canvas/InfiniteCanvas.tsx` — Konva Stage + Layer, pan/zoom/wheel handling, quick-add menu, batch generation toolbar, marquee export, drag-and-drop file ingest
- `src/components/canvas/CanvasElements.tsx` — renders each `CanvasElement` as a Konva node; handles blob rehydration for IndexedDB-backed file elements and broken-attachment placeholders
- Nodes render as Konva primitives **except** text and sticky notes which use `<Html>` overlays — these are DOM outside Konva's pipeline and won't appear in `stage.toDataURL()` exports

### State management

- `src/store/useCanvasStore.ts` — **the central store**: elements, connections, selection, stageConfig (scale/x/y), undo/redo stack (50 steps), active tool, inpainting transient state. Persisted via a throttled localStorage adapter (300ms debounce, flush on `beforeunload`). Undo coalesces same-key updates within 500ms.
- `src/store/useSettingsStore.ts` — API keys and per-provider config (persisted)
- `src/store/useGenerationHistoryStore.ts` — cross-session generation log entries (persisted)
- `src/store/useGenerationQueueStore.ts` — transient in-flight generation queue
- `src/store/useAssetLibraryStore.ts` — uploaded/generated asset catalog (persisted, separate key)
- `src/store/usePromptLibraryStore.ts` — built-in + user prompt presets (persisted)

### AI gateway

`src/services/gateway/` — provider abstraction layer. Each provider implements the `GatewayProvider` interface (`types.ts`). The registry (`index.ts`) holds a static `PROVIDERS[]` array. Adding a new vendor = one new file under `providers/` + one import + push. Currently: `T8StarProvider` (sync), `RunningHubProvider` (async, with `pollImageTask` for cross-session resume).

Generation flow: `runOneSlot` in `src/services/imageGeneration.ts` → replace node with `AIGeneratingElement` placeholder → call `generateImageByModelId` → on success, `replacePlaceholderWithImage` atomically swaps placeholder for result node (preserving connections via `replaceElement`). Async providers write `pendingTask` to the placeholder; `taskResume.ts` polls on startup and every 3 minutes.

### Element types and connections

`src/types/canvas.ts` — 7 concrete types (`rectangle`, `circle`, `text`, `image`, `sticky`, `video`, `audio`, `file`) + `aigenerating` placeholder. Connections use typed ports (`DataType`: `any` | `text` | `image` | `video` | `audio`); `any` ports accept all types. Cycles are prevented via DFS. Bezier curves rendered with double-stroke ink effect. `replaceElement` is the atomic in-place swap (critical for preserving connections during generation).

### File storage

Files >1MB route to IndexedDB (`src/services/fileStorage.ts`) instead of localStorage. `FileElement.persistence` is either `'data'` (small, inline) or `'blob'` (IndexedDB key). A v6→v7 migration in the persist middleware auto-migrates existing large files on load. Broken blobs render a "file lost, click to re-upload" placeholder.

### Path alias

`@/*` resolves to project root (`./*`), configured in both `tsconfig.json` paths and `vite.config.ts` resolve alias.

## Key patterns

- **`stageRegistry`** (`src/utils/stageRegistry.ts`) — singleton holding the active Konva Stage reference. Export utilities and anything needing `stage.toDataURL()` read it rather than prop-drilling.
- **`flowResolver`** (`src/services/flowResolver.ts`) — walks upstream connections from a node's prompt input port, collects all text node content and reference images for AI generation.
- **Undo labels** use Chinese strings (e.g., `'移动 3 个元素'`, `'批量生成'`). The `typeLabelMap` in canvasStore maps element types to Chinese.
- **CSS token system** — `--bg-0/1/2` (background layers), `--ink-0/1/2` (foreground/text), `--accent`, `--line-1`, `--grid-dot`, `--r-sm/md/lg/pill` (border radii), `--shadow-ink-2`. Light/dark via `data-theme` attribute. Warm Paper Studio aesthetic: cream paper, serif wordmark, terracotta accent, ink-line connections.

## Constraints

- No test suite exists yet. Type-checking (`npm run lint`) is the only automated check.
- `Html`-overlay nodes (text, sticky) are invisible to Konva's `toDataURL()` — PNG exports capture shapes and images only.
- Large data URLs in elements degrade localStorage performance; the throttled adapter mitigates but doesn't eliminate this. IndexedDB path is preferred for files >1MB.
- The `aigenerating` placeholder node type is transient — never persisted long-term; it either resolves to a concrete type or shows an error panel.
- API keys live in `useSettingsStore` (per-provider), read fresh per call via `ProviderRuntimeConfig` — providers must not cache them.
