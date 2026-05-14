# AI Canvas Pro PRD

AI Canvas Pro is an infinite canvas for AI-assisted creative work. The product focuses on node-based multimodal generation, reusable asset workflows, and OmniScript video cover analysis.

## Current Product Scope

- Infinite canvas with pan, zoom, node selection, grouping, alignment, and export.
- Typed node graph for text, image, video, audio, file, shape, sticky note, and OmniScript nodes.
- Provider-agnostic AI gateway for image/video/text-capable models.
- Cross-session async task resume for provider jobs that return pending task IDs.
- Local persistence with IndexedDB fallback for large files.
- OmniScript: video cover analysis and rewriting reference tool. It returns three columns: segmented plot summary, structured script, and highlights.

## Out Of Scope

- Storyboard view.
- Scene/script nodes.
- Automatic storyboard splitting, ordering, batch scene execution, or scene MP4 export.

## OmniScript Requirements

1. Users can create an OmniScript node on the canvas.
2. Users can paste a video URL or connect an upstream video/file node.
3. The node calls a provider that supports video understanding.
4. Providers without video understanding return a clear unsupported error.
5. The node displays `segments`, `structuredScript`, and `highlights` without inventing fallback analysis.
