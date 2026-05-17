import { ensurePublicUrl } from '@/services/imgHost/imgbb';
import { useSettingsStore } from '@/store/useSettingsStore';
import type {
  ImageGenFailure,
  ProviderRuntimeConfig,
  VideoGenFailure,
  VideoGenRequest,
  VideoGenResult,
} from '@/services/gateway/types';
import { parseErrorBody, safeStringify } from './errors';
import { uploadLocalFileToRunningHub } from './upload';

const POLL_FIRST_DELAY_MS = 2000;
const POLL_INTERVALS_MS = [3000, 5000, 8000, 12000, 15000] as const;
const VIDEO_POLL_MAX_WAIT_MS = 10 * 60_000;
const SUPPORTED_ASPECTS = ['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'] as const;

export async function generateRunningHubVideo(
  req: VideoGenRequest,
  config: ProviderRuntimeConfig,
): Promise<VideoGenResult> {
  if (!config.apiKey) {
    return { ok: false, kind: 'missingKey', message: '请先在设置中配置 RunningHub 的 API 密钥' };
  }
  if (!config.baseUrl) {
    return { ok: false, kind: 'unknown', message: 'RunningHub Base URL 未配置' };
  }

  let seedImageUrl: string | undefined;
  if (req.seedImage) {
    const prepared = await prepareSingleUrl(req.seedImage);
    if (prepared.ok === false) return prepared;
    seedImageUrl = prepared.url;
  }

  if (req.model === 'sparkvideo-2.0-image' || req.model === 'sparkvideo-2.0-fast-image') {
    return runSparkImageToVideo(config, req, seedImageUrl, VIDEO_POLL_MAX_WAIT_MS);
  }
  if (req.model === 'sparkvideo-2.0-text' || req.model === 'sparkvideo-2.0-fast-text') {
    return runSparkTextToVideo(config, req, VIDEO_POLL_MAX_WAIT_MS);
  }
  if (req.model === 'sparkvideo-2.0-multimodal' || req.model === 'sparkvideo-2.0-fast-multimodal') {
    return runSparkMultimodalVideo(config, req, seedImageUrl, VIDEO_POLL_MAX_WAIT_MS);
  }
  return { ok: false, kind: 'unknown', message: `未知视频模型：${req.model}` };
}

export async function pollRunningHubVideoTask(
  taskId: string,
  config: ProviderRuntimeConfig,
): Promise<VideoGenResult> {
  if (!config.apiKey) {
    return { ok: false, kind: 'missingKey', message: '请先在设置中配置 RunningHub 的 API 密钥' };
  }
  return pollVideoUntilDone(config, taskId, VIDEO_POLL_MAX_WAIT_MS);
}

async function prepareSingleUrl(src: string): Promise<{ ok: true; url: string } | ImageGenFailure> {
  const { imgHost } = useSettingsStore.getState();
  if (!imgHost?.apiKey && /^data:/i.test(src)) {
    return {
      ok: false,
      kind: 'unknown',
      message: 'RunningHub 视频参考图需要公网 URL；请先配置 imgbb 图床后再使用本地图片。',
    };
  }
  try {
    const result = await ensurePublicUrl(src, imgHost?.apiKey ?? '');
    if (result.ok === true) return { ok: true, url: result.url };
    return {
      ok: false,
      kind: result.reason === 'missingKey' ? 'missingKey' : 'network',
      message: result.message,
      detail: result.fallbackUrl,
    };
  } catch (e) {
    return {
      ok: false,
      kind: 'network',
      message: '参考图上传到图床失败，无法提交 RunningHub 视频任务',
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

function resolveVideoResolution(size: string): string {
  const supported = ['480p', '720p', 'native1080p', '1080p', '2k', '4k'];
  if (!size) return '720p';
  const lower = size.toLowerCase();
  if (supported.includes(lower)) return lower;
  const parts = size.split(/[x脳]/);
  if (parts.length === 2) {
    const h = parseInt(parts[1], 10);
    if (!isNaN(h)) {
      if (h <= 480) return '480p';
      if (h <= 720) return '720p';
      if (h <= 1080) return '1080p';
      if (h <= 1440) return '2k';
      return '4k';
    }
  }
  const ratioMatch = lower.match(/(\d+)[:x脳](\d+)/);
  if (ratioMatch) {
    const w = parseInt(ratioMatch[1], 10);
    const h = parseInt(ratioMatch[2], 10);
    if (w && h) {
      const aspect = w / h;
      if (
        Math.abs(aspect - 16 / 9) < 0.1 ||
        Math.abs(aspect - 9 / 16) < 0.1 ||
        Math.abs(aspect - 1) < 0.15 ||
        Math.abs(aspect - 4 / 3) < 0.15
      ) {
        return '720p';
      }
    }
  }
  return '720p';
}

/**
 * SD2.0 鍥剧敓瑙嗛锛歠irstFrameUrl锛? 鍙€?lastFrameUrl锛夆啋 瑙嗛銆? * Schema锛歅OST /openapi/v2/rhart-video/sparkvideo-2.0/image-to-video
 *         POST /openapi/v2/rhart-video/sparkvideo-2.0-fast/image-to-video
 */
async function runSparkImageToVideo(
  config: ProviderRuntimeConfig,
  req: VideoGenRequest,
  seedImageUrl: string | undefined,
  maxWaitMs: number,
): Promise<VideoGenResult> {
  if (!seedImageUrl) {
    return { ok: false, kind: 'unknown', message: '图生视频需要首帧图片（seedImage）' };
  }

  const isFast = req.model === 'sparkvideo-2.0-fast-image';
  const aspect = String(snapAspect(req.size, ['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9']));
  const duration = String(req.durationSec || 5);
  const resolution = resolveVideoResolution(req.size);

  const imgResult = await uploadLocalFileToRunningHub(
    seedImageUrl,
    `first-frame-${Date.now()}.png`,
    config.apiKey,
    config.baseUrl,
  );
  if (imgResult.ok === false) return imgResult;

  const payload = {
    resolution,
    duration,
    firstFrameUrl: imgResult.downloadUrl,
    generateAudio: true,
    ratio: aspect,
    realPersonMode: true,
    conversionSlots: ['all'],
    returnLastFrame: false,
  };

  const endpoint = `${config.baseUrl}/openapi/v2/rhart-video/sparkvideo-2.0${isFast ? '-fast' : ''}/image-to-video`;
  const submitted = await submitTask(endpoint, payload, config.apiKey);
  if (submitted.ok === false) return submitted;
  return pollVideoUntilDone(config, submitted.taskId, maxWaitMs);
}

/**
 * SD2.0 鏂囩敓瑙嗛锛氱函鏂囨湰 prompt 鈫?瑙嗛銆? * Schema锛歅OST /openapi/v2/rhart-video/sparkvideo-2.0/text-to-video
 *         POST /openapi/v2/rhart-video/sparkvideo-2.0-fast/text-to-video
 */
async function runSparkTextToVideo(
  config: ProviderRuntimeConfig,
  req: VideoGenRequest,
  maxWaitMs: number,
): Promise<VideoGenResult> {
  const isFast = req.model === 'sparkvideo-2.0-fast-text';
  const aspect = String(snapAspect(req.size, ['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9']));
  const duration = String(req.durationSec || 5);
  const resolution = resolveVideoResolution(req.size);

  const payload = {
    prompt: req.prompt,
    resolution,
    duration,
    generateAudio: true,
    ratio: aspect,
    webSearch: false,
    returnLastFrame: false,
  };

  const endpoint = `${config.baseUrl}/openapi/v2/rhart-video/sparkvideo-2.0${isFast ? '-fast' : ''}/text-to-video`;
  const submitted = await submitTask(endpoint, payload, config.apiKey);
  if (submitted.ok === false) return submitted;
  return pollVideoUntilDone(config, submitted.taskId, maxWaitMs);
}

/**
 * SD2.0 鍏ㄨ兘鍙傝€冭棰戯細prompt + imageUrls + videoUrls + audioUrls 鈫?瑙嗛銆? * Schema锛歅OST /openapi/v2/rhart-video/sparkvideo-2.0/multimodal-video
 *         POST /openapi/v2/rhart-video/sparkvideo-2.0-fast/multimodal-video
 * multimodal-video 鏄€氱敤娣峰悎妯″紡锛氬悓鏃舵敮鎸佸浘鐢熻棰戯紙鍗曞浘锛夊拰澶氭ā鎬佸弬鑰冿紙澶氬浘+瑙嗛+闊抽锛夈€? * seedImage锛堟潵鑷繛绾匡級浣滀负棣栧浘鏀惧叆 imageUrls銆? */
async function runSparkMultimodalVideo(
  config: ProviderRuntimeConfig,
  req: VideoGenRequest,
  seedImageUrl: string | undefined,
  maxWaitMs: number,
): Promise<VideoGenResult> {
  const isFast = req.model === 'sparkvideo-2.0-fast-multimodal';
  const aspect = String(snapAspect(req.size, ['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9']));
  const duration = String(req.durationSec || 5);
  const resolution = resolveVideoResolution(req.size);

  const imageUrls: string[] = [];
  if (seedImageUrl) {
    const imgResult = await uploadLocalFileToRunningHub(
      seedImageUrl,
      `ref-${Date.now()}.png`,
      config.apiKey,
      config.baseUrl,
    );
    if (imgResult.ok === false) return imgResult;
    imageUrls.push(imgResult.downloadUrl);
  }

  const payload = {
    prompt: req.prompt,
    resolution,
    duration,
    imageUrls: imageUrls.length > 0 ? imageUrls : [],
    videoUrls: [] as string[],
    audioUrls: [] as string[],
    generateAudio: true,
    ratio: aspect,
    realPersonMode: true,
    conversionSlots: ['all'],
    returnLastFrame: false,
  };

  const endpoint = `${config.baseUrl}/openapi/v2/rhart-video/sparkvideo-2.0${isFast ? '-fast' : ''}/multimodal-video`;
  const submitted = await submitTask(endpoint, payload, config.apiKey);
  if (submitted.ok === false) return submitted;
  return pollVideoUntilDone(config, submitted.taskId, maxWaitMs);
}

async function submitTask(
  endpoint: string,
  body: Record<string, unknown>,
  apiKey: string,
): Promise<{ ok: true; taskId: string } | VideoGenFailure> {
  let resp: Response;
  try {
    resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e: unknown) {
    return {
      ok: false,
      kind: 'network',
      message: 'RunningHub 任务提交失败',
      detail: e instanceof Error ? e.message : String(e),
    };
  }
  if (!resp.ok) {
    const parsed = await parseErrorBody(resp);
    return {
      ok: false,
      kind: 'server',
      message: `RunningHub 任务提交失败（${resp.status}）：${parsed.message}`,
      detail: parsed.detail,
    };
  }
  let json: unknown;
  try { json = await resp.json(); } catch {
    return { ok: false, kind: 'empty', message: 'RunningHub 任务提交响应解析失败' };
  }
  const j = json as {
    errorCode?: string;
    error_code?: string;
    errorMessage?: string;
    error_message?: string;
    taskId?: string;
    task_id?: string;
  };
  if (j?.errorCode || j?.errorMessage) {
    return { ok: false, kind: 'server', message: `RunningHub 任务提交失败：${j.errorMessage ?? j.errorCode}` };
  }
  const taskId = j?.taskId ?? j?.task_id;
  if (!taskId) {
    return { ok: false, kind: 'empty', message: 'RunningHub 未返回 taskId', detail: safeStringify(json) };
  }
  return { ok: true, taskId: String(taskId) };
}

/** 杞瑙嗛浠诲姟鐩村埌瀹屾垚锛堟垨瓒呮椂锛夈€傝秴鏃惰繑鍥?pending 浠ヤ究鍚庣画 resume銆?*/
async function pollVideoUntilDone(
  config: ProviderRuntimeConfig,
  taskId: string,
  maxWaitMs: number,
): Promise<VideoGenResult> {
  await sleep(POLL_FIRST_DELAY_MS);
  const deadline = Date.now() + maxWaitMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    const res = await queryVideoOnce(config, taskId);
    if (res.ok === true) {
      if (res.urls.length === 0) {
        return { ok: false, kind: 'empty', message: '任务成功但未返回视频 URL', detail: safeStringify(res) };
      }
      return res;
    }
    if (res.ok === false && res.kind !== 'network') return res;
    const step = [3000, 5000, 8000, 12000, 15000][Math.min(attempt, 4)];
    attempt++;
    await sleep(step);
  }
  return { ok: 'pending', providerId: 'runninghub', taskId } as unknown as VideoGenResult;
}

async function queryVideoOnce(config: ProviderRuntimeConfig, taskId: string): Promise<VideoGenResult> {
  const url = `${config.baseUrl}/openapi/v2/query`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ taskId }),
    });
  } catch (e: unknown) {
    return {
      ok: false,
      kind: 'network',
      message: '查询视频任务失败',
      detail: e instanceof Error ? e.message : String(e),
    };
  }
  if (!resp.ok) {
    const parsed = await parseErrorBody(resp);
    return { ok: false, kind: 'server', message: parsed.message, detail: parsed.detail };
  }

  let data: unknown;
  try {
    data = await resp.json();
  } catch {
    return { ok: false, kind: 'empty', message: '查询响应解析失败' };
  }

  const payload = data as { status?: string; results?: unknown[] };
  if (payload.status === 'SUCCESS') {
    const urls = extractUrls(payload.results);
    return urls.length > 0
      ? { ok: true, urls }
      : { ok: false, kind: 'empty', message: '任务成功但未返回视频 URL', detail: safeStringify(data) };
  }
  if (payload.status === 'FAILED') {
    return { ok: false, kind: 'server', message: '视频任务失败', detail: safeStringify(data) };
  }
  return { ok: 'pending', providerId: 'runninghub', taskId } as unknown as VideoGenResult;
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// 閫氱敤宸ュ叿鍑芥暟
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function extractUrls(results: unknown): string[] {
  if (!Array.isArray(results)) return [];
  const urls: string[] = [];
  for (const r of results) {
    const item = r as { url?: string };
    if (item && typeof item.url === 'string' && item.url.length > 0) urls.push(item.url);
  }
  return urls;
}

/** 鎶婁换鎰忚緭鍏?aspect snap 鍒?RunningHub 鏀寔鐨勬渶杩戞。浣嶃€?*/
function snapAspect(input?: string, allowed?: string[]): string {
  const pool: string[] = allowed ?? [...SUPPORTED_ASPECTS];
  const fallback = pool[0] ?? '1:1';
  if (!input) return fallback;
  if (pool.indexOf(input) >= 0) return input;
  const m = input.match(/^(\d+):(\d+)$/);
  if (!m) return fallback;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!(w > 0) || !(h > 0)) return fallback;
  const target = w / h;
  let best = pool[0] ?? '1:1';
  let bestDelta = Infinity;
  for (const a of pool) {
    const [aw, ah] = a.split(':').map(Number);
    const delta = Math.abs(aw / ah - target);
    if (delta < bestDelta) { bestDelta = delta; best = a; }
  }
  return best;
}

/**
 * 鎴愬姛缁撴灉鍐嶈繃涓€閬?imgbb锛堝鍚敤锛夈€傚拰 t8star 鐨?postProcess 绛変环锛? * 淇濊瘉鏃犺鍝 provider锛屾渶缁堝啓杩涜妭鐐圭殑 URL 閮芥槸 imgbb 绋冲畾澶栭摼銆? */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
