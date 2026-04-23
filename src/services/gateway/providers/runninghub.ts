import { useSettingsStore } from '../../../store/useSettingsStore';
import { ensurePublicUrl, uploadBatchToImgbb } from '../../imgHost/imgbb';
import type {
  GatewayProvider,
  ImageGenFailure,
  ImageGenRequest,
  ImageGenResult,
  ImageGenSuccess,
  ProviderRuntimeConfig,
} from '../types';

/**
 * RunningHub (runninghub.cn) — 全能图片 G-2.0 系列。
 *
 * 和同步风格的 t8star 最大的不同：**异步任务模型**。
 *
 *   ① 提交任务：
 *        POST {baseUrl}/openapi/v2/rhart-image-g-2/text-to-image
 *        POST {baseUrl}/openapi/v2/rhart-image-g-2/image-to-image
 *        → 立即拿到 { taskId, status: "RUNNING" }
 *
 *   ② 轮询查询：
 *        POST {baseUrl}/openapi/v2/query  { taskId }
 *        → { status: "QUEUED|RUNNING|SUCCESS|FAILED", results: [{url,...}], errorMessage }
 *
 * 上层语义：`generateImage` **不保证**同步拿到最终图。三种可能：
 *   - ok:true                → 图已就绪
 *   - ok:false               → provider 明确失败
 *   - ok:'pending' + taskId  → 提交成功但本轮轮询窗口耗尽仍在跑；caller
 *                              负责把 taskId 持久化到 placeholder，稍后由
 *                              `pollImageTask` / `taskResume` 接回
 *
 * 这样即便服务端排队 20 分钟我们也不会吞钱——刷新 / 重开浏览器都能按
 * taskId 继续查。
 *
 * 其它约束：
 *   · 图生端点 imageUrls[] 只接受**公网 URL**，不接受 base64；
 *     data URL / 裸 base64 在提交前先过 imgbb 转成 https 链接；
 *   · 接口只吃固定 aspectRatio 枚举，不吃自由 WxH——所以我们优先用
 *     req.aspect（NodeInputBar 已经透传），如果不在支持枚举里就 snap 到最近档；
 *   · 没有 n 参数，一次一张。由上层（imageGeneration.ts）扇出 n 次并发调用。
 */

// 文档里 text-to-image 和 image-to-image 支持的 aspectRatio 并集。
// （t2i 多一个 '5:4/4:5'，i2i 带 '21:9'；我们走并集，请求前按场景再校验。）
const SUPPORTED_ASPECTS = [
  '1:1', '3:2', '2:3', '5:4', '4:5',
  '4:3', '3:4', '16:9', '9:16', '21:9',
] as const;

/**
 * 轮询节奏：
 *   · 首次延迟 2s（任务刚入队不太可能这么快出结果）
 *   · 指数退避 3s → 5s → 8s → 12s → 15s 封顶（减少 query API 压力）
 *   · 首轮窗口 5min——覆盖绝大多数正常峰值；没跑完就回 pending 让 caller
 *     把 taskId 存下来，接到持久化恢复通道
 *   · resume 再查时用更短的 2min 窗口（`RESUME_POLL_MAX_WAIT_MS`），
 *     避免每次启动都长挂
 */
const POLL_FIRST_DELAY_MS = 2000;
const POLL_INTERVALS_MS = [3000, 5000, 8000, 12000, 15000] as const;
const POLL_MAX_WAIT_MS = 5 * 60_000;
const RESUME_POLL_MAX_WAIT_MS = 2 * 60_000;

export const RunningHubProvider: GatewayProvider = {
  id: 'runninghub',
  name: 'RunningHub',
  capabilities: ['image'],
  auth: 'bearer',
  authHint: '异步任务模型，提交后轮询查询；图生参考图会自动经 imgbb 托管',
  // label 和 id 都使用 wire-level 路径名（URL 里就是 `rhart-image-g-2`），
  // 和 t8star 的 `gpt-image-2` 同构。caption 给出官方中文正式名。
  models: [
    {
      id: 'rhart-image-g-2',
      providerId: 'runninghub',
      capability: 'image',
      label: 'rhart-image-g-2',
      caption: '全能图片 G-2.0 · 异步任务',
      supportsSize: false, // 只吃 aspectRatio
      // 注意：RH 协议本身一次一张；n>1 由上层（imageGeneration.ts）为每个
      // placeholder 各扇出一条 generateImage(n=1) 调用来实现，provider 内部
      // 不再做并发 fanout。这样 taskId 和 placeholder 天然是 1:1 对应。
      supportsN: true,
    },
  ],

  async generateImage(req: ImageGenRequest, config: ProviderRuntimeConfig): Promise<ImageGenResult> {
    if (!config.apiKey) {
      return { ok: false, kind: 'missingKey', message: '请先在设置中配置 RunningHub 的 API 密钥' };
    }
    if (!config.baseUrl) {
      return { ok: false, kind: 'unknown', message: 'RunningHub Base URL 未配置' };
    }

    const aspect = snapAspect(req.aspect);
    const hasMask = typeof req.maskImage === 'string' && req.maskImage.length > 0;
    const hasRefs = (req.referenceImages?.length ?? 0) > 0;

    // 本家文档暂不公开 inpaint 蒙版字段，功能不支持就直接告知，别让 400 兜底到用户脸上。
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

    // 一次调用对应一个 taskId、一个 placeholder。提交成功后立即触发
    // onTaskSubmitted 让上层落盘 pendingTask——哪怕后续轮询超时，taskId
    // 也已经持久化，不会丢。
    const outcome = await runSingleTask(
      config,
      { prompt: req.prompt, aspect, imageUrls },
      req.onTaskSubmitted,
      POLL_MAX_WAIT_MS,
    );

    if (outcome.ok === true) {
      // 成功的 URL 再过一遍 imgbb（如果启用），和 t8star 行为一致。
      // 外部渠道返回的 COS 链接不一定长期可访问，先转存再落盘最稳。
      return postProcessThroughImgHost(outcome);
    }
    return outcome;
  },

  async pollImageTask(taskId: string, config: ProviderRuntimeConfig): Promise<ImageGenResult> {
    if (!config.apiKey) {
      return { ok: false, kind: 'missingKey', message: '请先在设置中配置 RunningHub 的 API 密钥' };
    }
    if (!config.baseUrl) {
      return { ok: false, kind: 'unknown', message: 'RunningHub Base URL 未配置' };
    }
    // resume 场景用更短的超时——每次启动都重来一次，避免一次挂太久。
    const outcome = await pollTaskUntilDone(config, taskId, RESUME_POLL_MAX_WAIT_MS);
    if (outcome.ok === true) return postProcessThroughImgHost(outcome);
    return outcome;
  },
};

/** 把任意"可能不是 URL"的参考图列表，转换成一批公网 URL。 */
async function prepareReferenceUrls(
  sources: string[],
): Promise<{ ok: true; urls: string[] } | ImageGenFailure> {
  const { imgHost } = useSettingsStore.getState();
  if (!imgHost?.apiKey) {
    // 如果根本没 imgbb key，data URL 无法转换。用户必须要么关掉 data URL 来源，
    // 要么配置 key。这里提前失败比让 RunningHub 返回 URL invalid 更友好。
    const anyDataUrl = sources.some(s => /^data:/i.test(s));
    if (anyDataUrl) {
      return {
        ok: false,
        kind: 'missingKey',
        message: 'RunningHub 图生需要公网参考图 URL，请先在设置中配置 imgbb key 以便自动转存',
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

/**
 * 落地单个任务：提交 → 轮询 → 解析 results[].url。
 *
 * `onTaskSubmitted` 在 submit 成功、开始轮询前调用，让上层立即把 taskId 存到
 * placeholder 上。这是 pending 续轮询的关键：即便本次轮询超时 / 页面刷新，
 * 下次启动都能凭这个已持久化的 taskId 接着查。
 */
async function runSingleTask(
  config: ProviderRuntimeConfig,
  task: { prompt: string; aspect: string; imageUrls?: string[] },
  onTaskSubmitted: ImageGenRequest['onTaskSubmitted'],
  maxWaitMs: number,
): Promise<ImageGenResult> {
  const isImg2Img = !!task.imageUrls && task.imageUrls.length > 0;
  const endpoint = isImg2Img
    ? `${config.baseUrl}/openapi/v2/rhart-image-g-2/image-to-image`
    : `${config.baseUrl}/openapi/v2/rhart-image-g-2/text-to-image`;

  const body = isImg2Img
    ? { prompt: task.prompt, aspectRatio: task.aspect, imageUrls: task.imageUrls }
    : { prompt: task.prompt, aspectRatio: task.aspect };

  let submitResp: Response;
  try {
    submitResp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    return {
      ok: false,
      kind: 'network',
      message: '网络请求失败，请检查网络或 Base URL',
      detail: e?.message ? String(e.message) : undefined,
    };
  }

  if (!submitResp.ok) {
    const parsed = await parseErrorBody(submitResp);
    return { ok: false, kind: 'server', message: parsed.message, detail: parsed.detail };
  }

  let submitData: any;
  try {
    submitData = await submitResp.json();
  } catch {
    return { ok: false, kind: 'empty', message: '提交任务响应解析失败' };
  }

  // 有些网关会在 submit 阶段就带 SUCCESS + results（罕见但文档不排除）。
  if (submitData?.status === 'SUCCESS') {
    const urls = extractUrls(submitData?.results);
    if (urls.length > 0) return { ok: true, urls };
  }
  // 有些则会在 submit 阶段就报 FAILED（例如内容审核）。
  if (submitData?.status === 'FAILED') {
    return mkFailureFromTask(submitData);
  }

  const taskId: string | undefined = submitData?.taskId;
  if (!taskId) {
    return {
      ok: false,
      kind: 'empty',
      message: '服务未返回 taskId',
      detail: safeStringify(submitData),
    };
  }

  // 拿到 taskId 的第一时间就通知上层落盘，哪怕下一行的 poll 崩了 taskId
  // 也已经安全入库，resume 通道可以接得上。
  try {
    onTaskSubmitted?.({ providerId: 'runninghub', taskId });
  } catch {
    // 回调里抛异常不应该影响我们的主流程。
  }

  return pollTaskUntilDone(config, taskId, maxWaitMs);
}

/**
 * 单次 API 查询 —— 不等待不轮询，taskResume / generateImage 共用。
 * 返回 pending 表示"还在跑"；返回 success/failure 表示已终结。
 */
async function queryOnce(config: ProviderRuntimeConfig, taskId: string): Promise<ImageGenResult> {
  let resp: Response;
  try {
    resp = await fetch(`${config.baseUrl}/openapi/v2/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ taskId }),
    });
  } catch (e: any) {
    return {
      ok: false,
      kind: 'network',
      message: '查询任务失败',
      detail: e?.message ? String(e.message) : undefined,
    };
  }
  if (!resp.ok) {
    const parsed = await parseErrorBody(resp);
    return { ok: false, kind: 'server', message: parsed.message, detail: parsed.detail };
  }
  let data: any;
  try {
    data = await resp.json();
  } catch {
    return { ok: false, kind: 'empty', message: '查询响应解析失败' };
  }
  const status: string | undefined = data?.status;
  if (status === 'SUCCESS') {
    const urls = extractUrls(data?.results);
    if (urls.length === 0) {
      return { ok: false, kind: 'empty', message: '任务成功但未返回 URL', detail: safeStringify(data) };
    }
    return { ok: true, urls };
  }
  if (status === 'FAILED') {
    return mkFailureFromTask(data);
  }
  // QUEUED / RUNNING / 未知 → 仍在跑。
  return { ok: 'pending', providerId: 'runninghub', taskId };
}

/**
 * 按指数退避轮询到 maxWait。任何时候拿到终结态（成功/失败）都立即返回；
 * 时间窗耗尽仍是 pending 则原样返回 pending，让 caller 把 taskId 落到
 * 持久化通道。
 *
 * 与之前相比：
 *   - 超时**不再**转成 failure（那会让用户以为任务失败，还让钱白花）
 *   - 单次 query 的网络瞬断也只是"当次作废、下一轮再来"，不返回 failure
 */
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
      // 明确失败（含服务 5xx / 解析错 / FAILED）直接回报——重试没意义。
      // 例外：网络瞬断走 fall-through，继续下一轮；否则 DNS 抖动一次就爆
      // 用户体验不好。
      if (res.kind !== 'network') return res;
    }
    // pending 或瞬时 network，退避一轮再来。
    const step = POLL_INTERVALS_MS[Math.min(attempt, POLL_INTERVALS_MS.length - 1)];
    attempt++;
    await sleep(step);
  }

  // 时间窗耗尽，任务仍在跑——返回 pending 让上层持久化 / 续轮询。
  return { ok: 'pending', providerId: 'runninghub', taskId };
}

function mkFailureFromTask(data: any): ImageGenFailure {
  const msg =
    data?.errorMessage ||
    data?.failedReason?.message ||
    data?.failedReason?.error ||
    '任务失败';
  return {
    ok: false,
    kind: 'server',
    message: String(msg),
    detail: safeStringify(data?.failedReason ?? data),
  };
}

function extractUrls(results: any): string[] {
  if (!Array.isArray(results)) return [];
  const urls: string[] = [];
  for (const r of results) {
    if (r && typeof r.url === 'string' && r.url.length > 0) urls.push(r.url);
  }
  return urls;
}

/** 把任意输入 aspect snap 到 RunningHub 支持的最近档位。 */
function snapAspect(input?: string): string {
  if (!input) return '1:1';
  if ((SUPPORTED_ASPECTS as readonly string[]).includes(input)) return input;
  // 输入形如 '16:9'/'1280:720' 不在枚举内时，按数值比反推最近枚举项。
  const m = input.match(/^(\d+):(\d+)$/);
  if (!m) return '1:1';
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!(w > 0) || !(h > 0)) return '1:1';
  const target = w / h;
  let best = SUPPORTED_ASPECTS[0] as string;
  let bestDelta = Infinity;
  for (const a of SUPPORTED_ASPECTS) {
    const [aw, ah] = a.split(':').map(Number);
    const delta = Math.abs(aw / ah - target);
    if (delta < bestDelta) { bestDelta = delta; best = a; }
  }
  return best;
}

/**
 * 成功结果再过一遍 imgbb（如启用）。和 t8star 的 postProcess 等价，
 * 保证无论哪家 provider，最终写进节点的 URL 都是 imgbb 稳定外链。
 */
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

async function parseErrorBody(res: Response): Promise<{ message: string; detail?: string }> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      const msg =
        json?.errorMessage ||
        json?.error?.message ||
        json?.error?.code ||
        json?.message ||
        `${res.status} ${res.statusText || 'Request failed'}`;
      return { message: String(msg), detail: text };
    } catch {
      return {
        message: `${res.status} ${res.statusText || 'Request failed'}`,
        detail: text || undefined,
      };
    }
  } catch {
    return { message: `${res.status} ${res.statusText || 'Request failed'}` };
  }
}

function safeStringify(v: unknown): string | undefined {
  try {
    return JSON.stringify(v).slice(0, 500);
  } catch {
    return undefined;
  }
}
