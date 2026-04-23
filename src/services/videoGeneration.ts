import { v4 as uuidv4 } from 'uuid';
import { useCanvasStore } from '../store/useCanvasStore';
import { useGenerationQueueStore } from '../store/useGenerationQueueStore';
import { AIGeneratingElement, CanvasElement, MediaElement, NodeVersion } from '../types/canvas';
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

function replacePlaceholderWithVideo(placeholderId: string, videoUrl: string, prompt: string) {
  const store = getStore();
  const el = store.elements.find(e => e.id === placeholderId);
  if (!el) return;
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

  store.deleteElements([placeholderId]);
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
  store.addElement(newElement as CanvasElement);
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

  replacePlaceholderWithVideo(placeholderId, url, request.prompt);
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
