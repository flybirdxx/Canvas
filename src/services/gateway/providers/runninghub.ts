import { useSettingsStore } from '@/store/useSettingsStore';
import { ensurePublicUrl, uploadBatchToImgbb } from '@/services/imgHost/imgbb';
import type {
  GatewayProvider,
  ImageGenFailure,
  ImageGenRequest,
  ImageGenResult,
  ImageGenSuccess,
  ProviderRuntimeConfig,
  TextGenRequest,
  TextGenResult,
  VideoGenRequest,
  VideoGenResult,
} from '@/services/gateway/types';

/**
 * RunningHub (runninghub.cn / llm.runninghub.ai)
 *
 * 图像：全能图片 G-2.0 系列 + 全能图片PRO + 全能图片V2
 * 视频：SD2.0 (Seedance-V2) sparkvideo-2.0 / sparkvideo-2.0-fast
 * 文本：Gemini 3.1 Pro/Flash Lite + DeepSeek V4 Pro/Flash (OpenAI Chat 兼容协议)
 *
 * 图像/视频走异步任务模型（submit → poll /openapi/v2/query），body schema 按渠道分叉。
 * 文本走同步 OpenAI Chat Completion 协议（POST /v1/chat/completions），
 * 使用独立的 llm.runninghub.ai 域名，但鉴权复用同一个 API Key。
 *
 * 图像渠道（路径前缀均含 `rhart-image-*`）：
 *   · rhart-image-g-2  —— 低价渠道
 *   · rhart-image-g-2-official —— 官方稳定版
 *   · rhart-image-n-pro      —— 全能图片PRO 低价渠道
 *   · rhart-image-n-pro-official —— 全能图片PRO 官方稳定版
 *   · rhart-image-n-g31-flash —— 全能图片V2 低价渠道
 *   · rhart-image-n-g31-flash-official —— 全能图片V2 官方稳定版
 *   · rhart-image-n-g31-flash-official-ultra —— 全能图片V2 Ultra
 *
 * 视频渠道（路径前缀均含 `rhart-video/sparkvideo-*`）：
 *   · rhart-video/sparkvideo-2.0/text-to-video      —— SD2.0 文生视频
 *   · rhart-video/sparkvideo-2.0/image-to-video     —— SD2.0 图生视频
 *   · rhart-video/sparkvideo-2.0/multimodal-video    —— SD2.0 全能参考视频
 *   · rhart-video/sparkvideo-2.0-fast/text-to-video —— SD2.0-Fast 文生视频
 *   · rhart-video/sparkvideo-2.0-fast/image-to-video—— SD2.0-Fast 图生视频
 *   · rhart-video/sparkvideo-2.0-fast/multimodal-video—— SD2.0-Fast 全能参考视频
 *
 * 文本渠道（独立域名 llm.runninghub.ai）：
 *   · google/gemini-3.1-pro-preview         —— Gemini 3.1 Pro
 *   · google/gemini-3.1-flash-lite-preview  —— Gemini 3.1 Flash Lite
 *   · deepseek/deepseek-v4-pro              —— DeepSeek V4 Pro
 *   · deepseek/deepseek-v4-flash            —— DeepSeek V4 Flash
 *
 * 轮询响应 schema 所有渠道一致：
 *   POST /openapi/v2/query  { taskId }
 *   → { status: "QUEUED|RUNNING|SUCCESS|FAILED", results: [{url,...}], errorMessage }
 *
 * 上层语义：`generateImage` / `generateVideo` **不保证**同步拿到最终结果。三种可能：
 *   - ok:true                → 已就绪
 *   - ok:false              → provider 明确失败
 *   - ok:'pending' + taskId  → 提交成功但本轮轮询窗口耗尽仍在跑；
 *                               caller 负责把 taskId 持久化到 placeholder，
 *                               稍后由 `pollImageTask` / `taskResume` 接回
 *
 * `generateText` 走同步路径（等价于 t8star 风格），一次 HTTP 往返即可。
 *
 * 其它约束：
 *   · 所有渠道的 IMAGE 类型字段只接受**公网 URL**，不接受 base64；
 *     data URL / 裸 base64 在提交前先过 imgbb 转成 https 链接；
 *   · 图像渠道都没有 n 参数，一次一张。由上层（imageGeneration.ts）扇出
 *     n 次并发调用；
 *   · 视频渠道要求 imageUrls / videoUrls / audioUrls 必须先上传
 *     到 RunningHub 获取 download_url，再提交任务。
 */

// 图像渠道 t2i + i2i 接受的 aspectRatio 并集（10 档）。
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
 *   · 视频任务（`VIDEO_POLL_MAX_WAIT_MS`）更长：10min，因为视频生成耗时更久。
 */
const POLL_FIRST_DELAY_MS = 2000;
const POLL_INTERVALS_MS = [3000, 5000, 8000, 12000, 15000] as const;
const POLL_MAX_WAIT_MS = 5 * 60_000;
const RESUME_POLL_MAX_WAIT_MS = 2 * 60_000;
const VIDEO_POLL_MAX_WAIT_MS = 10 * 60_000;

/**
 * 每条图像渠道的请求构造策略——URL 路径段 + 对应的 JSON body。
 */
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

export const RunningHubProvider: GatewayProvider = {
  id: 'runninghub',
  name: 'RunningHub',
  capabilities: ['image', 'video', 'text'],
  auth: 'bearer',
  authHint: '异步任务模型，提交后轮询查询；图生参考图会自动经 imgbb 托管',
  models: [
    {
      id: 'rhart-image-g-2',
      providerId: 'runninghub',
      capability: 'image',
      label: 'rhart-image-g-2',
      caption: '全能图片 G-2.0 · 低价渠道（不稳定）',
      supportsSize: false,
      supportsN: true,
      supportedAspects: [
        '1:1', '3:2', '2:3', '5:4', '4:5',
        '4:3', '3:4', '16:9', '9:16', '21:9',
      ],
      pricing: { currency: '¥', flat: 0.1 },
    },
    {
      id: 'rhart-image-g-2-official',
      providerId: 'runninghub',
      capability: 'image',
      label: 'rhart-image-g-2-official',
      caption: '全能图片 G-2.0 · 官方稳定版',
      supportsSize: false,
      supportsN: true,
      supportedAspects: [
        '1:1', '3:2', '2:3', '5:4', '4:5',
        '4:3', '3:4', '16:9', '9:16', '21:9',
      ],
      supportedResolutions: ['1K', '2K', '4K'],
      supportedQualityLevels: ['low', 'medium', 'high'],
      pricing: {
        currency: '¥',
        matrix: {
          low:    { '1k': 0.29, '2k': 0.42, '4k': 0.96 },
          medium: { '1k': 0.37, '2k': 0.89, '4k': 1.32 },
          high:   { '1k': 1.54, '2k': 2.82, '4k': 4.52 },
        },
      },
    },

    // ── 全能图片PRO (nano-banana-pro) ─────────────────────────────────
    {
      id: 'rhart-image-n-pro',
      providerId: 'runninghub',
      capability: 'image',
      label: '全能图片PRO',
      caption: '全能图片 PRO · 低价渠道',
      supportsSize: false,
      supportsN: true,
      supportedAspects: ['1:1','3:2','2:3','5:4','4:5','4:3','3:4','16:9','9:16','21:9'],
      pricing: { currency: '¥', flat: 0.15 },
    },
    {
      id: 'rhart-image-n-pro-official',
      providerId: 'runninghub',
      capability: 'image',
      label: '全能图片PRO · 官方稳定版',
      caption: '全能图片 PRO · 官方稳定版（1K/2K/4K + 质量档位）',
      supportsSize: false,
      supportsN: true,
      supportedAspects: ['1:1','3:2','2:3','5:4','4:5','4:3','3:4','16:9','9:16','21:9'],
      supportedResolutions: ['1K','2K','4K'],
      supportedQualityLevels: ['low','medium','high'],
      pricing: { currency: '¥', matrix: { low:{'1k':0.34,'2k':0.49,'4k':1.02}, medium:{'1k':0.43,'2k':0.97,'4k':1.45}, high:{'1k':1.6,'2k':2.89,'4k':4.59} } },
    },
    {
      id: 'rhart-image-n-pro-official-ultra',
      providerId: 'runninghub',
      capability: 'image',
      label: '全能图片PRO · Ultra',
      caption: '全能图片 PRO · 官方 Ultra 高画质版',
      supportsSize: false,
      supportsN: true,
      supportedAspects: ['1:1','3:2','2:3','5:4','4:5','4:3','3:4','16:9','9:16','21:9'],
      supportedResolutions: ['1K','2K','4K'],
      pricing: { currency: '¥', matrix: { '1k':2.0, '2k':3.5, '4k':5.5 } },
    },

    // ── 全能图片V2 (nano-banana2-gemini31flash) ────────────────────────
    {
      id: 'rhart-image-n-g31-flash',
      providerId: 'runninghub',
      capability: 'image',
      label: '全能图片V2',
      caption: '全能图片 V2 · 低价渠道（Gemini Flash）',
      supportsSize: false,
      supportsN: true,
      supportedAspects: ['1:1','3:2','2:3','5:4','4:5','4:3','3:4','16:9','9:16','21:9'],
      pricing: { currency: '¥', flat: 0.12 },
    },
    {
      id: 'rhart-image-n-g31-flash-official',
      providerId: 'runninghub',
      capability: 'image',
      label: '全能图片V2 · 官方稳定版',
      caption: '全能图片 V2 · 官方稳定版（Gemini Flash + 质量档位）',
      supportsSize: false,
      supportsN: true,
      supportedAspects: ['1:1','3:2','2:3','5:4','4:5','4:3','3:4','16:9','9:16','21:9'],
      supportedQualityLevels: ['low','medium','high'],
      pricing: { currency: '¥', matrix: { low:{'1k':0.25,'2k':0.38}, medium:{'1k':0.32,'2k':0.76}, high:{'1k':1.25,'2k':2.30} } },
    },

    // ── SD2.0 视频模型（sparkvideo-2.0）────────────────────────────────
    {
      id: 'sparkvideo-2.0-text',
      providerId: 'runninghub',
      capability: 'video',
      label: 'SD2.0 · 文生视频',
      caption: 'SD2.0 · Seedance-V2 · 文生视频（标准版）',
      supportedAspects: ['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
      pricing: {
        currency: '¥',
        matrix: {
          '480p': 0.6,
          '720p': 1.2,
          'native1080p': 3.0,
          '1080p': 1.48,
          '2k': 1.62,
          '4k': 1.83,
        },
      },
    },
    {
      id: 'sparkvideo-2.0-image',
      providerId: 'runninghub',
      capability: 'video',
      label: 'SD2.0 · 图生视频',
      caption: 'SD2.0 · Seedance-V2 · 图生视频（标准版）',
      supportedAspects: ['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
      pricing: {
        currency: '¥',
        matrix: {
          '480p': 0.6,
          '720p': 1.2,
          'native1080p': 3.0,
          '1080p': 1.48,
          '2k': 1.62,
          '4k': 1.83,
        },
      },
    },
    {
      id: 'sparkvideo-2.0-multimodal',
      providerId: 'runninghub',
      capability: 'video',
      label: 'SD2.0 · 全能参考视频',
      caption: 'SD2.0 · Seedance-V2 · 全能参考视频（标准版）',
      supportedAspects: ['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
      pricing: {
        currency: '¥',
        matrix: {
          '480p': 0.6,
          '720p': 1.2,
          'native1080p': 3.0,
          '1080p': 1.48,
          '2k': 1.62,
          '4k': 1.83,
        },
      },
    },

    // ── SD2.0-Fast 视频模型（sparkvideo-2.0-fast）──────────────────────
    {
      id: 'sparkvideo-2.0-fast-text',
      providerId: 'runninghub',
      capability: 'video',
      label: 'SD2.0-Fast · 文生视频',
      caption: 'SD2.0-Fast · Seedance-V2 · 文生视频（快速版）',
      supportedAspects: ['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
      pricing: {
        currency: '¥',
        matrix: {
          '480p': 0.5,
          '720p': 1.0,
          '1080p': 1.28,
          '2k': 1.42,
          '4k': 1.63,
        },
      },
    },
    {
      id: 'sparkvideo-2.0-fast-image',
      providerId: 'runninghub',
      capability: 'video',
      label: 'SD2.0-Fast · 图生视频',
      caption: 'SD2.0-Fast · Seedance-V2 · 图生视频（快速版）',
      supportedAspects: ['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
      pricing: {
        currency: '¥',
        matrix: {
          '480p': 0.5,
          '720p': 1.0,
          '1080p': 1.28,
          '2k': 1.42,
          '4k': 1.63,
        },
      },
    },
    {
      id: 'sparkvideo-2.0-fast-multimodal',
      providerId: 'runninghub',
      capability: 'video',
      label: 'SD2.0-Fast · 全能参考视频',
      caption: 'SD2.0-Fast · Seedance-V2 · 全能参考视频（快速版）',
      supportedAspects: ['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
      pricing: {
        currency: '¥',
        matrix: {
          '480p': 0.5,
          '720p': 1.0,
          '1080p': 1.28,
          '2k': 1.42,
          '4k': 1.63,
        },
      },
    },

    // ── LLM 文本模型 ─────────────────────────────────────────────────
    {
      id: 'google/gemini-3.1-pro-preview',
      providerId: 'runninghub',
      capability: 'text',
      label: 'Gemini 3.1 Pro',
      caption: '谷歌最强预览版，适合复杂推理与创意写作',
      pricing: { currency: '¥', flat: 0 },
    },
    {
      id: 'google/gemini-3.1-flash-lite-preview',
      providerId: 'runninghub',
      capability: 'text',
      label: 'Gemini 3.1 Flash Lite',
      caption: '极速响应，适合短文本生成与提示词精修',
      pricing: { currency: '¥', flat: 0 },
    },
    {
      id: 'deepseek/deepseek-v4-pro',
      providerId: 'runninghub',
      capability: 'text',
      label: 'DeepSeek V4 Pro',
      caption: '深度求索最新专业版，代码与逻辑能力极强',
      pricing: { currency: '¥', flat: 0 },
    },
    {
      id: 'deepseek/deepseek-v4-flash',
      providerId: 'runninghub',
      capability: 'text',
      label: 'DeepSeek V4 Flash',
      caption: '高性价比大模型，适合大规模文本处理',
      pricing: { currency: '¥', flat: 0 },
    },
  ],

  async generateImage(req: ImageGenRequest, config: ProviderRuntimeConfig): Promise<ImageGenResult> {
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

    if (outcome.ok === true) {
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
    const outcome = await pollTaskUntilDone(config, taskId, RESUME_POLL_MAX_WAIT_MS);
    if (outcome.ok === true) return postProcessThroughImgHost(outcome);
    return outcome;
  },

  async generateVideo(req: VideoGenRequest, config: ProviderRuntimeConfig): Promise<VideoGenResult> {
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
  },

  async generateText(req: TextGenRequest, config: ProviderRuntimeConfig): Promise<TextGenResult> {
    if (!config.apiKey) {
      return { ok: false, kind: 'missingKey', message: '请先在设置中配置 RunningHub 的 API 密钥' };
    }

    const LLM_BASE = 'https://llm.runninghub.ai';
    const endpoint = `${LLM_BASE}/v1/chat/completions`;

    const body = {
      model: req.model,
      messages: req.messages,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.7,
    };

    let resp: Response;
    try {
      resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: req.signal,
      });
    } catch (e: unknown) {
      return {
        ok: false,
        kind: 'network',
        message: 'LLM 网络请求失败',
        detail: buildRhNetworkErrorDetail(endpoint, e),
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
      return { ok: false, kind: 'empty', message: 'LLM 响应解析失败' };
    }

    // OpenAI Chat Completion response shape
    const d = data as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string; code?: string };
    };

    if (d.error) {
      return {
        ok: false,
        kind: 'server',
        message: d.error.message ?? d.error.code ?? 'LLM 服务返回错误',
        detail: safeStringify(d.error),
      };
    }

    const content = d.choices?.[0]?.message?.content;
    if (!content) {
      return {
        ok: false,
        kind: 'empty',
        message: 'LLM 未返回文本内容',
        detail: safeStringify(data),
      };
    }

    return { ok: true, text: content };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 图像渠道辅助函数
// ─────────────────────────────────────────────────────────────────────────────

/** 把任意"可能不是 URL"的参考图列表，转换成一批公网 URL。 */
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

/** 把任意"可能不是 URL"的单个输入，转换成公网 URL。 */
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
 * 落地单个任务：提交 → 轮询 → 解析 results[].url。
 *
 * `onTaskSubmitted` 在 submit 成功、开始轮询前调用，让上层立即把 taskId 存到
 * placeholder 上。这是 pending 续轮询的关键：即便本次轮询超时 / 页面刷新，
 * 下次启动都能凭这个已持久化的 taskId 接着查。
 */
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
    // 回调里抛异常不应该影响我们的主流程。
  }

  return pollTaskUntilDone(config, taskId, maxWaitMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// 通用轮询 / 查询
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 单次 API 查询 —— 不等待不轮询，taskResume / generateImage 共用。
 * 返回 pending 表示"还在跑"；返回 success/failure 表示已终结。
 */
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
 * 按指数退避轮询到 maxWait。任何时候拿到终结态（成功/失败）都立即返回；
 * 时间窗耗尽仍是 pending 则原样返回 pending，让 caller 把 taskId 落到持久化通道。
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

// ─────────────────────────────────────────────────────────────────────────────
// 视频生成相关
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 将本地媒体文件上传到 RunningHub，返回 download_url。
 * 用于 sparkvideo-2.0 等视频渠道——这些端点不接受 data URL，
 * 必须直接用 RunningHub 的 media/upload 端点。
 */
async function uploadLocalFileToRunningHub(
  fileData: string,
  filename: string,
  apiKey: string,
  baseUrl: string,
): Promise<{ ok: true; downloadUrl: string } | ImageGenFailure> {
  let mimeType = 'application/octet-stream';
  let data = fileData;
  if (/^data:image\//i.test(fileData)) {
    const match = fileData.match(/^data:([^;]+);/);
    if (match) mimeType = match[1];
    data = fileData.replace(/^data:[^;]+;base64,/, '');
  } else if (/^data:video\//i.test(fileData)) {
    const match = fileData.match(/^data:([^;]+);/);
    if (match) mimeType = match[1];
    data = fileData.replace(/^data:[^;]+;base64,/, '');
  }
  if (/^https?:\/\//i.test(fileData)) {
    return { ok: true, downloadUrl: fileData };
  }
  let decoded: string;
  try {
    decoded = atob(data);
  } catch {
    return { ok: false, kind: 'empty', message: `无法解码 base64 文件：${filename}` };
  }
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);

  const boundary = `----rh-${Date.now().toString(16)}`;
  const parts: Uint8Array[] = [];
  const encoder = new TextEncoder();
  parts.push(
    encoder.encode(`--${boundary}\r\n`),
    encoder.encode(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`),
    encoder.encode(`Content-Type: ${mimeType}\r\n\r\n`),
    bytes,
    encoder.encode(`\r\n--${boundary}--\r\n`),
  );
  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) { combined.set(p, offset); offset += p.length; }

  let resp: Response;
  try {
    resp = await fetch(`${baseUrl}/openapi/v2/media/upload/binary`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: combined,
    });
  } catch (e: unknown) {
    return {
      ok: false,
      kind: 'network',
      message: 'RunningHub 文件上传请求失败',
      detail: buildRhNetworkErrorDetail(`${baseUrl}/openapi/v2/media/upload/binary`, e),
    };
  }
  if (!resp.ok) {
    const parsed = await parseErrorBody(resp);
    return { ok: false, kind: 'server', message: `RunningHub 文件上传失败：${parsed.message}`, detail: parsed.detail };
  }
  let json: unknown;
  try { json = await resp.json(); } catch {
    return { ok: false, kind: 'empty', message: 'RunningHub 上传响应解析失败' };
  }
  const j = json as { code?: number; msg?: string; errorMessage?: string; message?: string; data?: { download_url?: string } };
  if (j?.code !== 0) {
    const msg = j?.msg ?? j?.errorMessage ?? j?.message ?? '上传失败';
    return { ok: false, kind: 'server', message: `RunningHub 文件上传失败：${msg}` };
  }
  const downloadUrl = j?.data?.download_url?.trim();
  if (!downloadUrl) return { ok: false, kind: 'empty', message: 'RunningHub 上传未返回 download_url' };
  return { ok: true, downloadUrl };
}

/**
 * 把 req.size 映射到 API 接受的 resolution 字符串。
 * 优先直接返回 size 值（因为很多 UI 传入的是 "16:9" 这样的 ratio 字符串），
 * 否则按宽高比估算最近档位。
 */
function resolveVideoResolution(size: string): string {
  const supported = ['480p', '720p', 'native1080p', '1080p', '2k', '4k'];
  if (!size) return '720p';
  const lower = size.toLowerCase();
  if (supported.includes(lower)) return lower;
  const parts = size.split(/[x×]/);
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
  const ratioMatch = lower.match(/(\d+)[:x×](\d+)/);
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
 * SD2.0 图生视频：firstFrameUrl（+ 可选 lastFrameUrl）→ 视频。
 * Schema：POST /openapi/v2/rhart-video/sparkvideo-2.0/image-to-video
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
  const taskId = await submitTask(endpoint, payload, config.apiKey);
  return pollVideoUntilDone(config, taskId, maxWaitMs);
}

/**
 * SD2.0 文生视频：纯文本 prompt → 视频。
 * Schema：POST /openapi/v2/rhart-video/sparkvideo-2.0/text-to-video
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
  const taskId = await submitTask(endpoint, payload, config.apiKey);
  return pollVideoUntilDone(config, taskId, maxWaitMs);
}

/**
 * SD2.0 全能参考视频：prompt + imageUrls + videoUrls + audioUrls → 视频。
 * Schema：POST /openapi/v2/rhart-video/sparkvideo-2.0/multimodal-video
 *         POST /openapi/v2/rhart-video/sparkvideo-2.0-fast/multimodal-video
 * multimodal-video 是通用混合模式：同时支持图生视频（单图）和多模态参考（多图+视频+音频）。
 * seedImage（来自连线）作为首图放入 imageUrls。
 */
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
  const taskId = await submitTask(endpoint, payload, config.apiKey);
  return pollVideoUntilDone(config, taskId, maxWaitMs);
}

/** 提交任务到 RunningHub，返回 taskId（不轮询）。 */
async function submitTask(endpoint: string, body: Record<string, unknown>, apiKey: string): Promise<string> {
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
    throw new Error(`RunningHub 任务提交失败：${e instanceof Error ? e.message : String(e)}`, { cause: e });
  }
  if (!resp.ok) {
    const parsed = await parseErrorBody(resp);
    throw new Error(`RunningHub 任务提交失败（${resp.status}）：${parsed.message}`);
  }
  let json: unknown;
  try { json = await resp.json(); } catch (e) {
    throw new Error('RunningHub 任务提交响应解析失败', { cause: e });
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
    throw new Error(`RunningHub 任务提交失败：${j.errorMessage ?? j.errorCode}`);
  }
  const taskId = j?.taskId ?? j?.task_id;
  if (!taskId) throw new Error(`RunningHub 未返回 taskId：${safeStringify(json)}`);
  return String(taskId);
}

/** 轮询视频任务直到完成（或超时）。超时返回 pending 以便后续 resume。 */
async function pollVideoUntilDone(
  config: ProviderRuntimeConfig,
  taskId: string,
  maxWaitMs: number,
): Promise<VideoGenResult> {
  await sleep(POLL_FIRST_DELAY_MS);
  const deadline = Date.now() + maxWaitMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    const res = await queryOnce(config, taskId);
    if (res.ok === true) {
      const urls = extractUrls(res);
      if (urls.length === 0) {
        return { ok: false, kind: 'empty', message: '任务成功但未返回视频 URL', detail: safeStringify(res) };
      }
      return { ok: true, urls };
    }
    if (res.ok === false && res.kind !== 'network') return res;
    const step = [3000, 5000, 8000, 12000, 15000][Math.min(attempt, 4)];
    attempt++;
    await sleep(step);
  }
  return { ok: 'pending', providerId: 'runninghub', taskId } as unknown as VideoGenResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// 通用工具函数
// ─────────────────────────────────────────────────────────────────────────────

function extractUrls(results: unknown): string[] {
  if (!Array.isArray(results)) return [];
  const urls: string[] = [];
  for (const r of results) {
    const item = r as { url?: string };
    if (item && typeof item.url === 'string' && item.url.length > 0) urls.push(item.url);
  }
  return urls;
}

/** 把任意输入 aspect snap 到 RunningHub 支持的最近档位。 */
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

function buildRhNetworkErrorDetail(url: string, e: unknown): string {
  const rawMsg = e instanceof Error ? e.message : String(e ?? 'unknown');
  const lines = [
    `URL: ${url}`,
    `错误: ${rawMsg}`,
    '',
    '常见原因（按可能性排序）：',
    '  1. 浏览器 CORS 拦截——服务端未对本页面 origin 放行，Network 面板会看到',
    '     一条红色 preflight 或被 blocked 的请求。需服务端加 Access-Control-* 头。',
    '  2. VPN / 代理 / 企业网关把请求吞掉；换网络或关代理复测。',
    '  3. Base URL 配置错（拼错、多/少斜杠、协议缺失）；去设置面板确认。',
    '  4. 服务临时不可用；直接在浏览器访问 URL 看是否 200。',
    '  5. 浏览器扩展（广告拦截 / 隐私插件）阻断；在隐私窗口复测。',
  ];
  return lines.join('\n');
}