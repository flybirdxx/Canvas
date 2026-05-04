import { v4 as uuidv4 } from 'uuid';
import type { FileElement } from '../types/canvas';
import { storeBlob, blobKey, BLOB_THRESHOLD_BYTES } from './fileStorage';

/**
 * 通用文件 → FileElement 适配层。两个入口共享同一套逻辑：
 *   1) ToolDock 的 "File / 文件" 菜单（显式走上传通道）
 *   2) InfiniteCanvas 拖放（任何 MIME）
 *
 * 设计决策：
 * - v1 只存 data URL，直接入 zustand persist。大文件会把 localStorage
 *   撑爆，已知取舍，v2 再换 blob URL / IndexedDB。
 * - 上传时按 MIME 分派"预览提取"：video 抓首帧、audio 手写波形、image
 *   走原图、pdf 尽量从 trailer 里扒 `/Count` 拿页数，无视觉预览。
 * - 所有提取都带超时 / 尺寸兜底：失败静默回落到通用附件卡，不阻断上传。
 * - 不做任何 provider / 生成管线的事 —— file 节点就是资料卡（image kind
 *   例外：在 store 里拿到 image output port，参与 AI 连线）。
 */

/** 视频首帧抓取：100MB 以上跳过，避免 decode 拖慢上传。 */
const VIDEO_THUMB_MAX_BYTES = 100 * 1024 * 1024;
/** 音频波形解码：50MB 以上跳过，WebAudio 全量解 PCM 消耗大。 */
const AUDIO_WAVEFORM_MAX_BYTES = 50 * 1024 * 1024;
/** PDF 扫描上限：8MB 内搜 `/Count`，超过直接不显示页数。 */
const PDF_SCAN_BYTES = 8 * 1024 * 1024;
/** 单次缩略图生成的兜底超时（防某些 codec 沉默卡住）。 */
const EXTRACT_TIMEOUT_MS = 10_000;

/**
 * MIME → 默认画布尺寸。调用方拿到后再叠加 (centerX - w/2, centerY - h/2)。
 *
 * image/video 拿得到真实原生比例时会被 buildFileElement 覆盖；只有提取
 * 失败或 audio/pdf/other 才命中这个 fallback。audio 有波形时走独立宽屏
 * 尺寸，不走这里；其它通用附件卡走 280×160（能容下大图标 + 两行文件名
 * + 元信息）。
 */
export function defaultSizeForMime(mimeType: string): { width: number; height: number } {
  const mt = (mimeType || '').toLowerCase();
  if (mt.startsWith('image/')) return { width: 320, height: 320 };
  if (mt.startsWith('video/')) return { width: 400, height: 240 };
  return { width: 280, height: 160 };
}

const IMAGE_MAX_WIDTH = 500;
const VIDEO_MAX_WIDTH = 500;
const VIDEO_THUMB_MAX_WIDTH = 480;
const AUDIO_WAVEFORM_WIDTH = 480;
const AUDIO_WAVEFORM_HEIGHT = 120;
const AUDIO_WAVEFORM_BUCKETS = 200;

function measureImageSize(dataUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth || 0;
      const nh = img.naturalHeight || 0;
      if (nw <= 0 || nh <= 0) { resolve(null); return; }
      let w = nw;
      let h = nh;
      if (w > IMAGE_MAX_WIDTH) {
        h = (IMAGE_MAX_WIDTH / w) * h;
        w = IMAGE_MAX_WIDTH;
      }
      resolve({ width: Math.round(w), height: Math.round(h) });
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * 视频首帧：用 blob URL 灌给 `<video>` 而不是 data URL —— 浏览器对 data
 * URL 的 seek 支持不稳定（Chromium 会忽略 seek 请求），blob 更可靠。
 * 策略：
 *   1. preload=metadata 拿 duration / videoWidth / videoHeight
 *   2. seek 到 0.1s（规避很多编码器的第一帧黑场）
 *   3. seeked 触发后 drawImage 到 canvas，toDataURL('image/jpeg', 0.8)
 *   4. 任何 error / timeout 一律 resolve(null)，让上层回落到通用卡
 */
async function extractVideoThumbnail(file: File): Promise<{
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  durationMs?: number;
} | null> {
  if (file.size > VIDEO_THUMB_MAX_BYTES) return null;
  const blobUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve) => {
      const video = document.createElement('video');
      video.muted = true;
      video.preload = 'metadata';
      video.playsInline = true;
      (video as any).crossOrigin = 'anonymous';
      let settled = false;
      const finish = (v: any) => {
        if (settled) return;
        settled = true;
        resolve(v);
      };
      const timer = window.setTimeout(() => finish(null), EXTRACT_TIMEOUT_MS);

      video.addEventListener('error', () => { window.clearTimeout(timer); finish(null); });
      video.addEventListener('loadedmetadata', () => {
        const dur = Number.isFinite(video.duration) ? video.duration : 0;
        // 短视频（<1s）别 seek 到 0.1，直接取首帧以免越界。
        const seekTo = dur > 1 ? 0.1 : Math.max(0, dur * 0.1);
        try { video.currentTime = seekTo; } catch { finish(null); }
      });
      video.addEventListener('seeked', () => {
        window.clearTimeout(timer);
        const vw = video.videoWidth || 0;
        const vh = video.videoHeight || 0;
        if (vw === 0 || vh === 0) { finish(null); return; }
        const scale = vw > VIDEO_THUMB_MAX_WIDTH ? VIDEO_THUMB_MAX_WIDTH / vw : 1;
        const tw = Math.round(vw * scale);
        const th = Math.round(vh * scale);
        const canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext('2d');
        if (!ctx) { finish(null); return; }
        try {
          ctx.drawImage(video, 0, 0, tw, th);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const durationMs = Math.round((video.duration || 0) * 1000);
          finish({
            dataUrl,
            widthPx: vw,
            heightPx: vh,
            durationMs: durationMs > 0 ? durationMs : undefined,
          });
        } catch {
          // canvas tainted or draw failed
          finish(null);
        }
      });
      video.src = blobUrl;
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * 音频波形：decodeAudioData 把整个文件解成 PCM，再按桶取绝对峰值。对 5MB
 * 级 mp3 大约 200–400ms，属于上传时一次性代价。波形图本身 480×120 的 PNG
 * 约 15–40KB，存进 thumbnailDataUrl 可接受。
 *
 * 视觉：暖纸底色 + 深墨竖条，和 Warm Paper Studio 主题一致，不是花哨的彩色。
 */
async function extractAudioWaveform(file: File): Promise<{
  dataUrl: string;
  durationMs?: number;
} | null> {
  if (file.size > AUDIO_WAVEFORM_MAX_BYTES) return null;
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  let ctx: AudioContext | null = null;
  try {
    const arrayBuf = await file.arrayBuffer();
    ctx = new Ctx();
    const audioBuf = await new Promise<AudioBuffer | null>((resolve) => {
      const timer = window.setTimeout(() => resolve(null), EXTRACT_TIMEOUT_MS);
      ctx!.decodeAudioData(
        arrayBuf.slice(0),
        (buf) => { window.clearTimeout(timer); resolve(buf); },
        () => { window.clearTimeout(timer); resolve(null); },
      );
    });
    if (!audioBuf) return null;

    const durationMs = Math.round(audioBuf.duration * 1000);
    const ch0 = audioBuf.getChannelData(0);
    const samples = ch0.length;
    const step = Math.max(1, Math.floor(samples / AUDIO_WAVEFORM_BUCKETS));
    const peaks: number[] = new Array(AUDIO_WAVEFORM_BUCKETS).fill(0);
    for (let i = 0; i < AUDIO_WAVEFORM_BUCKETS; i++) {
      let max = 0;
      const start = i * step;
      const end = Math.min(start + step, samples);
      for (let j = start; j < end; j++) {
        const v = Math.abs(ch0[j]);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    let maxPeak = 0;
    for (const p of peaks) if (p > maxPeak) maxPeak = p;
    if (maxPeak === 0) maxPeak = 0.001;

    const canvas = document.createElement('canvas');
    const cw = AUDIO_WAVEFORM_WIDTH;
    const chH = AUDIO_WAVEFORM_HEIGHT;
    canvas.width = cw;
    canvas.height = chH;
    const cctx = canvas.getContext('2d');
    if (!cctx) return null;

    cctx.fillStyle = '#F5EFE4';
    cctx.fillRect(0, 0, cw, chH);
    cctx.strokeStyle = 'rgba(40,30,20,0.12)';
    cctx.lineWidth = 1;
    cctx.beginPath();
    cctx.moveTo(0, chH / 2);
    cctx.lineTo(cw, chH / 2);
    cctx.stroke();

    const barW = cw / AUDIO_WAVEFORM_BUCKETS;
    const pad = Math.max(0.5, barW * 0.15);
    cctx.fillStyle = '#2B2216';
    for (let i = 0; i < AUDIO_WAVEFORM_BUCKETS; i++) {
      const h = Math.max(1, (peaks[i] / maxPeak) * (chH * 0.86));
      const x = i * barW + pad;
      const y = (chH - h) / 2;
      cctx.fillRect(x, y, Math.max(1, barW - pad * 2), h);
    }

    return {
      dataUrl: canvas.toDataURL('image/png'),
      durationMs: durationMs > 0 ? durationMs : undefined,
    };
  } catch (err) {
    console.warn('[file] audio waveform extraction failed', err);
    return null;
  } finally {
    if (ctx && ctx.state !== 'closed') {
      ctx.close().catch(() => {});
    }
  }
}

/**
 * PDF 页数：不引入 pdfjs。只读前 8MB，用 latin1 解码后正则搜 `/Count <N>`，
 * 取最大值（通常是最外层 /Pages 对象的 Count）。命中率 >90%，失败安静返
 * 回 undefined，UI 不显示页数。
 *
 * 不是正确的 PDF 解析，但对用户面来说"1 个数字而已"，值得用 10 行代码换
 * 一个 400KB+ 的依赖不引入。
 */
async function inspectPdfPageCount(file: File): Promise<number | undefined> {
  try {
    const scanSize = Math.min(file.size, PDF_SCAN_BYTES);
    const buf = await file.slice(0, scanSize).arrayBuffer();
    const text = new TextDecoder('latin1').decode(buf);
    const re = /\/Count\s+(\d+)/g;
    let m: RegExpExecArray | null;
    let best = 0;
    while ((m = re.exec(text)) !== null) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > best) best = n;
    }
    return best > 0 ? best : undefined;
  } catch {
    return undefined;
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('FileReader returned non-string result'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}

/**
 * 把一个 File 转成待插入 store 的 FileElement。按 MIME 分派预览提取，
 * 失败一律回落到通用附件卡（不阻断上传）。
 *
 * @param file     OS 原生 File 对象
 * @param origin   画布坐标原点（元素中心）
 * @param offset   多选上传错开堆叠，`{ dx: idx*24, dy: idx*24 }`
 */
export async function buildFileElement(
  file: File,
  origin: { x: number; y: number },
  offset: { dx: number; dy: number } = { dx: 0, dy: 0 },
): Promise<FileElement> {
  const dataUrl = await readFileAsDataUrl(file);
  const id = uuidv4();
  const mt = (file.type || '').toLowerCase();

  let src: string;
  let persistence: 'data' | 'blob' = 'data';
  let blobStorageKey: string | undefined;

  if (file.size > BLOB_THRESHOLD_BYTES) {
    try {
      blobStorageKey = blobKey(id);
      await storeBlob(blobStorageKey, dataUrl);
      persistence = 'blob';
      src = '';
    } catch (err) {
      console.warn('[fileIngest] blob store failed, falling back to data', err);
      persistence = 'data';
      src = dataUrl;
    }
  } else {
    src = dataUrl;
  }

  let width: number;
  let height: number;
  let thumbnailDataUrl: string | undefined;
  let durationMs: number | undefined;
  let pageCount: number | undefined;

  if (mt.startsWith('image/')) {
    const measured = await measureImageSize(dataUrl);
    if (measured) {
      ({ width, height } = measured);
    } else {
      ({ width, height } = defaultSizeForMime(file.type));
    }
  } else if (mt.startsWith('video/')) {
    const thumb = await extractVideoThumbnail(file);
    if (thumb) {
      thumbnailDataUrl = thumb.dataUrl;
      durationMs = thumb.durationMs;
      const scale = thumb.widthPx > VIDEO_MAX_WIDTH ? VIDEO_MAX_WIDTH / thumb.widthPx : 1;
      width = Math.round(thumb.widthPx * scale);
      height = Math.round(thumb.heightPx * scale);
    } else {
      ({ width, height } = defaultSizeForMime(file.type));
    }
  } else if (mt.startsWith('audio/')) {
    const wave = await extractAudioWaveform(file);
    if (wave) {
      thumbnailDataUrl = wave.dataUrl;
      durationMs = wave.durationMs;
      // 波形是扁长条卡面，固定 4:1，和 AUDIO_WAVEFORM_WIDTH/HEIGHT 的 PNG 对齐
      width = AUDIO_WAVEFORM_WIDTH;
      height = AUDIO_WAVEFORM_HEIGHT;
    } else {
      ({ width, height } = defaultSizeForMime(file.type));
    }
  } else if (mt === 'application/pdf') {
    pageCount = await inspectPdfPageCount(file);
    ({ width, height } = defaultSizeForMime(file.type));
  } else {
    ({ width, height } = defaultSizeForMime(file.type));
  }

  const el: FileElement = {
    id,
    type: 'file',
    x: origin.x + offset.dx - width / 2,
    y: origin.y + offset.dy - height / 2,
    width,
    height,
    name: file.name,
    mimeType: file.type || '',
    sizeBytes: file.size,
    src,
    persistence,
    ...(blobStorageKey ? { blobKey: blobStorageKey } : {}),
    thumbnailDataUrl,
    durationMs,
    pageCount,
  };
  return el;
}

/** 人类可读字节数，给 UI 展示用（例如 "3.2 MB"）。 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

/** 毫秒 → `mm:ss` / `h:mm:ss`，用于时长徽标。非法值返回 '—'。 */
export function formatDuration(ms: number | undefined): string {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return '—';
  const totalSec = Math.round(ms / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

/**
 * 粗分类：决定 CanvasElements 走哪条预览分支。
 * - 'image' / 'video' / 'audio' / 'pdf'：各自定制
 * - 'other'：通用附件卡
 *
 * 刻意不依赖扩展名（可被改），统一看 MIME。未知 MIME 一律走 'other'。
 */
export type FilePreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'other';

export function previewKindForMime(mimeType: string): FilePreviewKind {
  const mt = (mimeType || '').toLowerCase();
  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('video/')) return 'video';
  if (mt.startsWith('audio/')) return 'audio';
  if (mt === 'application/pdf') return 'pdf';
  return 'other';
}
