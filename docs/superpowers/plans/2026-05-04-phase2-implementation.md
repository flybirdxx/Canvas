# Phase 2 补齐实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Phase 2 中的三项改进：2.1 大文件 IndexedDB 存储、2.3 生成体验优化（历史面板 + 批量生成 + 费用预估）、2.4 导出增强（SVG / PDF / 网页）。

**Architecture:** 三项独立并行。2.1 添加 IndexedDB 存储层 + 混合持久化适配器，2.3 新增组件（历史面板/批量工具栏）+ 内联价格徽章，2.4 扩展现有导出工具。

**Tech Stack:** React 19, TypeScript 5.8, Zustand 5, Konva 10, TailwindCSS 4, idb (IndexedDB), jsPDF

---

## A. 大文件存储升级 (2.1)

### Task A1: Create IndexedDB storage service

**Files:**
- Create: `src/services/fileStorage.ts`

- [ ] **Step 1: Write the IndexedDB wrapper**

```typescript
// src/services/fileStorage.ts
const DB_NAME = 'ai-canvas-blobs';
const BLOB_STORE = 'blobs';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Store a data URL as a blob under `key`. Returns the key. */
export async function storeBlob(key: string, dataUrl: string): Promise<string> {
  const db = await openDb();
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readwrite');
    tx.objectStore(BLOB_STORE).put(blob, key);
    tx.oncomplete = () => { db.close(); resolve(key); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Retrieve a blob by key, return as data URL. */
export async function readBlob(key: string): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readonly');
    const req = tx.objectStore(BLOB_STORE).get(key);
    req.onsuccess = () => {
      const blob = req.result as Blob | undefined;
      if (!blob) { db.close(); resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => { db.close(); resolve(reader.result as string); };
      reader.onerror = () => { db.close(); reject(reader.error); };
      reader.readAsDataURL(blob);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/** Delete a blob by key. */
export async function deleteBlob(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction(BLOB_STORE, 'readwrite');
    tx.objectStore(BLOB_STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); resolve(); };
  });
}

/** Generate a small storage key from an element id + timestamp. */
export function blobKey(elementId: string): string {
  return `${elementId}_${Date.now()}`;
}

/** Threshold: files > 1MB use IndexedDB. */
export const BLOB_THRESHOLD_BYTES = 1 * 1024 * 1024;
```

- [ ] **Step 2: Commit**

```bash
git add src/services/fileStorage.ts
git commit -m "feat: add IndexedDB blob storage service"
```

### Task A2: Extend FileElement type

**Files:**
- Modify: `src/types/canvas.ts`

- [ ] **Step 1: Update FileElement.persistence type**

In `src/types/canvas.ts`, find the `FileElement` interface and change:

```typescript
// Old:
persistence: 'data';

// New:
persistence: 'data' | 'blob';
```

Also add `blobKey?: string` field:

```typescript
export interface FileElement extends BaseElement {
  type: 'file';
  name: string;
  mimeType: string;
  sizeBytes: number;
  src: string;
  persistence: 'data' | 'blob';
  /** IndexedDB key when persistence === 'blob'. Used for re-hydration. */
  blobKey?: string;
  thumbnailDataUrl?: string;
  durationMs?: number;
  pageCount?: number;
}
```

- [ ] **Step 2: Add blob store version migration**

In `src/store/useCanvasStore.ts`, add a v6→v7 migration in the `migrate` function:

```typescript
// v6 -> v7: blob persistence migration.
// FileElements with sizeBytes > BLOB_THRESHOLD get migrated to IndexedDB.
// This runs synchronously in the migrate callback, so we schedule the
// actual async blob writes via a side channel. Elements that can't be
// migrated remain on 'data' persistence (graceful degradation).
if (version < 7 && persistedState && Array.isArray(persistedState.elements)) {
  const toMigrate: Array<{ id: string; dataUrl: string }> = [];
  persistedState.elements.forEach((el: any) => {
    if (el?.type === 'file' && el?.persistence === 'data' && el?.src && el?.sizeBytes > 1 * 1024 * 1024) {
      toMigrate.push({ id: el.id, dataUrl: el.src });
    }
  });
  if (toMigrate.length > 0) {
    // Queue migration for after rehydration. We attach to the window so
    // the App component can pick it up and run the async blob stores.
    (window as any).__canvasBlobMigration = toMigrate;
  }
}
```

And bump the persist version from 6 to 7:

```typescript
version: 7,
```

- [ ] **Step 3: Add migration runner in App.tsx**

In `src/App.tsx`, add a `useEffect` to process the migration queue:

```typescript
import { storeBlob, blobKey } from './services/fileStorage';
import { useCanvasStore } from './store/useCanvasStore';

// Add inside App component:
useEffect(() => {
  const queue = (window as any).__canvasBlobMigration as Array<{ id: string; dataUrl: string }> | undefined;
  if (!queue || queue.length === 0) return;
  delete (window as any).__canvasBlobMigration;

  queue.forEach(async ({ id, dataUrl }) => {
    try {
      const key = blobKey(id);
      await storeBlob(key, dataUrl);
      const el = useCanvasStore.getState().elements.find(e => e.id === id);
      if (el && el.type === 'file') {
        useCanvasStore.getState().updateElement(id, {
          persistence: 'blob',
          blobKey: key,
          // Replace src with a tiny placeholder so localStorage stays small.
          // The full data URL is in IndexedDB.
          src: '',
        } as Partial<typeof el>);
      }
    } catch (err) {
      console.warn(`[migration] blob store failed for ${id}, keeping data`, err);
    }
  });
}, []);
```

- [ ] **Step 4: Commit**

```bash
git add src/types/canvas.ts src/store/useCanvasStore.ts src/App.tsx
git commit -m "feat: extend FileElement for blob persistence + auto-migration"
```

### Task A3: Update fileIngest to route large files to IndexedDB

**Files:**
- Modify: `src/services/fileIngest.ts`

- [ ] **Step 1: Route large files to blob storage**

In `buildFileElement`, after reading the data URL, check size:

```typescript
import { storeBlob, blobKey, BLOB_THRESHOLD_BYTES } from './fileStorage';

// In buildFileElement, after `const dataUrl = await readFileAsDataUrl(file);`
// and before constructing the element:

let src: string;
let persistence: 'data' | 'blob' = 'data';
let blobStorageKey: string | undefined;

if (file.size > BLOB_THRESHOLD_BYTES) {
  try {
    blobStorageKey = blobKey(uuidv4());
    await storeBlob(blobStorageKey, dataUrl);
    persistence = 'blob';
    src = ''; // never put large data URL in localStorage
  } catch (err) {
    console.warn('[fileIngest] blob store failed, falling back to data', err);
    persistence = 'data';
    src = dataUrl;
  }
} else {
  src = dataUrl;
}
```

Then update the element constructor:

```typescript
const el: FileElement = {
  // ... other fields unchanged
  src,
  persistence,
  ...(blobStorageKey ? { blobKey: blobStorageKey } : {}),
  // ... rest unchanged
};
```

- [ ] **Step 2: Commit**

```bash
git add src/services/fileIngest.ts
git commit -m "feat: route large file uploads to IndexedDB"
```

### Task A4: Add broken-attachment state to CanvasElements

**Files:**
- Modify: `src/components/canvas/CanvasElements.tsx`

- [ ] **Step 1: Add blob rehydration on mount**

In the `FileElement` rendering branch, when `el.persistence === 'blob'` and `!el.src`, hydrate from IndexedDB:

```typescript
// Inside the file element rendering logic, add:
import { readBlob } from '../../services/fileStorage';

// useEffect inside the file render path:
const [blobSrc, setBlobSrc] = useState<string | null>(
  el.persistence === 'data' ? el.src : null
);
const [blobFailed, setBlobFailed] = useState(false);

useEffect(() => {
  if (el.persistence === 'blob' && el.blobKey && !blobSrc && !blobFailed) {
    readBlob(el.blobKey).then((dataUrl) => {
      if (dataUrl) setBlobSrc(dataUrl);
      else setBlobFailed(true);
    }).catch(() => setBlobFailed(true));
  }
}, [el.blobKey, el.persistence]);
```

- [ ] **Step 2: Render broken-attachment placeholder**

When `blobFailed` is true, show a replacement card:

```tsx
if (blobFailed) {
  return (
    <Group>
      <Rect width={el.width} height={el.height} fill="var(--bg-2)" cornerRadius={12} stroke="var(--line-1)" strokeWidth={1} />
      <Html divProps={{ style: { pointerEvents: 'none' } }}>
        <div style={{ ...POLAROID_STYLE, width: el.width, height: el.height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)', gap: 4 }}>
          <Upload style={{ width: 22, height: 22, color: 'var(--ink-3)' }} />
          <span style={{ fontSize: 11 }}>附件已丢失</span>
          <span style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>点此重传</span>
        </div>
      </Html>
    </Group>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/CanvasElements.tsx
git commit -m "feat: add broken-attachment state for blob files"
```

### Task A5: Add blob cleanup on element delete

**Files:**
- Modify: `src/store/useCanvasStore.ts`

- [ ] **Step 1: Clean up IndexedDB on delete**

In `deleteElements`, before returning the new state, add blob cleanup:

```typescript
import { deleteBlob } from '../services/fileStorage';

deleteElements: (ids) => set((state) => {
  const nextElements = state.elements.filter((el) => !ids.includes(el.id));
  
  // Clean up IndexedDB blobs for deleted file elements.
  state.elements.forEach((el) => {
    if (ids.includes(el.id) && el.type === 'file') {
      const fileEl = el as import('../types/canvas').FileElement;
      if (fileEl.persistence === 'blob' && fileEl.blobKey) {
        deleteBlob(fileEl.blobKey).catch(() => {});
      }
    }
  });

  const nextConnections = state.connections.filter(
    (conn) => !ids.includes(conn.fromId) && !ids.includes(conn.toId)
  );
  return {
    past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
    future: [],
    elements: nextElements,
    connections: nextConnections,
    selectedIds: state.selectedIds.filter((id) => !ids.includes(id)),
    currentLabel: `删除 ${ids.length} 个元素`,
    currentTimestamp: Date.now(),
    _coalesceKey: undefined,
    _coalesceAt: undefined,
  };
}),
```

- [ ] **Step 2: Commit**

```bash
git add src/store/useCanvasStore.ts
git commit -m "feat: clean up IndexedDB blobs on element delete"
```

---

## B. 生成体验优化 (2.3)

### Task B1: Create generation history store

**Files:**
- Create: `src/store/useGenerationHistoryStore.ts`

- [ ] **Step 1: Write the store**

```typescript
// src/store/useGenerationHistoryStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface GenHistoryEntry {
  id: string;
  /** Which element this generation produced (image/video node id). */
  elementId: string;
  /** Prompt used. */
  prompt: string;
  /** Model wire-level id. */
  model: string;
  /** Thumbnail data URL (or the result image URL itself). */
  thumbnailUrl: string;
  /** Result URLs (usually one). */
  resultUrls: string[];
  modality: 'image' | 'video';
  /** epoch ms. */
  createdAt: number;
}

interface GenHistoryState {
  entries: GenHistoryEntry[];
  addEntry: (entry: GenHistoryEntry) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
}

export const useGenerationHistoryStore = create<GenHistoryState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) => set((s) => ({
        entries: [{ ...entry, createdAt: Date.now() }, ...s.entries].slice(0, 200),
      })),
      removeEntry: (id) => set((s) => ({
        entries: s.entries.filter((e) => e.id !== id),
      })),
      clearAll: () => set({ entries: [] }),
    }),
    {
      name: 'ai-canvas-gen-history',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ entries: s.entries }),
    },
  ),
);
```

- [ ] **Step 2: Integrate into imageGeneration.ts**

In `src/services/imageGeneration.ts`, import the history store and call `addEntry` on success:

```typescript
import { useGenerationHistoryStore } from '../store/useGenerationHistoryStore';

// Inside replacePlaceholderWithImage, after the asset library archive step, add:
useGenerationHistoryStore.getState().addEntry({
  id: uuidv4(),
  elementId: newElement.id,
  prompt,
  model: '', // populated by caller — see below
  thumbnailUrl: imageUrl,
  resultUrls: [imageUrl],
  modality: 'image',
  createdAt: Date.now(),
});
```

To get the model id into `replacePlaceholderWithImage`, add an optional `model?: string` parameter:

```typescript
export function replacePlaceholderWithImage(
  placeholderId: string,
  imageUrl: string,
  prompt: string,
  model?: string, // NEW
) {
  // ... existing code ...
  
  useGenerationHistoryStore.getState().addEntry({
    id: uuidv4(),
    elementId: newElement.id,
    prompt,
    model: model || '',
    thumbnailUrl: imageUrl,
    resultUrls: [imageUrl],
    modality: 'image',
    createdAt: Date.now(),
  });
}
```

Update the call site in `runOneSlot`:

```typescript
replacePlaceholderWithImage(placeholderId, url, request.prompt, request.model);
```

Update the call site in `taskResume.ts` too (pass the model from pendingTask request):

```typescript
replacePlaceholderWithImage(placeholderId, url, pendingReq.prompt, pendingReq.model);
```

- [ ] **Step 3: Commit**

```bash
git add src/store/useGenerationHistoryStore.ts src/services/imageGeneration.ts src/services/taskResume.ts
git commit -m "feat: add generation history store + integration"
```

### Task B2: Create GenerationHistoryPanel component

**Files:**
- Create: `src/components/GenerationHistoryPanel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the panel component**

```typescript
// src/components/GenerationHistoryPanel.tsx
import { ImageIcon, Video, MapPin, X, Clock } from 'lucide-react';
import { useGenerationHistoryStore, GenHistoryEntry } from '../store/useGenerationHistoryStore';
import { useCanvasStore } from '../store/useCanvasStore';

export function GenerationHistoryPanel() {
  const entries = useGenerationHistoryStore(s => s.entries);
  const removeEntry = useGenerationHistoryStore(s => s.removeEntry);
  const clearAll = useGenerationHistoryStore(s => s.clearAll);
  const setSelection = useCanvasStore(s => s.setSelection);
  const elements = useCanvasStore(s => s.elements);

  if (entries.length === 0) return null;

  return (
    <div
      className="z-30 pointer-events-auto select-none anim-fade-in"
      style={{
        position: 'absolute',
        bottom: 48,
        right: 312,
        width: 280,
        maxHeight: 'calc(100vh - 300px)',
      }}
    >
      <div
        className="chip-paper flex flex-col overflow-hidden"
        style={{ boxShadow: 'var(--shadow-ink-2)' }}
      >
        <div
          className="flex items-center justify-between"
          style={{ padding: '8px 12px', borderBottom: '1px solid var(--line-1)' }}
        >
          <span className="serif" style={{ fontSize: 12.5, fontWeight: 500 }}>
            生成历史
          </span>
          <button
            onClick={clearAll}
            className="btn btn-ghost"
            style={{ padding: '2px 6px', fontSize: 10 }}
          >
            清空
          </button>
        </div>
        <div className="paper-scroll overflow-y-auto flex-1 min-h-0" style={{ maxHeight: 300 }}>
          {entries.slice(0, 50).map((entry) => (
            <HistoryRow
              key={entry.id}
              entry={entry}
              onLocate={() => {
                const live = elements.find(el => el.id === entry.elementId);
                if (live) setSelection([entry.elementId]);
              }}
              onRemove={() => removeEntry(entry.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function HistoryRow({
  entry,
  onLocate,
  onRemove,
}: {
  entry: GenHistoryEntry;
  onLocate: () => void;
  onRemove: () => void;
}) {
  const timeStr = new Date(entry.createdAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const promptShort = entry.prompt
    ? entry.prompt.slice(0, 40) + (entry.prompt.length > 40 ? '…' : '')
    : '(空)';

  return (
    <div
      className="flex items-center gap-2 hairline-b"
      style={{ padding: '6px 10px', cursor: 'default' }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          overflow: 'hidden',
          background: 'var(--bg-3)',
          flexShrink: 0,
        }}
      >
        <img
          src={entry.thumbnailUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1" style={{ fontSize: 10, color: 'var(--ink-2)' }}>
          {entry.modality === 'video' ? (
            <Video className="w-2.5 h-2.5" />
          ) : (
            <ImageIcon className="w-2.5 h-2.5" />
          )}
          <span className="mono truncate" style={{ maxWidth: 80 }}>{entry.model || '—'}</span>
          <span>·</span>
          <Clock className="w-2.5 h-2.5" />
          <span>{timeStr}</span>
        </div>
        <div className="truncate" style={{ fontSize: 11, lineHeight: 1.3 }}>
          {promptShort}
        </div>
      </div>
      <button onClick={onLocate} className="btn btn-ghost btn-icon" style={{ width: 22, height: 22, padding: 0 }} title="定位节点">
        <MapPin className="w-3 h-3" />
      </button>
      <button onClick={onRemove} className="btn btn-ghost btn-icon" style={{ width: 22, height: 22, padding: 0 }} title="移除记录">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add to App.tsx**

```typescript
import { GenerationHistoryPanel } from './components/GenerationHistoryPanel';
// Add alongside the other panels:
<GenerationHistoryPanel />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/GenerationHistoryPanel.tsx src/App.tsx
git commit -m "feat: add generation history panel"
```

### Task B3: Add cost estimation badge to NodeInputBar

**Files:**
- Modify: `src/components/NodeInputBar.tsx`

- [ ] **Step 1: Read NodeInputBar to find the generate button area**

Read the file and find the "生成" button. Add a cost badge right before it using `computeUnitPrice` from the gateway.

```typescript
import { findModel, computeUnitPrice } from '../services/gateway';

// Inside the component, compute pricing:
const unitPrice = useMemo(() => {
  const modelId = element.generation?.model;
  if (!modelId) return undefined;
  const found = findModel(modelId);
  if (!found) return undefined;
  const count = parseInt(String(element.generation?.count || '1'), 10) || 1;
  const unit = computeUnitPrice(found.model, {
    resolution: element.generation?.resolution,
    qualityLevel: element.generation?.qualityLevel,
  });
  if (!unit) return undefined;
  return { unit, total: { amount: unit.amount * count, currency: unit.currency } };
}, [element.generation?.model, element.generation?.resolution, element.generation?.qualityLevel, element.generation?.count]);

// Next to the generate button, render:
{unitPrice && (
  <span
    className="chip-meta mono"
    style={{
      fontSize: 9.5,
      padding: '2px 6px',
      background: 'var(--bg-3)',
      color: 'var(--ink-2)',
      borderRadius: 'var(--r-sm)',
    }}
    title={`单价 ${unitPrice.unit.currency}${unitPrice.unit.amount.toFixed(2)}`}
  >
    约 {unitPrice.total.currency}{unitPrice.total.amount.toFixed(2)}
  </span>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/NodeInputBar.tsx
git commit -m "feat: add inline cost estimation badge to NodeInputBar"
```

### Task B4: Add batch generation to InfiniteCanvas

**Files:**
- Modify: `src/components/canvas/InfiniteCanvas.tsx`

- [ ] **Step 1: Add batch generation toolbar**

When 2+ image/video nodes are selected, show a floating toolbar. Add after the AlignmentToolbar in App.tsx or as part of InfiniteCanvas.

In `InfiniteCanvas`, add a JSX block after the existing quick-add menu that renders when multiple image/video nodes are selected:

```typescript
// Add this import at top:
import { runGeneration, runVideoGeneration } from '../../services/imageGeneration';
import { findModel } from '../../services/gateway';

// Inside InfiniteCanvas, compute:
const batchTargets = useMemo(() => {
  if (selectedIds.length < 2) return [];
  return elements.filter(
    (el) =>
      selectedIds.includes(el.id) &&
      (el.type === 'image' || el.type === 'video') &&
      el.prompt?.trim(),
  );
}, [elements, selectedIds]);

// Render after the selection marquee and before closing the component:
{batchTargets.length >= 2 && (
  <div
    className="chip-paper absolute z-35 flex items-center gap-1.5 anim-fade-in"
    style={{
      top: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '4px 6px',
      borderRadius: 'var(--r-pill)',
      boxShadow: 'var(--shadow-ink-2)',
    }}
  >
    <span className="serif-it" style={{ fontSize: 11.5, paddingLeft: 4 }}>
      已选 {batchTargets.length} 个生成节点
    </span>
    <button
      className="btn btn-primary"
      style={{ padding: '5px 14px', fontSize: 11, borderRadius: 'var(--r-pill)' }}
      onClick={async () => {
        for (const target of batchTargets) {
          // Each runs independently. Replace anchor node with placeholder,
          // then call the existing runGeneration pipeline.
          for (const target of batchTargets) {
            const phId = uuidv4();
            const store = useCanvasStore.getState();
            store.replaceElement(target.id, {
              id: phId,
              type: 'aigenerating',
              x: target.x, y: target.y,
              width: target.width, height: target.height,
              inheritedVersions: (target as any).versions,
              inheritedPrompt: target.prompt,
            } as any, '批量生成');
            await runGeneration([phId], {
              model: target.generation!.model!,
              prompt: target.prompt!,
              size: `${target.width}x${target.height}`,
              aspect: target.generation?.aspect,
              resolution: target.generation?.resolution,
              qualityLevel: target.generation?.qualityLevel,
              n: 1,
              w: target.width,
              h: target.height,
              references: target.generation?.references,
            });
          }
        }
      }}
    >
      全部生成
    </button>
  </div>
)}
```

Add the following imports to the top of InfiniteCanvas.tsx:

```typescript
import { v4 as uuidv4 } from 'uuid';
import { runGeneration } from '../../services/imageGeneration';
```

- [ ] **Step 2: Commit**

```bash
git add src/services/batchGeneration.ts src/components/canvas/InfiniteCanvas.tsx
git commit -m "feat: add batch generation with progress tracking"
```

---

## C. 导出增强 (2.4)

### Task C1: Add SVG export

**Files:**
- Modify: `src/utils/exportPng.ts` → rename to `src/utils/exportFile.ts`

- [ ] **Step 1: Add SVG export function**

Create: `src/utils/exportSvg.ts`

```typescript
// src/utils/exportSvg.ts
import { getStage } from './stageRegistry';

export function exportSelectionAsSvg(): boolean {
  const stage = getStage();
  if (!stage) {
    alert('画布尚未就绪，无法导出。');
    return false;
  }

  // Konva doesn't natively export SVG with filters/shadows, so we
  // construct a minimal SVG from the element positions. For a proper
  // SVG, we use Konva's built-in toSVG() on a cloned stage subset.
  // Simpler approach: export the current viewport as SVG via toDataURL
  // with SVG mime... no, that's not how Konva works.
  //
  // Approach: Build SVG by serialising each Konva node.
  // Konva nodes have toObject() that returns a JSON representation,
  // but there's no built-in JSON→SVG converter.
  //
  // Practical approach: Use stage.toSVG() or stage.toDataURL({mimeType:'image/svg+xml'}).
  // Konva does NOT support SVG mimeType — it renders to canvas pixels only.
  //
  // Best-effort SVG: Render to PNG, embed in SVG as base64 image.
  // This preserves vector text overlays as raster — not ideal for pure
  // vector export, but acceptable for the "get me an SVG file" use case.

  const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${stage.width()}" height="${stage.height()}" viewBox="0 0 ${stage.width()} ${stage.height()}">
  <image width="${stage.width()}" height="${stage.height()}" xlink:href="${dataUrl}"/>
</svg>`;

  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `canvas-${Date.now()}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
```

- [ ] **Step 2: Add to ExportMenu**

In `src/components/ExportMenu.tsx`, add an SVG option:

```typescript
import { exportSelectionAsSvg } from '../utils/exportSvg';

// Add menu item:
<button onClick={() => exportSelectionAsSvg()}>
  导出为 SVG
</button>
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/exportSvg.ts src/components/ExportMenu.tsx
git commit -m "feat: add SVG export (PNG embedded in SVG)"
```

### Task C2: Add PDF export

**Files:**
- Create: `src/utils/exportPdf.ts`
- Modify: `src/components/ExportMenu.tsx`

- [ ] **Step 1: Install jsPDF**

```bash
npm install jspdf
```

- [ ] **Step 2: Write PDF export utility**

```typescript
// src/utils/exportPdf.ts
import { jsPDF } from 'jspdf';
import { getStage } from './stageRegistry';

export async function exportViewportAsPdf(): Promise<boolean> {
  const stage = getStage();
  if (!stage) {
    alert('画布尚未就绪');
    return false;
  }

  const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
  
  const pdf = new jsPDF({
    orientation: stage.width() > stage.height() ? 'landscape' : 'portrait',
    unit: 'px',
    format: [stage.width(), stage.height()],
  });

  pdf.addImage(dataUrl, 'PNG', 0, 0, stage.width(), stage.height());
  pdf.save(`canvas-${Date.now()}.pdf`);
  return true;
}

export async function exportSelectionAsPdf(): Promise<boolean> {
  const stage = getStage();
  if (!stage) {
    alert('画布尚未就绪');
    return false;
  }

  const dataUrl = stage.toDataURL({ 
    pixelRatio: 2, 
    mimeType: 'image/png',
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const imgWidth = pageWidth - margin * 2;
  const ratio = stage.width() / imgWidth;
  const imgHeight = stage.height() / ratio;

  pdf.addImage(dataUrl, 'PNG', margin, margin, imgWidth, Math.min(imgHeight, pageHeight - margin * 2));
  pdf.save(`canvas-${Date.now()}.pdf`);
  return true;
}
```

- [ ] **Step 3: Add to ExportMenu**

Add two new menu items for "导出为 PDF（视口）" and "导出为 PDF（A4）".

- [ ] **Step 4: Commit**

```bash
git add src/utils/exportPdf.ts src/components/ExportMenu.tsx
git commit -m "feat: add PDF export via jsPDF"
```

### Task C3: Add standalone HTML export

**Files:**
- Create: `src/utils/exportHtml.ts`
- Modify: `src/components/ExportMenu.tsx`

- [ ] **Step 1: Write HTML export utility**

```typescript
// src/utils/exportHtml.ts
import { useCanvasStore } from '../store/useCanvasStore';

export function exportAsStandaloneHtml(): boolean {
  const { elements, connections, stageConfig } = useCanvasStore.getState();
  
  // Serialize elements and connections as JSON, embed in a self-contained HTML.
  const canvasData = JSON.stringify({
    elements: elements.map(({ id, type, x, y, width, height, ...rest }) => ({
      id, type, x, y, width, height,
      ...(type === 'text' ? { text: (rest as any).text } : {}),
      ...(type === 'image' ? { src: (rest as any).src } : {}),
    })),
    connections,
    exportedAt: new Date().toISOString(),
  });

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Canvas Export — AI 画布 Pro</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #F5EFE4;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 40px;
    }
    .canvas-grid {
      display: grid;
      gap: 24px;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    }
    .card {
      background: #FFFFFF;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      overflow: hidden;
    }
    .card img { width: 100%; border-radius: 8px; margin-bottom: 8px; }
    .card .type { font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 4px; }
    .card .text { font-size: 14px; color: #333; line-height: 1.5; white-space: pre-wrap; }
    .card .meta { font-size: 10px; color: #bbb; margin-top: 8px; }
    h1 { font-size: 20px; font-weight: 600; color: #333; margin-bottom: 8px; }
    p.subtitle { font-size: 12px; color: #999; margin-bottom: 24px; }
  </style>
</head>
<body>
  <h1>AI 画布 Pro · Exported Canvas</h1>
  <p class="subtitle">导出时间：${new Date().toLocaleString('zh-CN')} · ${elements.length} 个节点 · ${connections.length} 条连线</p>
  <div class="canvas-grid">
    ${elements.map(el => {
      const card = [];
      card.push(`<div class="card">`);
      card.push(`<div class="type">${el.type}</div>`);
      if (el.type === 'image' && (el as any).src) {
        card.push(`<img src="${(el as any).src}" alt="" />`);
      }
      if (el.type === 'text' && (el as any).text) {
        card.push(`<div class="text">${escapeHtml((el as any).text)}</div>`);
      }
      card.push(`<div class="meta">ID: ${el.id.slice(0,8)} · ${el.width}×${el.height}</div>`);
      card.push(`</div>`);
      return card.join('\n');
    }).join('\n')}
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `canvas-export-${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
```

- [ ] **Step 2: Add to ExportMenu**

Add "导出为网页 (HTML)" menu item.

- [ ] **Step 3: Commit**

```bash
git add src/utils/exportHtml.ts src/components/ExportMenu.tsx
git commit -m "feat: add standalone HTML export"
```

### Task C4: Refactor ExportMenu to include all export options

**Files:**
- Modify: `src/components/ExportMenu.tsx`

- [ ] **Step 1: Ensure ExportMenu shows all 4 options**

Read the current ExportMenu and add missing entries so the menu shows:
1. 导出为 PNG (已有)
2. 导出为 SVG (Task C1)
3. 导出为 PDF (Task C2)
4. 导出为网页 (Task C3)

- [ ] **Step 2: Commit**

```bash
git add src/components/ExportMenu.tsx
git commit -m "feat: consolidate ExportMenu with all export formats"
```

---

## Implementation Order

Recommended order — stream can be parallelized but internal tasks are sequential:

1. **Stream A** (2.1): A1 → A2 → A3 → A4 → A5
2. **Stream B** (2.3): B1 → B2 → B3 → B4
3. **Stream C** (2.4): C1 → C2 → C3 → C4

Streams A/B/C can be implemented in parallel by separate subagents.
