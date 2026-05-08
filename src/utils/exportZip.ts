/**
 * ZIP export utility for the canvas.
 *
 * Data flow:
 *   canvasStore.getState() → canvasToJson() → JSZip.addFile("canvas.json")
 *   elements → collectAssets() → fetch → JSZip.addFile("assets/...")
 *   manifest → JSZip.addFile("manifest.json")
 *   JSZip.generateAsync({ type: "blob" }) → download
 *
 * ZIP structure:
 *   canvas-export-{timestamp}/
 *   ├── canvas.json        — full canvas config
 *   ├── manifest.json      — node/connection counts + skipped files
 *   ├── src-map.json       — element ID → asset path mapping
 *   ├── assets/            — image/video/audio/file blobs
 *   └── thumbnails/        — per-node Konva screenshots
 */
import JSZip from 'jszip';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { CanvasElement, Connection } from '@/types/canvas';
import type { GroupRecord } from '@/store/useCanvasStore';
import { readBlob } from '@/services/fileStorage';
import type { FileElement } from '@/types/canvas';

const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5 MB

function timestampPrefix(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Options for ZIP export */
export interface ExportZipOptions {
  includeAiData: boolean;
  includeConnections: boolean;
}

/** Progress callback: (phase, processed, total) => void */
export type ProgressCallback = (phase: 'assets' | 'thumbnails' | 'generating', processed: number, total: number) => void;

interface SrcMapEntry {
  elementId: string;
  zipPath: string | null; // null = skipped / kept-as-URL
  reason?: string;
}

/**
 * AC2: Serialize canvas elements + connections + groups into a canvas.json structure.
 * AC2 (AI metadata): When includeAiData=false, strips prompt, generation, error,
 *   pendingTask, inheritedVersions, inheritedPrompt, and versions from all elements.
 */
function canvasToJson(
  elements: CanvasElement[],
  connections: Connection[],
  groups: GroupRecord[],
  opts: ExportZipOptions,
) {
  const stripAiFields = (el: any): any => {
    const {
      prompt, generation, error, pendingTask,
      inheritedVersions, inheritedPrompt, versions,
      ...rest
    } = el;
    return rest;
  };

  const elemsToSave = opts.includeAiData
    ? elements
    : elements.map((el: any) => stripAiFields(el));

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    elements: elemsToSave,
    connections: opts.includeConnections ? connections : [],
    groups,
  };
}

/**
 * AC2: Generate manifest.json.
 */
function createManifest(
  elements: CanvasElement[],
  connections: Connection[],
  skippedFiles: { filename: string; reason: string }[],
) {
  return {
    exportedAt: new Date().toISOString(),
    nodeCount: elements.length,
    connectionCount: connections.length,
    skippedFiles,
  };
}

interface AssetEntry {
  zipPath: string;
  blob: Blob;
  label: string;
  elementId: string;
}

function getExtension(src: string, el: CanvasElement): string {
  const mimeMatch = src.match(/^data:([^;]+);/);
  if (mimeMatch) {
    const fromMime: Record<string, string> = {
      'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
      'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg',
      'video/mp4': 'mp4', 'video/webm': 'webm',
      'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg',
    };
    if (fromMime[mimeMatch[1]]) return fromMime[mimeMatch[1]];
  }
  const urlMatch = src.match(/\.(png|jpe?g|gif|webp|svg|mp4|webm|mp3|wav|ogg)(\?|$)/i);
  if (urlMatch) return urlMatch[1].toLowerCase();
  if (el.type === 'image') return 'png';
  if (el.type === 'video') return 'mp4';
  if (el.type === 'audio') return 'mp3';
  return 'bin';
}

/**
 * Convert a data URL to a Blob synchronously — no fetch needed.
 */
function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return null;
    const meta = dataUrl.slice(0, commaIdx);
    const b64 = dataUrl.slice(commaIdx + 1);
    // Handle both standard and URL-safe base64
    const binary = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const mimeMatch = meta.match(/data:([^;]+)/);
    const type = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    return new Blob([bytes], { type });
  } catch {
    return null;
  }
}

async function resolveSrcToBlob(src: string, el: CanvasElement): Promise<Blob | null> {
  // Data URLs — parse synchronously, no network
  if (src.startsWith('data:')) {
    return dataUrlToBlob(src);
  }

  // Blob URLs — fetch to get a reusable Blob
  if (src.startsWith('blob:')) {
    try {
      const resp = await fetch(src);
      if (!resp.ok) return null;
      return resp.blob();
    } catch {
      return null;
    }
  }

  // File elements with IndexedDB keys
  if (el.type === 'file') {
    const fileEl = el as FileElement;
    if (fileEl.blobKey) {
      const dataUrl = await readBlob(fileEl.blobKey);
      if (dataUrl) return dataUrlToBlob(dataUrl);
    }
    return null;
  }

  // Remote URLs
  try {
    const resp = await fetch(src, { mode: 'cors' });
    if (!resp.ok) return null;
    return resp.blob();
  } catch {
    return null;
  }
}

/**
 * Collect all src-bearing elements, resolve to Blobs, produce a src-map.
 * Large files (>5MB) are skipped and recorded in the manifest.
 */
async function collectAssets(
  elements: CanvasElement[],
  onProgress?: ProgressCallback,
): Promise<{
  assets: AssetEntry[];
  skippedFiles: { filename: string; reason: string }[];
  srcMap: SrcMapEntry[];
}> {
  const assets: AssetEntry[] = [];
  const skippedFiles: { filename: string; reason: string }[] = [];
  const srcMap: SrcMapEntry[] = [];
  const total = elements.length;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const src = 'src' in el ? el.src : undefined;

    const entry: SrcMapEntry = { elementId: el.id, zipPath: null };

    if (!src) {
      srcMap.push(entry);
      onProgress?.('assets', i + 1, total);
      continue;
    }

    const ext = getExtension(src, el);
    const label = `${el.type}-${el.id.slice(0, 8)}`;
    const zipPath = `assets/${label}.${ext}`;

    // Estimate inline data URL size before fetching
    const estimatedSize = src.startsWith('data:')
      ? (src.length - src.indexOf(',') - 1) * 0.75
      : 0;

    if (estimatedSize > LARGE_FILE_THRESHOLD) {
      skippedFiles.push({ filename: zipPath, reason: '超过 5 MB 阈值，跳过' });
      entry.reason = 'size-limit';
      srcMap.push(entry);
      onProgress?.('assets', i + 1, total);
      continue;
    }

    try {
      const blob = await resolveSrcToBlob(src, el);
      if (!blob) {
        const reason = src.startsWith('blob:')
          ? 'blob URL 已失效（原始对象可能已被回收），保留 URL'
          : '无法下载，保留 URL';
        skippedFiles.push({ filename: zipPath, reason });
        entry.reason = src.startsWith('blob:') ? 'blob-dead' : 'download-failed';
        srcMap.push(entry);
      } else if (blob.size > LARGE_FILE_THRESHOLD) {
        skippedFiles.push({ filename: zipPath, reason: '超过 5 MB 阈值，跳过' });
        entry.reason = 'size-limit';
        srcMap.push(entry);
      } else {
        assets.push({ zipPath, blob, label, elementId: el.id });
        entry.zipPath = zipPath;
        srcMap.push(entry);
      }
    } catch {
      skippedFiles.push({ filename: zipPath, reason: '下载失败，保留 URL' });
      entry.reason = 'download-failed';
      srcMap.push(entry);
    }

    onProgress?.('assets', i + 1, total);
  }

  return { assets, skippedFiles, srcMap };
}

/**
 * Generate PNG thumbnails for each element from the Konva stage.
 */
export async function generateThumbnails(
  elements: CanvasElement[],
  stageRef: { current: any } | null,
  stageScale: number,
  onProgress?: ProgressCallback,
): Promise<{ zipPath: string; blob: Blob; skipped: boolean }[]> {
  const stage = stageRef?.current ?? null;
  if (!stage) return [];

  const results: { zipPath: string; blob: Blob; skipped: boolean }[] = [];
  const total = elements.length;
  const stageX = stage.x();
  const stageY = stage.y();

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const zipPath = `thumbnails/node-${el.id.slice(0, 8)}.png`;

    try {
      const sx = stageX + el.x * stageScale;
      const sy = stageY + el.y * stageScale;
      const sw = el.width * stageScale;
      const sh = el.height * stageScale;
      if (sw <= 0 || sh <= 0) {
        results.push({ zipPath, blob: new Blob(), skipped: true });
        onProgress?.('thumbnails', i + 1, total);
        continue;
      }

      // Stage toDataURL is synchronous but wrapped in try/catch for WebGL context loss
      const dataUrl = stage.toDataURL({
        x: sx, y: sy, width: sw, height: sh,
        pixelRatio: 1, mimeType: 'image/png',
      });

      const blob = dataUrlToBlob(dataUrl);
      if (blob) {
        results.push({ zipPath, blob, skipped: false });
      } else {
        results.push({ zipPath, blob: new Blob(), skipped: true });
      }
    } catch {
      // WebGL context loss or other render failure — skip non-fatally
      results.push({ zipPath, blob: new Blob(), skipped: true });
    }

    onProgress?.('thumbnails', i + 1, total);
  }

  return results;
}

/**
 * Main export function.
 */
export async function exportZip(
  opts: ExportZipOptions,
  stageRef: { current: any } | null,
  onProgress?: ProgressCallback,
): Promise<void> {
  const state = useCanvasStore.getState();
  const { elements, connections, groups } = state;

  // Capture timestamp once for both folder and filename
  const ts = timestampPrefix();
  const total = elements.length;

  onProgress?.('assets', 0, total);

  const zip = new JSZip();
  const folder = zip.folder(`canvas-export-${ts}`)!;

  // canvas.json (AC2)
  const json = canvasToJson(elements, connections, groups, opts);
  folder.file('canvas.json', JSON.stringify(json, null, 2));

  // assets + src-map (AC3)
  const { assets, skippedFiles, srcMap } = await collectAssets(elements, onProgress);
  for (const { zipPath, blob } of assets) {
    folder.file(zipPath, blob);
  }
  folder.file('src-map.json', JSON.stringify({ version: 1, mappings: srcMap }, null, 2));

  // thumbnails (AC2)
  const thumbnails = await generateThumbnails(
    elements, stageRef, state.stageConfig.scale,
    (phase, p, t) => onProgress?.('thumbnails', p, t),
  );
  for (const { zipPath, blob, skipped } of thumbnails) {
    if (!skipped) folder.file(zipPath, blob);
  }

  // manifest (AC2)
  const manifest = createManifest(elements, connections, skippedFiles);
  folder.file('manifest.json', JSON.stringify(manifest, null, 2));

  // Report 100% for assets+thumbnail phase before generating the ZIP blob
  onProgress?.('generating', 1, 1);

  const blob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (metadata) => onProgress?.('generating', metadata.percent, 100),
  );

  downloadBlob(blob, `canvas-export-${ts}.zip`);
}
