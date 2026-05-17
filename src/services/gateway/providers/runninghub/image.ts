import { useSettingsStore } from '@/store/useSettingsStore';
import { ensurePublicUrl, uploadBatchToImgbb } from '@/services/imgHost/imgbb';
import type {
  ImageGenFailure,
  ImageGenRequest,
  ImageGenResult,
  ImageGenSuccess,
  ProviderRuntimeConfig,
} from '@/services/gateway/types';
import { buildRhNetworkErrorDetail, parseErrorBody, safeStringify } from './errors';

const POLL_FIRST_DELAY_MS = 2000;
const POLL_INTERVALS_MS = [3000, 5000, 8000, 12000, 15000] as const;
const POLL_MAX_WAIT_MS = 5 * 60_000;
const RESUME_POLL_MAX_WAIT_MS = 2 * 60_000;
const SUPPORTED_ASPECTS = [
  '1:1', '3:2', '2:3', '5:4', '4:5',
  '4:3', '3:4', '16:9', '9:16', '21:9',
] as const;

export async function generateRunningHubImage(
  req: ImageGenRequest,
  config: ProviderRuntimeConfig,
): Promise<ImageGenResult> {
  if (!config.apiKey) {
    return { ok: false, kind: 'missingKey', message: '请先在设置中配置 RunningHub 的 API 密钥' };
  }
  if (!config.baseUrl) {
    return { ok: false, kind: 'unknown', message: 'RunningHub Base URL 未配置' };
  }

  const hasMask = typeof req.maskImage === 'string' && req.maskImage.length > 0;
  const hasRefs = (req.referenceImages?.length ?? 0) > 0;

  if (hasMask) {
    return {
      ok: false,
      kind: 'unknown',
      message: 'RunningHub 当前不支持局部重绘，请切换 provider',
    };
  }

  let imageUrls: string[] | undefined;
  if (hasRefs) {
    const prepared = await prepareReferenceUrls(req.referenceImages!);
    if (prepared.ok === false) return prepared;
    imageUrls = prepared.urls;
  }

  const channelId = CHANNELS[req.model] ? req.model : 'rhart-image-g-2';
  const outcome = await runSingleTask(
    config,
    {
      prompt: req.prompt,
      aspect: req.aspect,
      imageUrls,
      channelId,
      resolution: req.resolution,
      qualityLevel: req.qualityLevel,
      signal: req.signal,
    },
    req.onTaskSubmitted,
    POLL_MAX_WAIT_MS,
  );

  if (outcome.ok === true) return postProcessThroughImgHost(outcome);
  return outcome;
}

export async function pollRunningHubImageTask(
  taskId: string,
  config: ProviderRuntimeConfig,
): Promise<ImageGenResult> {
  if (!config.apiKey) {
    return { ok: false, kind: 'missingKey', message: '请先在设置中配置 RunningHub 的 API 密钥' };
  }
  if (!config.baseUrl) {
    return { ok: false, kind: 'unknown', message: 'RunningHub Base URL 未配置' };
  }
  const outcome = await pollTaskUntilDone(config, taskId, RESUME_POLL_MAX_WAIT_MS);
  if (outcome.ok === true) return postProcessThroughImgHost(outcome);
  return outcome;
}

interface RHChannel {
  textPath: string;
  editPath: string;
  buildBody(args: {
    prompt: string;
    aspect: string;
    imageUrls?: string[];
    resolution?: string;
    qualityLevel?: string;
  }): Record<string, unknown>;
}

const CHANNELS: Record<string, RHChannel> = {
  'rhart-image-g-2': {
    textPath: 'rhart-image-g-2/text-to-image',
    editPath: 'rhart-image-g-2/image-to-image',
    buildBody: ({ prompt, aspect, imageUrls }) => {
      const aspectRatio = snapAspect(aspect);
      return imageUrls && imageUrls.length > 0
        ? { prompt, aspectRatio, imageUrls }
        : { prompt, aspectRatio };
    },
  },
  'rhart-image-g-2-official': {
    textPath: 'rhart-image-g-2-official/text-to-image',
    editPath: 'rhart-image-g-2-official/image-to-image',
    buildBody: ({ prompt, aspect, imageUrls, resolution, qualityLevel }) => {
      const aspectRatio = snapAspect(aspect);
      const res = toOfficialResolution(resolution);
      const q = toOfficialQualityLevel(qualityLevel);
      const base = { prompt, aspectRatio, resolution: res, quality: q };
      return imageUrls && imageUrls.length > 0
        ? { ...base, imageUrls }
        : base;
    },
  },
  'rhart-image-n-pro': {
    textPath: 'rhart-image-n-pro/text-to-image',
    editPath: 'rhart-image-n-pro/edit',
    buildBody: ({ prompt, aspect, imageUrls }) => {
      const aspectRatio = snapAspect(aspect);
      return imageUrls && imageUrls.length > 0
        ? { prompt, aspectRatio, imageUrls }
        : { prompt, aspectRatio };
    },
  },
  'rhart-image-n-pro-official': {
    textPath: 'rhart-image-n-pro-official/text-to-image',
    editPath: 'rhart-image-n-pro-official/edit',
    buildBody: ({ prompt, aspect, imageUrls, resolution, qualityLevel }) => {
      const aspectRatio = snapAspect(aspect);
      const res = toOfficialResolution(resolution);
      const q = toOfficialQualityLevel(qualityLevel);
      const base = { prompt, aspectRatio, resolution: res, quality: q };
      return imageUrls && imageUrls.length > 0
        ? { ...base, imageUrls }
        : base;
    },
  },
  'rhart-image-n-pro-official-ultra': {
    textPath: 'rhart-image-n-pro-official/text-to-image-ultra',
    editPath: 'rhart-image-n-pro-official/edit-ultra',
    buildBody: ({ prompt, aspect, imageUrls, resolution }) => {
      const aspectRatio = snapAspect(aspect);
      const res = toOfficialResolution(resolution);
      const base = { prompt, aspectRatio, resolution: res };
      return imageUrls && imageUrls.length > 0
        ? { ...base, imageUrls }
        : base;
    },
  },
  'rhart-image-n-g31-flash': {
    textPath: 'rhart-image-n-g31-flash/text-to-image',
    editPath: 'rhart-image-n-g31-flash/image-to-image',
    buildBody: ({ prompt, aspect, imageUrls }) => {
      const aspectRatio = snapAspect(aspect);
      return imageUrls && imageUrls.length > 0
        ? { prompt, aspectRatio, imageUrls }
        : { prompt, aspectRatio };
    },
  },
  'rhart-image-n-g31-flash-official': {
    textPath: 'rhart-image-n-g31-flash-official/text-to-image',
    editPath: 'rhart-image-n-g31-flash-official/image-to-image',
    buildBody: ({ prompt, aspect, imageUrls, qualityLevel }) => {
      const aspectRatio = snapAspect(aspect);
      const q = toOfficialQualityLevel(qualityLevel);
      const base = { prompt, aspectRatio, quality: q };
      return imageUrls && imageUrls.length > 0
        ? { ...base, imageUrls }
        : base;
    },
  },
};

function toOfficialResolution(resolution: string | undefined): string {
  if (!resolution) return '1k';
  const v = resolution.toLowerCase();
  if (v === '1k' || v === '2k' || v === '4k') return v;
  return '1k';
}

function toOfficialQualityLevel(level: string | undefined): string {
  if (!level) return 'medium';
  const v = level.toLowerCase();
  if (v === 'low' || v === 'medium' || v === 'high') return v;
  return 'medium';
}

async function prepareReferenceUrls(
  sources: string[],
): Promise<{ ok: true; urls: string[] } | ImageGenFailure> {
  const { imgHost } = useSettingsStore.getState();
  if (!imgHost?.apiKey) {
    const anyDataUrl = sources.some(s => /^data:/i.test(s));
    if (anyDataUrl) {
      return {
        ok: false,
        kind: 'missingKey',
        message: 'RunningHub 图生图需要公网参考图 URL，请先在设置中配置 imgbb key 以便自动转存',
      };
    }
  }
  const results = await Promise.all(
    sources.map(src => ensurePublicUrl(src, imgHost?.apiKey ?? '')),
  );
  const urls: string[] = [];
  for (const r of results) {
    if (r.ok === true) urls.push(r.url);
    else {
      return {
        ok: false,
        kind: 'network',
        message: `参考图托管失败：${r.message}`,
        detail: r.fallbackUrl ? `source=${r.fallbackUrl.slice(0, 120)}` : undefined,
      };
    }
  }
  return { ok: true, urls };
}

/** 鎶婁换鎰?鍙兘涓嶆槸 URL"鐨勫崟涓緭鍏ワ紝杞崲鎴愬叕缃?URL銆?*/
async function prepareSingleUrl(src: string): Promise<{ ok: true; url: string } | ImageGenFailure> {
  const { imgHost } = useSettingsStore.getState();
  const anyDataUrl = /^data:/i.test(src);
  if (!imgHost?.apiKey && anyDataUrl) {
    return {
      ok: false,
      kind: 'missingKey',
      message: '需要 imgbb key 将本地文件转换为公网 URL',
    };
  }
  const result = await ensurePublicUrl(src, imgHost?.apiKey ?? '');
  if (result.ok === false) {
    return {
      ok: false,
      kind: 'network',
      message: `素材托管失败：${result.message}`,
      detail: result.fallbackUrl ? `source=${result.fallbackUrl.slice(0, 120)}` : undefined,
    };
  }
  return { ok: true, url: result.url };
}

/**
 * 钀藉湴鍗曚釜浠诲姟锛氭彁浜?鈫?杞 鈫?瑙ｆ瀽 results[].url銆? *
 * `onTaskSubmitted` 鍦?submit 鎴愬姛銆佸紑濮嬭疆璇㈠墠璋冪敤锛岃涓婂眰绔嬪嵆鎶?taskId 瀛樺埌
 * placeholder 涓娿€傝繖鏄?pending 缁疆璇㈢殑鍏抽敭锛氬嵆渚挎湰娆¤疆璇㈣秴鏃?/ 椤甸潰鍒锋柊锛? * 涓嬫鍚姩閮借兘鍑繖涓凡鎸佷箙鍖栫殑 taskId 鎺ョ潃鏌ャ€? */
async function runSingleTask(
  config: ProviderRuntimeConfig,
  task: {
    prompt: string;
    aspect: string;
    imageUrls?: string[];
    channelId: string;
    resolution?: string;
    qualityLevel?: string;
    signal?: AbortSignal;
  },
  onTaskSubmitted: ImageGenRequest['onTaskSubmitted'],
  maxWaitMs: number,
): Promise<ImageGenResult> {
  const channel = CHANNELS[task.channelId] ?? CHANNELS['rhart-image-g-2'];
  const isImg2Img = !!task.imageUrls && task.imageUrls.length > 0;
  const path = isImg2Img ? channel.editPath : channel.textPath;
  const endpoint = `${config.baseUrl}/openapi/v2/${path}`;

  const body = channel.buildBody({
    prompt: task.prompt,
    aspect: task.aspect,
    imageUrls: task.imageUrls,
    resolution: task.resolution,
    qualityLevel: task.qualityLevel,
  });

  let submitResp: Response;
  try {
    submitResp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: task.signal,
    });
  } catch (e: unknown) {
    return {
      ok: false,
      kind: 'network',
      message: '网络请求失败',
      detail: buildRhNetworkErrorDetail(endpoint, e),
    };
  }

  if (!submitResp.ok) {
    const parsed = await parseErrorBody(submitResp);
    return { ok: false, kind: 'server', message: parsed.message, detail: parsed.detail };
  }

  let submitData: unknown;
  try {
    submitData = await submitResp.json();
  } catch {
    return { ok: false, kind: 'empty', message: '提交任务响应解析失败' };
  }

  const sd = submitData as { status?: string; taskId?: string; results?: unknown[] };
  if (sd?.status === 'SUCCESS') {
    const urls = extractUrls(sd?.results);
    if (urls.length > 0) return { ok: true, urls };
  }
  if (sd?.status === 'FAILED') {
    return mkFailureFromTask(submitData);
  }

  const taskId: string | undefined = sd?.taskId;
  if (!taskId) {
    return {
      ok: false,
      kind: 'empty',
      message: '服务未返回 taskId',
      detail: safeStringify(submitData),
    };
  }

  try {
    onTaskSubmitted?.({ providerId: 'runninghub', taskId });
  } catch {
    // 回调异常不应影响主流程。
  }

  return pollTaskUntilDone(config, taskId, maxWaitMs);
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// 閫氱敤杞 / 鏌ヨ
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

/**
 * 鍗曟 API 鏌ヨ 鈥斺€?涓嶇瓑寰呬笉杞锛宼askResume / generateImage 鍏辩敤銆? * 杩斿洖 pending 琛ㄧず"杩樺湪璺?锛涜繑鍥?success/failure 琛ㄧず宸茬粓缁撱€? */
async function queryOnce(config: ProviderRuntimeConfig, taskId: string): Promise<ImageGenResult> {
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
      message: '查询任务失败',
      detail: buildRhNetworkErrorDetail(url, e),
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
  const d = data as { status?: string; results?: unknown[] };
  const status: string | undefined = d?.status;
  if (status === 'SUCCESS') {
    const urls = extractUrls(d?.results);
    if (urls.length === 0) {
      return { ok: false, kind: 'empty', message: '任务成功但未返回 URL', detail: safeStringify(data) };
    }
    return { ok: true, urls };
  }
  if (status === 'FAILED') {
    return mkFailureFromTask(data);
  }
  return { ok: 'pending', providerId: 'runninghub', taskId };
}

/**
 * 鎸夋寚鏁伴€€閬胯疆璇㈠埌 maxWait銆備换浣曟椂鍊欐嬁鍒扮粓缁撴€侊紙鎴愬姛/澶辫触锛夐兘绔嬪嵆杩斿洖锛? * 鏃堕棿绐楄€楀敖浠嶆槸 pending 鍒欏師鏍疯繑鍥?pending锛岃 caller 鎶?taskId 钀藉埌鎸佷箙鍖栭€氶亾銆? */
async function pollTaskUntilDone(
  config: ProviderRuntimeConfig,
  taskId: string,
  maxWaitMs: number,
): Promise<ImageGenResult> {
  await sleep(POLL_FIRST_DELAY_MS);
  const deadline = Date.now() + maxWaitMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    const res = await queryOnce(config, taskId);
    if (res.ok === true) return res;
    if (res.ok === false) {
      if (res.kind !== 'network') return res;
    }
    const step = POLL_INTERVALS_MS[Math.min(attempt, POLL_INTERVALS_MS.length - 1)];
    attempt++;
    await sleep(step);
  }

  return { ok: 'pending', providerId: 'runninghub', taskId };
}

function mkFailureFromTask(data: unknown): ImageGenFailure {
  const d = data as {
    errorMessage?: string;
    failedReason?: { message?: string; error?: string };
  };
  const msg =
    d?.errorMessage ||
    d?.failedReason?.message ||
    d?.failedReason?.error ||
    '任务失败';
  return {
    ok: false,
    kind: 'server',
    message: String(msg),
    detail: safeStringify(d?.failedReason ?? data),
  };
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// 瑙嗛鐢熸垚鐩稿叧
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

/**
 * 灏嗘湰鍦板獟浣撴枃浠朵笂浼犲埌 RunningHub锛岃繑鍥?download_url銆? * 鐢ㄤ簬 sparkvideo-2.0 绛夎棰戞笭閬撯€斺€旇繖浜涚鐐逛笉鎺ュ彈 data URL锛? * 蹇呴』鐩存帴鐢?RunningHub 鐨?media/upload 绔偣銆? */
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
async function postProcessThroughImgHost(result: ImageGenSuccess): Promise<ImageGenResult> {
  const { imgHost } = useSettingsStore.getState();
  if (!imgHost?.enabled || !imgHost.apiKey) return result;
  const { urls } = await uploadBatchToImgbb(result.urls, imgHost.apiKey, {
    namePrefix: `runninghub-${Date.now()}`,
  });
  return { ok: true, urls };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
