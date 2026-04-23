export type ElementType = 'rectangle' | 'circle' | 'text' | 'image' | 'sticky' | 'video' | 'audio' | 'aigenerating';

export type DataType = 'any' | 'text' | 'image' | 'video' | 'audio';

export interface Port {
  id: string;
  type: DataType;
  label?: string;
}

export interface AppliedPreset {
  /** Preset id from promptLibrary (built-in or custom). */
  id: string;
  /** Exact snippet text inserted into prompt, used for precise removal on undo. */
  snippet: string;
}

export interface GenerationConfig {
  model?: string;
  aspect?: string;
  quality?: string;
  count?: string;
  duration?: string;
  /** Prompt-library presets currently applied to this node's prompt. */
  appliedPresets?: AppliedPreset[];
  /**
   * Reference images for image-to-image generation. Each entry is a URL the
   * browser can fetch — typically a data URL (inlined on upload) or an https
   * URL (from the asset library / gateway responses). The order matters for
   * providers that weight the first image higher.
   */
  references?: string[];
}

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  isLocked?: boolean;
  inputs?: Port[];
  outputs?: Port[];
  /** Prompt used to (re)generate this node. Applies to image/video/text nodes. */
  prompt?: string;
  /** Generation parameters such as model/aspect/quality/count. */
  generation?: GenerationConfig;
  /**
   * F24: free-form annotation attached to the node. Not used by any gen
   * pipeline — purely for the user's own bookkeeping (reminders, review
   * comments, continuity notes for story boards, etc.). Trimmed-empty
   * strings are treated as "no note".
   */
  note?: string;
}

export interface ShapeElement extends BaseElement {
  type: 'rectangle' | 'circle';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
}

/**
 * One snapshot in a generative node's history. Linear history (no branching):
 * every new generation appends to the end of `versions` and bumps
 * `activeVersionIndex` to the last slot. Switching version is a pure view
 * change — it updates `src` and `activeVersionIndex` but doesn't mutate
 * `versions`. A node with <2 entries does not show the switcher UI.
 */
export interface NodeVersion {
  id: string;
  src: string;
  /** Prompt that produced this version (captured at the time of generation). */
  prompt?: string;
  createdAt: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  prompt?: string;
  /**
   * Full history including the current version. `src` always equals
   * `versions[activeVersionIndex].src` when this array is defined.
   * Legacy elements with undefined `versions` behave as "no history".
   */
  versions?: NodeVersion[];
  activeVersionIndex?: number;
}

export interface StickyElement extends BaseElement {
  type: 'sticky';
  text: string;
  fill: string;
}

export interface MediaElement extends BaseElement {
  type: 'video' | 'audio';
  src: string;
  /** Same semantics as ImageElement.versions — only populated for video. */
  versions?: NodeVersion[];
  activeVersionIndex?: number;
}

export type GenErrorKind = 'missingKey' | 'network' | 'server' | 'empty' | 'unknown';

export interface AIGenerationError {
  kind: GenErrorKind;
  message: string;
  detail?: string;
  /** Full re-executable request payload. apiKey is NOT persisted here. */
  request: {
    /** Which modality this placeholder belongs to — drives retry routing. */
    modality?: 'image' | 'video';
    model: string;
    prompt: string;
    size: string;
    n: number;
    w: number;
    h: number;
    references?: string[];
    /** F15 image-inpainting mask (PNG data URL). Replayed verbatim on retry. */
    maskImage?: string;
    /** Video-only: seconds. */
    durationSec?: number;
    /** Video-only: seed image URL for i2v. */
    seedImage?: string;
  };
}

/**
 * 后台挂单信息：provider 提交成功、但本次轮询窗口内还没拿到最终结果时
 * 写入 placeholder。用于：
 *   1) 刷新 / 重开浏览器时由 `taskResume` 扫描，按 `taskId` 调用
 *      `GatewayProvider.pollImageTask` 接着轮询
 *   2) 让 UI 展示"等待 xx s"之类的耐心提示，而不是误报失败
 *   3) resume 若最终失败，用 `request` 构造可 retry 的 error.request
 *
 * 只适用于真正具有异步任务模型的 provider（RunningHub）。同步 provider
 * （t8star）从不写该字段——它们要么一次返回成功，要么立即失败。
 *
 * 注意 `request` 字段的持久化成本：异步 provider 的参考图已经预先过过
 * imgbb 转成公网 URL（小字符串），且 RunningHub 不支持 inpaint 蒙版，
 * 所以这里不会出现 data URL 塞爆 localStorage 的情况。
 */
export interface PendingGenerationTask {
  /** Gateway provider id，例如 'runninghub'。 */
  providerId: string;
  /** Provider-assigned 任务 id，查询状态时透传。 */
  taskId: string;
  /** epoch ms；用于 UI 显示已等待时长、以及防御性超时上限。 */
  submittedAt: number;
  /**
   * 完整请求快照，供 resume 失败时组装 `error.request`；也便于未来做
   * "手动再试一次"这种按钮时原样重放。
   */
  request: {
    model: string;
    prompt: string;
    size: string;
    aspect?: string;
    n: number;
    w: number;
    h: number;
    references?: string[];
    maskImage?: string;
  };
}

export interface AIGeneratingElement extends BaseElement {
  type: 'aigenerating';
  /** When present, render the error panel (with retry) instead of the loading skeleton. */
  error?: AIGenerationError;
  /**
   * 异步任务已提交、仍在 provider 端排队/运行时写入。`error` 和 `pendingTask`
   * 是互斥状态：进入 error 时应清除 pendingTask；resume 成功或失败后也要清除。
   */
  pendingTask?: PendingGenerationTask;
  /**
   * Versions forwarded from the anchor element this placeholder replaced.
   * On successful generation the service appends the new result and hands
   * the full array to the newly materialized image/video node. Enables the
   * "regenerate in place, keep history" workflow.
   */
  inheritedVersions?: NodeVersion[];
  /** Prompt of the anchor element (pre-generation), for versioning labels. */
  inheritedPrompt?: string;
}

export interface Connection {
  id: string;
  fromId: string;
  fromPortId: string;
  toId: string;
  toPortId: string;
}

export type CanvasElement = ShapeElement | TextElement | ImageElement | StickyElement | MediaElement | AIGeneratingElement;
