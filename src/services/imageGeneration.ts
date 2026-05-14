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
} from '@/types/canvas';
import { generateImageByModelId } from './gateway';
import type { GatewayErrorKind } from './gateway/types';
import { retryVideoGeneration } from './videoGeneration';

/**
 * Request payload persisted on a placeholder's error state so that a retry
 * can replay the exact generation. `model` is the wire-level id resolvable by
 * the gateway registry (apiKey is never persisted 鈥?retry pulls fresh config).
 */
export interface GenRequest {
  model: string;
  prompt: string;
  /** "WxH" formatted for vendor body. */
  size: string;
  /**
   * 褰掍竴鍖栫殑瀹介珮姣旓紝渚嬪 '1:1' / '16:9' / '21:9'銆?
   * RunningHub 涔嬬被鍙悆 aspectRatio 鐨?provider 鐩存帴鐢紱鍏跺畠鎸?size 涓嬪崟鐨?
   * provider 浼氬拷鐣ヨ繖涓瓧娈点€傞噸鏀撅紙retry锛夋椂涓€璧峰甫涓婁互鍏?provider 鎷夸笉鍒般€?
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
   * 閫忎紶缁?provider 鐨?UI 鍒嗚鲸鐜囨。浣嶏紙'1K' / '2K' / '4K' / 'auto'锛夈€?
   * 缁?RH 瀹樻柟绋冲畾鐗堜箣绫绘妸妗ｄ綅褰?wire-level 蹇呭～瀛楁鐨?provider 鐢紱
   * 鍏跺畠 provider 璧?`size` 璺緞锛岀湅涓嶅埌杩欎釜鍊笺€俽etry 蹇収涔熶竴骞朵繚鐣欍€?
   */
  resolution?: string;
  /**
   * 閫忎紶缁?provider 鐨?UI 鐢熸垚璐ㄩ噺妗ｄ綅锛圧H 瀹樻柟绋冲畾鐗堢殑 low/medium/high锛夈€?
   * 鍙湁澹版槑 supportedQualityLevels 鐨勬ā鍨嬫墠浼氬疄闄呬娇鐢ㄣ€?
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
 * 鎶婂け璐ヤ俊鎭啓鍒?placeholder銆傚悓鏃舵竻鎺?pendingTask鈥斺€旇繖涓や釜鐘舵€佷簰鏂ワ細
 * 鐪嬪埌 error 灏变笉璇ュ啀灏濊瘯 resume 杞銆?
 *
 * 瀵煎嚭渚?`taskResume` 鍦?resume 鎵弿鍑洪敊鏃跺鐢紝淇濊瘉澶辫触钀界洏鏍煎紡缁熶竴銆?
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
 * 鎶婂紓姝ヤ换鍔′俊鎭紙taskId 绛夛級鍐欏埌 placeholder锛屼緵鍒锋柊鍚?resume 杞浣跨敤銆?
 * 姝ゆ搷浣?*涓嶄細**鎶?placeholder 鍒囧埌 error 鎬佲€斺€斿畠浠嶇劧灞曠ず loading 楠ㄦ灦銆?
 */
function attachPendingTask(id: string, pending: PendingGenerationTask) {
  const store = getStore();
  const el = store.elements.find(e => e.id === id);
  if (!el || el.type !== 'aigenerating') return;
  store.updateElement(id, {
    pendingTask: pending,
  } as Partial<AIGeneratingElement>);
}

// 闃叉鍚屼竴 placeholder 琚袱鏉¤矾寰勶紙runOneSlot 鐨勯杞?poll + taskResume 鐨?
// 瀹氭椂閲嶆壂锛夊悓鏃舵嬁鍒?SUCCESS 鑰屽悇鑷?addElement 鍑轰袱寮犲浘銆傝皝鍏堟嬁鍒?鍧戜綅"
// 璋佹浛鎹紝鍚庡埌鐨勫氨 early-return銆?
const materializing = new Set<string>();

/**
 * 鎶?placeholder 鏇挎崲鎴愭寮?image 鑺傜偣銆俻endingTask 闅?placeholder 涓€骞舵秷澶憋紝
 * 鏃犻渶棰濆娓呯悊锛沘sset library 涔熷湪杩欓噷椤烘墜褰掓。銆?
 *
 * 瀵煎嚭渚?`taskResume` 澶嶇敤銆傚鍚屼竴 placeholderId 骞跺彂璋冪敤鏄箓绛夌殑鈥斺€?
 * 绗簩娆′細琚?`materializing` 闆嗗悎鎸′綇锛屼笉浼氬嚭鐜伴噸澶嶈妭鐐广€?
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
  // 鈥?the NodeVersionSwitcher won't render, preserving the "no history" look
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

  // 鐢?replaceElement 鏇挎崲 placeholder 鈫?image锛屾壙缁?placeholder 浠庨敋鐐瑰甫鏉?
  // 鐨勭鍙?id銆傝繖鏍?file(image) 鈫?閿氱偣鍥? 杩欐牴杩炵嚎鍦ㄩ敋鐐?鈫?placeholder
  // 鈫?鏈€缁?image 鐨勬暣鏉￠摼璺笂閮戒笉浼氭柇锛屾柟渚跨敤鎴锋帴鐫€浠ュ悓涓€寮犲浘鍐嶅仛 img2img
  // 杩唬銆備箣鍓嶇殑 deleteElements + addElement 妯″紡浼氭妸杩炵嚎杩炲甫鐐告帀銆?
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
  store.replaceElement(placeholderId, newElement as CanvasElement, '鐢熸垚瀹屾垚');

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
  const name = prompt.trim().split(/\r?\n/)[0].slice(0, 40) || '鐢熸垚鍥惧儚';
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

  // 淇濈暀 claim 鍑犵鍐嶉噴鏀撅細铏界劧鑺傜偣 id 宸叉崲鏂帮紝鍚庡埌鑰呭啀璺戞椂 store.elements
  // 閲屼篃鎵句笉鍒板師 placeholderId锛坋arly-return锛夛紝涓嶈繃鏄惧紡娓呮帀璁╅泦鍚堜笉浼?
  // 闀挎湡绉帇銆?
  setTimeout(() => materializing.delete(placeholderId), 5000);
}

type OneSlotOutcome = 'success' | 'failure' | 'pending';

/**
 * 鍗曚釜 placeholder 鐨?n=1 璋冪敤銆傝礋璐ｏ細
 *   - 閫忎紶 onTaskSubmitted锛屾妸 taskId 钀藉埌璇?placeholder
 *   - 鎴愬姛鏃跺啓 image 鑺傜偣锛屽け璐ユ椂鍐?error锛宲ending 鏃跺暐涔熶笉骞诧紙pendingTask
 *     宸插湪鍥炶皟閲岃惤鐩橈紝鐢?taskResume 鍦ㄤ笅娆″惎鍔ㄦ椂鎺ュ洖锛?
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
        // 鎸佷箙鍖栨暣涓?request 蹇収锛歳esume 濡傛灉鏈€缁堝け璐ワ紝鍙互鐢ㄥ畠杩樺師
        // error.request 璁?retry 璺緞璺戝緱閫氾紱鎴愭湰涓婂紓姝?provider 鐨勫弬鑰冨浘
        // 閮芥槸鍏綉 URL锛屼笉浼氬鐖?localStorage銆?
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
    // taskId 宸茬粡鍦?onTaskSubmitted 閲屾寔涔呭寲锛宲laceholder 缁х画杞湀灏卞ソ銆?
    // 涓嬫鍚姩 taskResume 鎵埌 pendingTask 浼氱户缁煡銆?
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
 * 鍙戣捣涓€鎵瑰浘鍍忕敓鎴愶紝姣忎釜 placeholder 鐙珛璋冪敤涓€娆?n=1 鐨?generateImage銆?
 *
 * 涓轰粈涔堜笉鍐嶇敤 provider 绾?n>1 鎵归噺锛氬紓姝?provider锛圧unningHub锛変竴娆?submit
 * 瀵瑰簲涓€涓?taskId锛岃鍋氬埌 1 placeholder 鈫?1 taskId 鐨勫共鍑€鏄犲皠銆佷互鍙?鏈夌殑
 * 浠诲姟瀹屾垚銆佹湁鐨勮繕 pending"鐨勯儴鍒嗘垚鍔熻涔夛紝鏈€绠€鍗曠殑鏂瑰紡灏辨槸鍦?service 灞?
 * 鎵囧嚭銆傚鍚屾 provider锛坱8star锛夊鍑犳 HTTP 鎻℃墜鎴愭湰鍙拷鐣ャ€?
 *
 * 鎵€鏈夊け璐?/ pending 鍒嗘敮閮戒笉鎶涘紓甯革紝UI 鐢?placeholder.error / pendingTask
 * 鍖哄垎"绾㈣壊澶辫触" vs "浠嶅湪杞湀"銆?
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

  // Queue 鐘舵€佹眹鎬伙細
  //   - 鍏ㄩ儴 failure         鈫?failed锛堜細鍥哄畾鍦ㄩ槦鍒楅噷绛夌敤鎴烽噸璇?/ 娓呯悊锛?
  //   - 鑷冲皯涓€涓?success/pending 鈫?success锛坘ickoff 鎴愬姛锛沺ending 鐨勪氦缁?
  //                                        placeholder 鑷繁缁х画杞湀锛?
  // queue 鏈潵灏变笉鎸佷箙鍖栵紝pending 涓嶉渶瑕佺壒鎰?鎸傝捣闃熷垪浠诲姟"銆?
  const allFailed = outcomes.every(o => o === 'failure');
  const firstFailure = allFailed ? '鍏ㄩ儴浠诲姟澶辫触' : undefined;
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
