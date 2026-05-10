import { v4 as uuidv4 } from 'uuid';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useAssetLibraryStore } from '@/store/useAssetLibraryStore';
import { useGenerationHistoryStore } from '@/store/useGenerationHistoryStore';
import { useGenerationQueueStore } from '@/store/useGenerationQueueStore';
import {
  AIGeneratingElement,
  CanvasElement,
  ImageElement,
  NodeVersion,
  PendingGenerationTask,
  isSceneElement,
} from '@/types/canvas';
import { generateImageByModelId } from './gateway';
import type { GatewayErrorKind } from './gateway/types';
import { retryVideoGeneration } from './videoGeneration';

/**
 * Request payload persisted on a placeholder's error state so that a retry
 * can replay the exact generation. `model` is the wire-level id resolvable by
 * the gateway registry (apiKey is never persisted — retry pulls fresh config).
 */
export interface GenRequest {
  model: string;
  prompt: string;
  /** "WxH" formatted for vendor body. */
  size: string;
  /**
   * 归一化的宽高比，例如 '1:1' / '16:9' / '21:9'。
   * RunningHub 之类只吃 aspectRatio 的 provider 直接用；其它按 size 下单的
   * provider 会忽略这个字段。重放（retry）时一起带上以免 provider 拿不到。
   */
  aspect?: string;
  /** Number of images requested in this batch. Retry always replays with n=1. */
  n?: number;
  /** Rendered width in canvas units, for recreating image nodes. */
  w?: number;
  /** Rendered height in canvas units, for recreating image nodes. */
  h?: number;
  /** Optional image-to-image references (data URLs or hosted URLs). */
  references?: string[];
  /**
   * F15 local inpainting mask (PNG data URL, alpha=0 marks rewrite region).
   * Must match the base image's dimensions. Set together with
   * `references[0]` = base image. Retrying an inpaint replays the mask
   * verbatim so users don't lose their selection on transient errors.
   */
  maskImage?: string;
  /**
   * 透传给 provider 的 UI 分辨率档位（'1K' / '2K' / '4K' / 'auto'）。
   * 给 RH 官方稳定版之类把档位当 wire-level 必填字段的 provider 用；
   * 其它 provider 走 `size` 路径，看不到这个值。retry 快照也一并保留。
   */
  resolution?: string;
  /**
   * 透传给 provider 的 UI 生成质量档位（RH 官方稳定版的 low/medium/high）。
   * 只有声明 supportedQualityLevels 的模型才会实际使用。
   */
  qualityLevel?: string;
  /**
   * Story 1.5: execId context for the generation:success CustomEvent.
   * When set, the event detail carries { placeholderId, execId } so the
   * execution engine can update the correct run's node status.
   */
  execId?: string;
  /**
   * Story 1.5: optional callback invoked by replacePlaceholderWithImage on
   * successful generation. Allows the execution engine to update node status.
   */
  onSuccess?: (placeholderId: string) => void;
  /**
   * F3 fix: AbortSignal propagated from the execution engine's AbortController.
   * Allows providers to abort HTTP requests mid-flight when the user cancels.
   */
  signal?: AbortSignal;
}

export type GenErrorKind = GatewayErrorKind;

export interface GenError {
  kind: GenErrorKind;
  message: string;
  detail?: string;
  request: GenRequest;
}

function getStore() {
  return useCanvasStore.getState();
}

/**
 * 把失败信息写到 placeholder。同时清掉 pendingTask——这两个状态互斥：
 * 看到 error 就不该再尝试 resume 轮询。
 *
 * 导出供 `taskResume` 在 resume 扫描出错时复用，保证失败落盘格式统一。
 */
export function setPlaceholderError(id: string, error: GenError) {
  const store = getStore();
  const el = store.elements.find(e => e.id === id);
  if (!el || el.type !== 'aigenerating') return;
  // Stamp modality='image' so the retry dispatcher knows to re-run the image
  // pipeline. Shape here matches `AIGenerationError`.
  store.updateElement(id, {
    error: {
      kind: error.kind,
      message: error.message,
      detail: error.detail,
      request: { modality: 'image', ...error.request },
    },
    pendingTask: undefined,
  } as Partial<AIGeneratingElement>);
}

function clearPlaceholderError(id: string) {
  const store = getStore();
  const el = store.elements.find(e => e.id === id);
  if (!el || el.type !== 'aigenerating') return;
  store.updateElement(id, { error: undefined } as Partial<AIGeneratingElement>);
}

/**
 * 把异步任务信息（taskId 等）写到 placeholder，供刷新后 resume 轮询使用。
 * 此操作**不会**把 placeholder 切到 error 态——它仍然展示 loading 骨架。
 */
function attachPendingTask(id: string, pending: PendingGenerationTask) {
  const store = getStore();
  const el = store.elements.find(e => e.id === id);
  if (!el || el.type !== 'aigenerating') return;
  store.updateElement(id, {
    pendingTask: pending,
  } as Partial<AIGeneratingElement>);
}

// 防止同一 placeholder 被两条路径（runOneSlot 的首轮 poll + taskResume 的
// 定时重扫）同时拿到 SUCCESS 而各自 addElement 出两张图。谁先拿到"坑位"
// 谁替换，后到的就 early-return。
const materializing = new Set<string>();

/**
 * 把 placeholder 替换成正式 image 节点。pendingTask 随 placeholder 一并消失，
 * 无需额外清理；asset library 也在这里顺手归档。
 *
 * 导出供 `taskResume` 复用。对同一 placeholderId 并发调用是幂等的——
 * 第二次会被 `materializing` 集合挡住，不会出现重复节点。
 *
 * Story 1.5: `onSuccess` callback is invoked after the node is replaced,
 * allowing the execution engine to update node status.
 */
export function replacePlaceholderWithImage(
  placeholderId: string,
  imageUrl: string,
  prompt: string,
  model?: string,
  execId?: string,
  onSuccess?: (placeholderId: string) => void,
) {
  if (materializing.has(placeholderId)) return;
  materializing.add(placeholderId);

  const store = getStore();
  const el = store.elements.find(e => e.id === placeholderId);
  if (!el) {
    materializing.delete(placeholderId);
    return;
  }
  const { x, y, width, height } = el;

  // F2: if the placeholder inherited a versions history (from "regenerate in
  // place" mode), append the new generation to it and point activeVersionIndex
  // at the new tail. If no inherited history exists, leave versions undefined
  // — the NodeVersionSwitcher won't render, preserving the "no history" look
  // for fresh / batch-spawned nodes.
  const aig = el as AIGeneratingElement;
  const newVersionEntry: NodeVersion = {
    id: uuidv4(),
    src: imageUrl,
    prompt,
    createdAt: Date.now(),
  };
  let versions: NodeVersion[] | undefined;
  let activeVersionIndex: number | undefined;
  if (aig.inheritedVersions && aig.inheritedVersions.length > 0) {
    versions = [...aig.inheritedVersions, newVersionEntry];
    activeVersionIndex = versions.length - 1;
  }

  // 用 replaceElement 替换 placeholder → image，承继 placeholder 从锚点带来
  // 的端口 id。这样"file(image) → 锚点图" 这根连线在锚点 → placeholder
  // → 最终 image 的整条链路上都不会断，方便用户接着以同一张图再做 img2img
  // 迭代。之前的 deleteElements + addElement 模式会把连线连带炸掉。
  const newElement: ImageElement = {
    id: uuidv4(),
    type: 'image',
    x,
    y,
    width,
    height,
    src: imageUrl,
    prompt,
    ...(versions ? { versions, activeVersionIndex } : {}),
  };
  store.replaceElement(placeholderId, newElement as CanvasElement, '生成完成');

  // E7 Story 6: auto-link the new image to any scene that has this placeholder
  // as its linkedImageId, or any scene that has a connection to this placeholder.
  // This closes the loop: scene → placeholder → image → scene.linkedImageId.
  const updatedElements = store.elements;
  const newImageId = newElement.id;

  // Path 1: scene.linkedImageId === placeholderId
  for (const el of updatedElements) {
    if (isSceneElement(el) && el.linkedImageId === placeholderId) {
      store.updateElement(el.id, { linkedImageId: newImageId });
    }
  }

  // Path 2: scene outputs connect to this placeholder — update linkedImageId
  for (const c of store.connections) {
    if (c.toId === placeholderId) {
      const src = updatedElements.find(e => e.id === c.fromId);
      if (src && isSceneElement(src) && !src.linkedImageId) {
        store.updateElement(src.id, { linkedImageId: newImageId });
      }
    }
  }

  // Story 1.5: notify the execution engine so it can update node status.
  onSuccess?.(placeholderId);

  // Also fire a CustomEvent on window so taskResume (which doesn't have the
  // onSuccess callback) can also notify the execution engine.
  window.dispatchEvent(new CustomEvent('generation:success', {
    detail: { placeholderId, execId },
  }));

  // Auto-archive every successful generation into the asset library so users
  // can re-find / re-use it without scrolling the canvas. Name defaults to
  // the first line of the prompt, capped for readability.
  const name = prompt.trim().split(/\r?\n/)[0].slice(0, 40) || '生成图像';
  useAssetLibraryStore.getState().addAsset({
    kind: 'image',
    src: imageUrl,
    name,
    prompt,
    width,
    height,
    source: 'generated',
  });

  // Record to generation history so users can browse past results across nodes.
  useGenerationHistoryStore.getState().addEntry({
    id: uuidv4(),
    elementId: newElement.id,
    prompt,
    model: model || '',
    thumbnailUrl: imageUrl,
    resultUrls: [imageUrl],
    modality: 'image',
  });

  // 保留 claim 几秒再释放：虽然节点 id 已换新，后到者再跑时 store.elements
  // 里也找不到原 placeholderId（early-return），不过显式清掉让集合不会
  // 长期积压。
  setTimeout(() => materializing.delete(placeholderId), 5000);
}

type OneSlotOutcome = 'success' | 'failure' | 'pending';

/**
 * 单个 placeholder 的 n=1 调用。负责：
 *   - 透传 onTaskSubmitted，把 taskId 落到该 placeholder
 *   - 成功时写 image 节点，失败时写 error，pending 时啥也不干（pendingTask
 *     已在回调里落盘，由 taskResume 在下次启动时接回）
 */
async function runOneSlot(placeholderId: string, request: GenRequest): Promise<OneSlotOutcome> {
  // F3 fix: pass signal through so providers can abort the fetch.
  const result = await generateImageByModelId({
    model: request.model,
    prompt: request.prompt,
    size: request.size,
    aspect: request.aspect,
    resolution: request.resolution,
    qualityLevel: request.qualityLevel,
    n: 1,
    referenceImages: request.references,
    maskImage: request.maskImage,
    signal: request.signal,
    onTaskSubmitted: ({ providerId, taskId }) => {
      attachPendingTask(placeholderId, {
        providerId,
        taskId,
        submittedAt: Date.now(),
        // 持久化整个 request 快照：resume 如果最终失败，可以用它还原
        // error.request 让 retry 路径跑得通；成本上异步 provider 的参考图
        // 都是公网 URL，不会塞爆 localStorage。
        request: {
          model: request.model,
          prompt: request.prompt,
          size: request.size,
          aspect: request.aspect,
          resolution: request.resolution,
          qualityLevel: request.qualityLevel,
          n: 1,
          w: request.w!,
          h: request.h!,
          references: request.references,
          maskImage: request.maskImage,
          // F2 fix: persist execId so taskResume can update the correct run's node status.
          execId: request.execId,
        },
      });
    },
  });

  if (result.ok === true) {
    const url = result.urls[0];
    if (!url) {
      setPlaceholderError(placeholderId, {
        kind: 'empty',
        message: '接口未返回图像',
        request,
      });
      return 'failure';
    }
    // Story 1.5: pass onSuccess through so execution engine can update status.
    replacePlaceholderWithImage(
      placeholderId,
      url,
      request.prompt,
      request.model,
      request.execId,
      request.onSuccess,
    );
    return 'success';
  }

  if (result.ok === 'pending') {
    // taskId 已经在 onTaskSubmitted 里持久化，placeholder 继续转圈就好。
    // 下次启动 taskResume 扫到 pendingTask 会继续查。
    return 'pending';
  }

  setPlaceholderError(placeholderId, {
    kind: result.kind,
    message: result.message,
    detail: result.detail,
    request,
  });
  return 'failure';
}

/**
 * 发起一批图像生成，每个 placeholder 独立调用一次 n=1 的 generateImage。
 *
 * 为什么不再用 provider 级 n>1 批量：异步 provider（RunningHub）一次 submit
 * 对应一个 taskId，要做到 1 placeholder ↔ 1 taskId 的干净映射、以及"有的
 * 任务完成、有的还 pending"的部分成功语义，最简单的方式就是在 service 层
 * 扇出。对同步 provider（t8star）多几次 HTTP 握手成本可忽略。
 *
 * 所有失败 / pending 分支都不抛异常，UI 用 placeholder.error / pendingTask
 * 区分"红色失败" vs "仍在转圈"。
 */
export async function runGeneration(
  placeholderIds: string[],
  request: GenRequest,
  /** Internal: when retrying, caller supplies the original task id so the
   *  queue can thread retries back to the failure they came from. */
  opts?: { retryOfId?: string },
): Promise<void> {
  if (placeholderIds.length === 0) return;

  // F16: register with the queue BEFORE the network call so the panel
  // shows the spinner immediately. Task id is distinct from any element id.
  const queue = useGenerationQueueStore.getState();
  const taskId = uuidv4();
  queue.enqueue({
    id: taskId,
    modality: 'image',
    model: request.model,
    prompt: request.prompt,
    placeholderIds: [...placeholderIds],
    retryOfId: opts?.retryOfId,
  });

  const outcomes = await Promise.all(
    placeholderIds.map(phId => runOneSlot(phId, request)),
  );

  // Queue 状态汇总：
  //   - 全部 failure         → failed（会固定在队列里等用户重试 / 清理）
  //   - 至少一个 success/pending → success（kickoff 成功；pending 的交给
  //                                        placeholder 自己继续转圈）
  // queue 本来就不持久化，pending 不需要特意"挂起队列任务"。
  const allFailed = outcomes.every(o => o === 'failure');
  const firstFailure = allFailed ? '全部任务失败' : undefined;
  useGenerationQueueStore
    .getState()
    .completeTask(taskId, allFailed ? 'failed' : 'success', firstFailure);
}

/**
 * Retry a single placeholder whose `error.request` carries the original payload.
 * Dispatches by modality: video errors route into the video service. Image
 * retries always run with n=1, regardless of the original batch size.
 */
export async function retryGeneration(
  placeholderId: string,
  /** Original queue task id, if this retry was dispatched from the
   *  generation queue panel (F16). Purely informational so the panel can
   *  group retries under their source task visually. */
  retryOfId?: string,
): Promise<void> {
  const store = getStore();
  const el = store.elements.find(e => e.id === placeholderId);
  if (!el || el.type !== 'aigenerating') return;
  const aig = el as AIGeneratingElement;
  if (!aig.error?.request) return;

  if (aig.error.request.modality === 'video') {
    await retryVideoGeneration(placeholderId, retryOfId);
    return;
  }

  const request: GenRequest = {
    model: aig.error.request.model,
    prompt: aig.error.request.prompt,
    size: aig.error.request.size,
    n: 1,
    w: aig.error.request.w!,
    h: aig.error.request.h!,
    references: aig.error.request.references,
    maskImage: aig.error.request.maskImage,
  };
  clearPlaceholderError(placeholderId);
  await runGeneration([placeholderId], request, { retryOfId });
}
