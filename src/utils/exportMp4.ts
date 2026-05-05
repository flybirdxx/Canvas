// src/utils/exportMp4.ts
import { getStage } from './stageRegistry';
import { useCanvasStore } from '../store/useCanvasStore';
import type { SceneElement } from '../types/canvas';

export type Transition = 'none' | 'fade' | 'slide';
export type Resolution = '720p' | '1080p' | '4k';

export interface ExportMp4Options {
  frameDuration: number;    // seconds per frame (default 3)
  transition: Transition;   // 'none' | 'fade' | 'slide'
  resolution: Resolution;   // '720p' | '1080p' | '4k'
  audioData?: ArrayBuffer;  // optional audio track
  audioDuration?: number;  // audio duration in seconds
}

const RESOLUTION_MAP: Record<Resolution, { width: number; height: number }> = {
  '720p':  { width: 1280, height: 720  },
  '1080p': { width: 1920, height: 1080 },
  '4k':    { width: 3840, height: 2160 },
};

function scenePlaceholder(width: number, height: number, scene: SceneElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#2D2D2D';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.max(24, Math.floor(height * 0.05))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = scene.title || `场景 ${scene.sceneNum}`;
  ctx.fillText(label, width / 2, height / 2 - 20);
  if (scene.content) {
    ctx.font = `${Math.max(16, Math.floor(height * 0.035))}px sans-serif`;
    ctx.fillStyle = '#AAAAAA';
    const preview = scene.content.slice(0, 60) + (scene.content.length > 60 ? '…' : '');
    ctx.fillText(preview, width / 2, height / 2 + 24);
  }
  ctx.fillStyle = '#666666';
  ctx.font = `${Math.max(12, Math.floor(height * 0.03))}px sans-serif`;
  ctx.fillText(`scene ${scene.sceneNum}`, width / 2, height - 32);
  return ctx.getImageData(0, 0, width, height);
}

async function captureSceneAsync(
  stage: NonNullable<ReturnType<typeof getStage>>,
  el: SceneElement,
  targetWidth: number,
  targetHeight: number,
): Promise<ImageData> {
  const { stageConfig } = useCanvasStore.getState();
  const screenX = stageConfig.x + el.x * stageConfig.scale;
  const screenY = stageConfig.y + el.y * stageConfig.scale;
  const screenW = el.width  * stageConfig.scale;
  const screenH = el.height * stageConfig.scale;

  if (screenW < 1 || screenH < 1) {
    return scenePlaceholder(targetWidth, targetHeight, el);
  }

  try {
    const dataUrl = stage.toDataURL({
      x: screenX,
      y: screenY,
      width: screenW,
      height: screenH,
      pixelRatio: 1,
      mimeType: 'image/png',
    });

    const img = new Image();
    img.crossOrigin = 'anonymous';
    const imgData = await new Promise<ImageData>((resolve, reject) => {
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = targetWidth; c.height = targetHeight;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        resolve(ctx.getImageData(0, 0, targetWidth, targetHeight));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
    return imgData;
  } catch {
    return scenePlaceholder(targetWidth, targetHeight, el);
  }
}

async function loadImageDataFromUrl(src: string, w: number, h: number): Promise<ImageData | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    return new Promise((resolve) => {
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(ctx.getImageData(0, 0, w, h));
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  } catch {
    return null;
  }
}

async function collectStoryboardFrames(
  opts: ExportMp4Options,
): Promise<{ frames: ImageData[]; sceneIds: string[] }> {
  const stage = getStage();
  const { elements, stageConfig } = useCanvasStore.getState();

  if (!stage) throw new Error('画布尚未就绪，无法导出。');

  const scenes = elements
    .filter((e): e is SceneElement => e.type === 'scene')
    .sort((a, b) => a.sceneNum - b.sceneNum);

  if (scenes.length === 0) throw new Error('画布上没有 scene 节点，无法生成视频。');

  const { width: targetW, height: targetH } = RESOLUTION_MAP[opts.resolution];
  const frames: ImageData[] = [];

  for (const scene of scenes) {
    let frameData: ImageData | null = null;

    if (scene.content) {
      const imgMatch = scene.content.match(/!\[.*?\]\((.*?)\)/);
      if (imgMatch) {
        frameData = await loadImageDataFromUrl(imgMatch[1], targetW, targetH);
      }
    }

    if (!frameData) {
      frameData = await captureSceneAsync(stage, scene, targetW, targetH);
    }

    frames.push(frameData);
  }

  return { frames, sceneIds: scenes.map(s => s.id) };
}

function generateTransitionFrames(
  prev: ImageData,
  next: ImageData,
  durationSec: number,
  fps: number,
  transition: Transition,
): ImageData[] {
  const count = Math.round(fps * durationSec);
  const frames: ImageData[] = [];
  const w = prev.width, h = prev.height;

  if (transition === 'fade') {
    for (let i = 0; i < count; i++) {
      const alpha = i / count;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(prev, 0, 0);
      ctx.globalAlpha = alpha;
      ctx.putImageData(next, 0, 0);
      frames.push(ctx.getImageData(0, 0, w, h));
    }
  } else if (transition === 'slide') {
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const eased = 1 - Math.pow(1 - t, 3);
      const offsetX = Math.round(eased * w);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(prev, -offsetX, 0);
      ctx.putImageData(next, w - offsetX, 0);
      const out = ctx.getImageData(0, 0, w, h);
      frames.push(out);
    }
  }

  return frames;
}

function isWebCodecsSupported(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
}

export interface ExportMp4Result {
  blob: Blob;
  width: number;
  height: number;
  frameCount: number;
}

export async function concatenateFrames(
  frames: ImageData[],
  opts: ExportMp4Options,
  onProgress?: (pct: number) => void,
): Promise<ExportMp4Result> {
  if (!isWebCodecsSupported()) {
    throw new Error('您的浏览器不支持 WebCodecs（MP4 编码），请使用 Chrome 94+ / Edge 94+ / Safari 16.4+。');
  }

  const { width, height } = RESOLUTION_MAP[opts.resolution];
  const fps = 30;
  const transitionFrames = opts.transition !== 'none' ? Math.round(fps * 0.5) : 0;

  const totalFrames: ImageData[] = [];
  for (let i = 0; i < frames.length; i++) {
    totalFrames.push(frames[i]);
    if (i < frames.length - 1 && opts.transition !== 'none') {
      const transFrames = generateTransitionFrames(
        frames[i], frames[i + 1],
        0.5, fps, opts.transition,
      );
      totalFrames.push(...transFrames);
    }
  }

  const totalEncodedFrames = totalFrames.length;

  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width,
      height,
    },
    fastStart: 'in-memory',
  });

  const encoder = new VideoEncoder({ output: (chunk, meta) => {
    muxer.addVideoChunk(chunk, meta);
  }, error: (e: Error) => { throw e; } });

  encoder.configure({
    codec: 'avc1.640028',
    width,
    height,
    bitrate: opts.resolution === '4k' ? 16_000_000 : opts.resolution === '1080p' ? 8_000_000 : 4_000_000,
  });

  let encodedCount = 0;
  for (const frameData of totalFrames) {
    const frame = new VideoFrame(frameData.data, {
      format: 'RGBA',
      codedWidth: frameData.width,
      codedHeight: frameData.height,
      timestamp: Math.round((encodedCount / fps) * 1_000_000),
    });

    encoder.encode(frame, { keyFrame: encodedCount % 30 === 0 });
    frame.close();

    encodedCount++;
    onProgress?.(Math.round((encodedCount / totalEncodedFrames) * 90));
  }

  await encoder.flush();
  muxer.finalize();

  const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });

  return { blob, width, height, frameCount: totalEncodedFrames };
}

export async function exportMp4(opts: ExportMp4Options): Promise<ExportMp4Result> {
  const { frames, sceneIds } = await collectStoryboardFrames(opts);

  const result = await concatenateFrames(frames, opts);

  downloadBlob(result.blob, `canvas-storyboard-${Date.now()}.mp4`);

  return result;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
