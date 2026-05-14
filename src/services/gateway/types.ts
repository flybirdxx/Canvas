/**
 * Gateway types — the thin provider-abstraction layer that decouples the UI
 * from any specific AI vendor. Each concrete provider (t8star / runninghub / ...)
 * implements {@link GatewayProvider} and declares which {@link ModelDescriptor}s
 * it offers per capability. The rest of the app only talks to the registry.
 */

export type Capability = 'image' | 'video' | 'text';

/** How a provider authenticates. Currently all concrete providers use Bearer. */
export type AuthScheme = 'bearer' | 'x-api-key' | 'none';

/**
 * A concrete runnable model on a specific provider. `id` is the wire-level
 * name sent to the vendor API (e.g. "gpt-image-2", "rhart-image-g-2"); `label`
 * is the human-facing string we show in dropdowns.
 */
export interface ModelDescriptor {
  id: string;
  providerId: string;
  capability: Capability;
  label: string;
  caption?: string;
  /**
   * Whether the vendor supports the `size` parameter (WxH free-form). When
   * false, the UI hides the quality (1K/2K/4K) dropdown — for ratio-locked
   * vendors like RunningHub the only meaningful spatial parameter is aspect,
   * a quality picker would lie to the user (no matter what they pick the
   * server returns the same fixed size).
   */
  supportsSize?: boolean;
  /** Whether the vendor supports returning multiple images per call (`n > 1`). */
  supportsN?: boolean;
  /**
   * Aspect ratios this model actually accepts (wire-level). The UI uses this
   * to filter the aspect dropdown so users can't pick a value that the
   * provider would silently snap to something else. Format: '1:1' / '16:9' /
   * '3:2' style — same conventions as the global ASPECT_OPTIONS.
   *
   * Omitted = "use the UI's full default list" (back-compat for models that
   * accept everything in the picker).
   */
  supportedAspects?: string[];
  /**
   * Resolution tier values this model accepts (UI-level, e.g. '1K' / '2K' /
   * '4K' / 'auto'). When present, the UI's resolution dropdown shows ONLY
   * these options (provider-side mapping converts to whatever wire format
   * the vendor wants).
   *
   * Omitted + `supportsSize: false` → hide the resolution dropdown entirely
   * (vendor has nothing to choose; e.g. RH 低价渠道).
   * Omitted + `supportsSize: true`  → show the global 1K/2K/4K/Auto preset
   * (current default for t8star).
   */
  supportedResolutions?: string[];
  /**
   * Some vendors expose an extra "quality" axis orthogonal to resolution
   * (RH 官方稳定版的 low/medium/high 就是典型例子）。声明后 UI 多渲染一个
   * 下拉。值原样传到 provider，由 provider 决定是否映射。
   *
   * Omitted → 不渲染该控件（绝大多数模型走这条路径）。
   */
  supportedQualityLevels?: string[];
  /**
   * 每次调用的单价。UI 右下角那个小徽章会把"单价 × 张数 = 本次费用"
   * 实时算给用户看，避免跑一次才惊觉消费 ¥4.52 的尴尬。
   *
   * 缺省 → UI 徽章显示占位符（`—`），不会显示错误价格。
   */
  pricing?: ModelPricing;
}

/**
 * 单价数据：为什么不直接一个 number？因为 RH 官方稳定版的价格是
 * {quality × resolution} 的 3×3 矩阵（最低 ¥0.29，最高 ¥4.52，差 15 倍）；
 * 低价版则是所有档位一口价。两种形态必须都支持。
 *
 * 查价优先级：`flat` 存在就用 flat；否则按 (qualityLevel, resolution) 查
 * `matrix`。查不到（档位未声明）返回 undefined，UI 降级为占位符。
 *
 * 注意：矩阵 key 必须是**小写**（'low' / 'medium' / 'high' / '1k' / '2k' / '4k'），
 * 查询前会统一 toLowerCase。这样 UI 传 '1K' 也能命中。
 */
export interface ModelPricing {
  /** 币种显示前缀，如 '¥' / '$'。 */
  currency: string;
  /** 一口价（任何档位都是这个值）。声明后 `matrix` 会被忽略。 */
  flat?: number;
  /**
   * 计价矩阵。
   * - 二维矩阵（图像模型）：顶层 key = qualityLevel，子层 key = resolution。
   *   例: { low: { '1k': 0.1, '2k': 0.2 }, medium: { '1k': 0.2, '2k': 0.4 } }
   * - 一维矩阵（视频模型）：顶层 key = resolution，子层直接是数字。
   *   例: { '720p': 1.2, '1080p': 1.48, '2k': 1.62 }
   */
  matrix?: Record<string, Record<string, number> | number>;
}

export interface ImageGenRequest {
  /** Wire-level model id. The caller has already resolved this via the registry. */
  model: string;
  prompt: string;
  /** "WxH" formatted. Providers that don't support it may ignore. */
  size: string;
  /**
   * Normalized aspect ratio string such as '1:1' / '16:9' / '21:9'.
   * Providers that prefer ratio-based APIs (e.g. RunningHub) use this
   * directly; ratio-agnostic providers (t8star) ignore it and keep
   * reading `size`. Callers should set both so all providers work.
   */
  aspect?: string;
  /**
   * 原样透传的 UI "分辨率档位"（"1K" / "2K" / "4K" / "auto"）。ratio-based
   * provider（如 RH 官方稳定版）会直接拿这个值映射到自家的 resolution 字段；
   * 其它 provider 视而不见——它们走 `size` 的 WxH 路径。
   */
  resolution?: string;
  /**
   * 原样透传的 UI "生成质量档位"（如 'low' / 'medium' / 'high'）。只有声明
   * `supportedQualityLevels` 的模型才会实际使用；其它 provider 忽略。
   */
  qualityLevel?: string;
  /** Number of images to produce in this call. */
  n: number;
  /**
   * Optional reference images for image-to-image. When present, providers
   * that support it should route to their edits/i2i endpoint; providers that
   * don't should fail fast with `kind: 'unknown'` and a helpful message so
   * the UI can steer the user to a compatible model.
   */
  referenceImages?: string[];
  /**
   * Optional PNG data URL mask for localized inpainting. When present,
   * providers that support it should send it to their edits endpoint with
   * the alpha-zero region treated as "rewrite here". Callers set this only
   * alongside `referenceImages[0]` (the base image). Providers without
   * inpainting support must return `kind: 'unknown'` with a helpful
   * message — do NOT silently fall back to plain generate.
   */
  maskImage?: string;
  /**
   * F3 fix: AbortSignal for request cancellation.
   * When aborted, the underlying fetch call is cancelled and the
   * promise rejects as AbortError, allowing the execution engine to
   * reset the node to idle instead of failed.
   */
  signal?: AbortSignal;
  /**
   * 异步 provider（如 RunningHub）在提交成功、开始轮询前会调用此回调告知
   * 上层 taskId。上层利用该信号把 `taskId` 持久化到 placeholder 上，这样
   * 即便本次轮询超时、甚至页面刷新，下次启动也能凭这个 taskId 接着查任务。
   * 同步 provider（如 t8star）从不触发该回调；上层只需把它当作"可能被调用
   * 一次"处理即可。
   */
  onTaskSubmitted?(info: { providerId: string; taskId: string }): void;
}

export interface ImageGenSuccess {
  ok: true;
  /** One URL or data-URL per returned image. Length may be < n when the vendor truncates. */
  urls: string[];
}

export type GatewayErrorKind = 'missingKey' | 'network' | 'server' | 'empty' | 'unknown';

export interface ImageGenFailure {
  ok: false;
  kind: GatewayErrorKind;
  message: string;
  detail?: string;
  /** F3 fix: true when the request was aborted by an AbortSignal. */
  aborted?: boolean;
}

/**
 * 本次 generate 调用没拿到最终结果，但任务在 provider 端仍活着。caller
 * 应把 `{providerId, taskId}` 持久化到 placeholder.pendingTask 上，由
 * `taskResume` 异步 / 跨刷新继续轮询。不用当失败处理。
 */
export interface ImageGenPending {
  ok: 'pending';
  providerId: string;
  taskId: string;
}

export type ImageGenResult = ImageGenSuccess | ImageGenFailure | ImageGenPending;

/**
 * Video generation request. Mirrors the image request but adds duration and
 * aspect-ratio fields that only make sense for video. `size` is kept as the
 * same "WxH" string so providers that reuse image plumbing don't need a
 * separate parser.
 */
export interface VideoGenRequest {
  /** Wire-level model id (e.g. "seedance-2", "runway-gen3"). */
  model: string;
  prompt: string;
  /** "WxH" formatted. */
  size: string;
  /** Duration in seconds. */
  durationSec: number;
  /**
   * Optional seed image (URL or data URL) for image-to-video. Parallel to
   * ImageGenRequest.referenceImages, but video providers typically accept a
   * single seed frame.
   */
  seedImage?: string;
  /** Execution run id that submitted this task, persisted for resume status updates. */
  execId?: string;
  /**
   * 异步 provider 在提交成功、开始轮询前会调用此回调告知上层 taskId。
   * 上层利用该信号把 `{providerId, taskId}` 持久化到 placeholder.pendingTask 上，
   * 由 `taskResume` 异步 / 跨刷新继续轮询。
   */
  onTaskSubmitted?(info: { providerId: string; taskId: string }): void;
}

export interface VideoGenSuccess {
  ok: true;
  /** One or more playable URLs (mp4 / webm). Length usually 1. */
  urls: string[];
}

export interface VideoGenFailure {
  ok: false;
  kind: GatewayErrorKind;
  message: string;
  detail?: string;
}

/** 本次视频 generate 调用没拿到最终结果，但任务在 provider 端仍活着。caller 应把 taskId 持久化。 */
export interface VideoGenPending {
  ok: 'pending';
  providerId: string;
  taskId: string;
}

export type VideoGenResult = VideoGenSuccess | VideoGenFailure | VideoGenPending;

/**
 * Text generation request. Follows OpenAI Chat Completion message format.
 * The caller composes the conversation context from upstream connections
 * and the node's local prompt into the `messages` array.
 */
export interface TextGenRequest {
  /** Wire-level model id (e.g. "google/gemini-3.1-pro-preview"). */
  model: string;
  /** OpenAI-format messages array. */
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  /** Maximum tokens to generate (default provider-specific). */
  maxTokens?: number;
  /** Temperature for sampling (0-2, default ~0.7). */
  temperature?: number;
  /** AbortSignal for request cancellation. */
  signal?: AbortSignal;
}

export interface TextGenSuccess {
  ok: true;
  /** The generated text content. */
  text: string;
}

export interface TextGenFailure {
  ok: false;
  kind: GatewayErrorKind;
  message: string;
  detail?: string;
}

export type TextGenResult = TextGenSuccess | TextGenFailure;

/**
 * Config values pulled from the settings store when the provider is invoked.
 * Providers must NOT cache this — always read fresh per call.
 */
export interface ProviderRuntimeConfig {
  apiKey: string;
  baseUrl: string;
}

export interface GatewayProvider {
  id: string;
  name: string;
  /** Capabilities this provider can in principle do (drives settings badges). */
  capabilities: Capability[];
  /** All models this provider exposes. Static list for now; can be dynamic later. */
  models: ModelDescriptor[];
  /** Authentication scheme, surfaced to SettingsModal labels. */
  auth: AuthScheme;
  /** Short human hint shown in SettingsModal (e.g. "Bearer token in Authorization header"). */
  authHint?: string;

  /**
   * Runs an image generation with config supplied by the caller. Must NOT
   * throw — all failure paths resolve to `ImageGenFailure` so the caller can
   * attribute errors to placeholders uniformly.
   *
   * Optional: providers that only declare `capabilities: ['video']` may omit
   * this. Callers should check presence before dispatching.
   */
  generateImage?(req: ImageGenRequest, config: ProviderRuntimeConfig): Promise<ImageGenResult>;

  /**
   * Runs a video generation. Same error-return contract as generateImage.
   * Optional — providers without video support omit it; the registry's
   * `generateVideoByModelId` returns a structured `'unknown'` failure in
   * that case so the UI can render a clean error panel.
   */
  generateVideo?(req: VideoGenRequest, config: ProviderRuntimeConfig): Promise<VideoGenResult>;

  /**
   * 按已知 taskId 对异步图像任务做"一次性"查询：
   *   - 任务已完成  → 返回 ImageGenSuccess
   *   - 任务已失败  → 返回 ImageGenFailure
   *   - 还在跑     → 返回 ImageGenPending（原样透传 taskId，便于下次再试）
   *
   * 该方法被 `taskResume` 在应用启动时调用，用来"接回"那些上一轮次轮询
   * 超时 / 浏览器刷新遗留的未完成任务。同步 provider 不需要实现。
   */
  pollImageTask?(taskId: string, config: ProviderRuntimeConfig): Promise<ImageGenResult>;

  /**
   * Video counterpart of pollImageTask. Providers with async video tasks should
   * implement this so `taskResume` can recover pending video placeholders after
   * refresh or restart.
   */
  pollVideoTask?(taskId: string, config: ProviderRuntimeConfig): Promise<VideoGenResult>;

  /**
   * Runs a text generation (LLM chat completion). Same error-return contract
   * as generateImage — must NOT throw, all failures resolve to TextGenFailure.
   *
   * Optional — providers without text support omit it; the registry's
   * `generateTextByModelId` returns a structured `'unknown'` failure in
   * that case so the UI can render a clean error panel.
   */
  generateText?(req: TextGenRequest, config: ProviderRuntimeConfig): Promise<TextGenResult>;
}
