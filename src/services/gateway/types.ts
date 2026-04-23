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
  /** Whether the vendor supports the `size` parameter (WxH). */
  supportsSize?: boolean;
  /** Whether the vendor supports returning multiple images per call (`n > 1`). */
  supportsN?: boolean;
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

export type VideoGenResult = VideoGenSuccess | VideoGenFailure;

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
}
