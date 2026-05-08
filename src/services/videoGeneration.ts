import { v4 as uuidv4 } from 'uuid';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useAssetLibraryStore } from '@/store/useAssetLibraryStore';
import { useGenerationQueueStore } from '@/store/useGenerationQueueStore';
import { useGenerationHistoryStore } from '@/store/useGenerationHistoryStore';
import { AIGeneratingElement, CanvasElement, MediaElement, NodeVersion, PendingGenerationTask } from '@/types/canvas';
import { generateVideoByModelId } from './gateway';
import type { GatewayErrorKind, VideoGenResult } from './gateway/types';

/**
 * App-level video generation request. Mirrors {@link GenRequest} for images.
 * The `modality` discriminator is stamped on any error surfaced to the UI so
 * that the retry handler can dispatch back to the correct service.
 */
export interface VideoGenRequest {
  model: string;
  prompt: string;
  /** "WxH" formatted. */
  size: string;
  /** Rendered width in canvas units. */
  w: number;
  /** Rendered height in canvas units. */
  h: number;
  /** Duration in seconds. */
  durationSec: number;
  /** Optional i2v seed frame (data URL or hosted URL). */
  seedImage?: string;
}

export type VideoGenErrorKind = GatewayErrorKind;

export interface VideoGenError {
  kind: VideoGenErrorKind;
  message: string;
  detail?: string;
  request: VideoGenRequest;
}

function getStore() {
  return useCanvasStore.getState();
}

function setPlaceholderError(id: string, error: VideoGenError) {
  const store = getStore();
  const el = store.elements.find(e => e.id === id);
  if (!el || el.type !== 'aigenerating') return;
  // The error shape on AIGeneratingElement is shared with image errors; we
  // stamp `modality: 'video'` on the persisted request so the retry path
  // downstream knows which service to re-invoke.
  store.updateElement(id, {
    error: {
      kind: error.kind,
      message: error.message,
      detail: error.detail,
      request: {
        modality: 'video',
        model: error.request.model,
        prompt: error.request.prompt,
        size: error.request.size,
        n: 1,
        w: error.request.w,
        h: error.request.h,
        durationSec: error.request.durationSec,
        seedImage: error.request.seedImage,
      },
    },
  } as Partial<AIGeneratingElement>);
}

function clearPlaceholderError(id: string) {
  const store = getStore();
  const el = store.elements.find(e => e.id === id);
  if (!el || el.type !== 'aigenerating') return;
  store.updateElement(id, { error: undefined } as Partial<AIGeneratingElement>);
}

function attachPendingVideoTask(id: string, pending: PendingGenerationTask) {
  const store = getStore();
  const el = store.elements.find(e => e.id === id);
  if (!el || el.type !== 'aigenerating') return;
  store.updateElement(id, {
    pendingTask: pending,
  } as Partial<AIGeneratingElement>);
}

/**
 * 幂等守卫：与 imageGeneration.replacePlaceholderWithImage 一致的防重复
 * materialize 机制。防止同一 placeholder 被两条路径（runVideoGeneration
 * 的首轮 + 未来的 taskResume 定时重扫）同时拿到 SUCCESS 而各自 addElement
 * 出两张视频。
 */
const materializingVideos = new Set<string>();

function replacePlaceholderWithVideo(placeholderId: string, videoUrl: string, prompt: string): string | null {
  if (materializingVideos.has(placeholderId)) return null;
  materializingVideos.add(placeholderId);

  const store = getStore();
  const el = store.elements.find(e => e.id === placeholderId);
  if (!el) {
    materializingVideos.delete(placeholderId);
    return null;
  }
  const { x, y, width, height } = el;

  // F2 parity with image path — inherit version history on in-place regenerate.
  const aig = el as AIGeneratingElement;
  const newVersionEntry: NodeVersion = {
    id: uuidv4(),
    src: videoUrl,
    prompt,
    createdAt: Date.now(),
  };
  let versions: NodeVersion[] | undefined;
  let activeVersionIndex: number | undefined;
  if (aig.inheritedVersions && aig.inheritedVersions.length > 0) {
    versions = [...aig.inheritedVersions, newVersionEntry];
    activeVersionIndex = versions.length - 1;
  }

  // 与图像路径保持一致：replaceElement 承继 placeholder 从视频锚点带来的
  // 端口 id，让 img→video 的 seed 连线在整条生成链路上都不断。参考
  // imageGeneration.replacePlaceholderWithImage 的同名修复。
  const newElement: MediaElement = {
    id: uuidv4(),
    type: 'video',
    x,
    y,
    width,
    height,
    src: videoUrl,
    prompt,
    ...(versions ? { versions, activeVersionIndex } : {}),
  };
  store.replaceElement(placeholderId, newElement as CanvasElement, '视频生成完成');

  // 保留 claim 几秒再释放，与图像路径的 5s 窗口对齐。
  setTimeout(() => materializingVideos.delete(placeholderId), 5000);

  return newElement.id;
}

/**
 * Run a single video generation through the gateway registry, filling one
 * placeholder in-place. Fails gracefully — never rejects; errors surface via
 * the placeholder's `error` field rendered by GenErrorPanel.
 */
export async function runVideoGeneration(
  placeholderId: string,
  request: VideoGenRequest,
  opts?: { retryOfId?: string },
): Promise<void> {
  // F16: queue registration mirrors the image path so the panel shows a
  // unified view of both modalities.
  const taskId = uuidv4();
  useGenerationQueueStore.getState().enqueue({
    id: taskId,
    modality: 'video',
    model: request.model,
    prompt: request.prompt,
    placeholderIds: [placeholderId],
    retryOfId: opts?.retryOfId,
  });

  const result: VideoGenResult = await generateVideoByModelId({
    model: request.model,
    prompt: request.prompt,
    size: request.size,
    durationSec: request.durationSec,
    seedImage: request.seedImage,
    onTaskSubmitted: ({ providerId, taskId }) => {
      attachPendingVideoTask(placeholderId, {
        providerId,
        taskId,
        submittedAt: Date.now(),
        request: {
          model: request.model,
          prompt: request.prompt,
          size: request.size,
          durationSec: request.durationSec,
          seedImage: request.seedImage,
        },
      });
    },
  });

  if (result.ok === false) {
    setPlaceholderError(placeholderId, {
      kind: result.kind,
      message: result.message,
      detail: result.detail,
      request,
    });
    useGenerationQueueStore
      .getState()
      .completeTask(taskId, 'failed', result.message);
    return;
  }

  if (result.ok === 'pending') {
    // 异步任务已提交但未完成，taskId 已由 generateVideoByModelId 的 onTaskSubmitted 回调持久化。
    // 不写 error，不 completeTask —— 让 placeholder 保持 generating 状态，后续由 taskResume 继续轮询。
    return;
  }

  const url = result.urls[0];
  if (!url) {
    setPlaceholderError(placeholderId, {
      kind: 'empty',
      message: '接口未返回视频',
      request,
    });
    useGenerationQueueStore
      .getState()
      .completeTask(taskId, 'failed', '接口未返回视频');
    return;
  }

  const newElementId = replacePlaceholderWithVideo(placeholderId, url, request.prompt);
  if (!newElementId) return; // 并发去重：另一个调用路径已 materialize 此 placeholder

  // 与 imageGeneration.replacePlaceholderWithImage 对齐：素材库归档 + 生成历史记录。
  const name = request.prompt.trim().split(/\r?\n/)[0].slice(0, 40) || '生成视频';
  useAssetLibraryStore.getState().addAsset({
    kind: 'video',
    src: url,
    name,
    prompt: request.prompt,
    width: request.w,
    height: request.h,
    source: 'generated',
  });
  useGenerationHistoryStore.getState().addEntry({
    id: uuidv4(),
    elementId: newElementId,
    prompt: request.prompt,
    model: request.model || '',
    thumbnailUrl: url,
    resultUrls: [url],
    modality: 'video',
  });

  useGenerationQueueStore.getState().completeTask(taskId, 'success');
}

/**
 * Retry a failed video placeholder. Re-reads `error.request` and re-runs.
 */
export async function retryVideoGeneration(
  placeholderId: string,
  retryOfId?: string,
): Promise<void> {
  const store = getStore();
  const el = store.elements.find(e => e.id === placeholderId);
  if (!el || el.type !== 'aigenerating') return;
  const aig = el as AIGeneratingElement;
  if (!aig.error?.request) return;

  const req: VideoGenRequest = {
    model: aig.error.request.model,
    prompt: aig.error.request.prompt,
    size: aig.error.request.size,
    w: aig.error.request.w,
    h: aig.error.request.h,
    durationSec: aig.error.request.durationSec ?? 5,
    seedImage: aig.error.request.seedImage,
  };
  clearPlaceholderError(placeholderId);
  await runVideoGeneration(placeholderId, req, { retryOfId });
}