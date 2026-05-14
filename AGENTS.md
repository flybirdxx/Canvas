# Project Instructions

This file provides context for AI assistants working on this project.

## Project Type: Node.js / React SPA

### Commands
- Install: `npm install`
- Dev: `npm run dev` (Vite dev server on :3000, binds 0.0.0.0)
- Build: `npm run build` (production build to `dist/`)
- Preview: `npm run preview`
- ESLint: `npm run lint:eslint`
- Type check: `npm run lint:tsc`
- Tests: `npm run test`

### Framework
Vite 6 + React 19 + TypeScript 5.8.

## Project Overview

**AI Canvas Pro (Warm Paper Studio)** is an infinite canvas for AI-assisted creative work. Users place nodes (`text`, `image`, `video`, `audio`, `sticky`, `rectangle`, `circle`, `file`, `omniscript`) on a Konva canvas, connect them with typed ports, and dispatch AI generation through a provider-agnostic gateway.

OmniScript is a video cover analysis tool. It accepts a video URL or an upstream video/file node and asks a video-capable LLM/provider to return three structured columns:
- 分段剧情概述 (`segments`)
- 结构化剧本 (`structuredScript`)
- 高光时刻 (`highlights`)

OmniScript is not a storyboard container. It must not create scene nodes, manage storyboard ordering, or participate in batch storyboard execution.

## Architecture

### Rendering Pipeline
- `src/App.tsx` — shell: grid background, chrome layers, keyboard shortcuts, blob migration runner.
- `src/components/canvas/InfiniteCanvas.tsx` — Konva Stage + Layer, pan/zoom/wheel, quick add, export marquee, drag-and-drop ingest.
- `src/components/canvas/CanvasElements.tsx` — renders `CanvasElement` variants.
- `src/components/canvas/nodes/OmniScriptNode.tsx` — DOM overlay node for video cover analysis.

### State Management
- `src/store/useCanvasStore.ts` — central persisted store, versioned migrations, throttled localStorage adapter.
- `src/store/migrations.ts` — schema migrations. Version 11 converts legacy `script` to `omniscript` and legacy `scene` to `text`.
- `src/store/portDefaults.ts` — single source of truth for element ports.

### AI Gateway
- `src/services/gateway/` — provider abstraction layer.
- `TextGenRequest` supports optional multimodal video context (`videoUrl`, `videoDataUrl`, `videoFileRef`).
- Providers that do not support video understanding must return a clear structured error instead of fake analysis.
- `src/services/omniscript.ts` — OmniScript prompt, JSON parser, and video analysis orchestration.

### Element Types
- Concrete types: `rectangle`, `circle`, `text`, `image`, `sticky`, `video`, `audio`, `file`, `omniscript`.
- Special transient type: `aigenerating`.
- Connections use typed ports: `any`, `text`, `image`, `video`, `audio`.

### Execution Engine
- `src/services/executionEngine.ts` uses Kahn topological sort and handles image/video/audio generation.
- Text, sticky, shape, file, and OmniScript nodes are non-generative in the execution graph.
- `scene` and `script` execution paths no longer exist.

### Flow Resolution
- `src/utils/flowResolver.ts` collects upstream text from text/sticky/media prompt nodes and OmniScript analysis results.
- `getUpstreamImageContributions` collects image nodes and image files only.

## Design Language

Warm Paper Studio aesthetic:
- Cream paper background, serif wordmark, terracotta accent, ink-line connections.
- CSS tokens live in theme stylesheets (`--bg-*`, `--ink-*`, `--accent`, `--line-*`, `--shadow-*`, font tokens).
- Use Chinese UI labels and undo labels unless a product/tool name is intentionally English (for example, OmniScript).

## Guidelines

- Read relevant upstream/downstream code before changing behavior.
- Keep changes focused and update all affected call sites in the same change.
- All element types must have port templates in `src/store/portDefaults.ts`.
- When adding an element type, update `types/canvas.ts`, `portDefaults.ts`, store migration/default creation, and `CanvasElements.tsx`.
- API keys live in `useSettingsStore`; providers must read fresh runtime config per call.
- Always run `npm run lint:tsc` and the relevant tests after code changes.
