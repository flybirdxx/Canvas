export type ElementType = 'rectangle' | 'circle' | 'text' | 'image' | 'sticky' | 'video' | 'audio' | 'aigenerating' | 'file';

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
  /**
   * 可选的"生成质量档位"（low/medium/high 之类）。与 `quality` 不同：
   * `quality` 在本项目里一直语义上是"分辨率档位"（1K/2K/4K），这里
   * `qualityLevel` 才是真正的质量轴。只在声明 supportedQualityLevels 的
   * 模型（如 RH 官方稳定版）上才会用到。
   */
  qualityLevel?: string;
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
    /** UI 分辨率档位（'1K' / '2K' / '4K' / 'auto'）。resume 需要原样重放。 */
    resolution?: string;
    /** UI 质量档位（RH 官方稳定版的 'low'/'medium'/'high'）。 */
    qualityLevel?: string;
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

/**
 * 通用文件附件节点：绕开 image/video/audio 的生成管线，单纯把任意格式的
 * 文件挂到画布上做资料引用。按 `mimeType` 在 CanvasElements 里分派智能
 * 预览（image/video/audio/PDF 原生展示，其它降级为附件卡片）。
 *
 * 持久化 v1 策略：`src` 只写 data URL，直接走 zustand persist。
 * 已知取舍：大文件（>5MB 级）会把 localStorage 撑爆，v2 再换 blob URL
 * 或 IndexedDB 大对象存储。`persistence` 字段先占一个 'data'，之后扩出
 * 'blob' / 'remote' 时可做 UI 降级（刷新后提示"附件已丢失，点此重传"）。
 *
 * 故意没有 inputs/outputs —— 附件节点不接入工作流连线。
 */
export interface FileElement extends BaseElement {
  type: 'file';
  /** 原始文件名（含扩展名），UI 展示用。 */
  name: string;
  /** 标准 MIME，空串代表浏览器没能识别（偶尔发生于自定义后缀）。 */
  mimeType: string;
  /** 字节数，UI 显示为人类可读（KB / MB）。 */
  sizeBytes: number;
  /** 文件内容源：v1 只存 data URL。 */
  src: string;
  /** v1 只有 'data'；v2 扩出 'blob' / 'remote' 做大文件降级。 */
  persistence: 'data';
  /**
   * 缩略图 data URL（可选）。上传时一次性生成，之后永远是静态图——
   *  - video：第一帧 JPEG（ffmpeg 不引入，直接用浏览器 `<video>` + canvas drawImage）
   *  - audio：波形 PNG（WebAudio decode + 手写 peaks 采样）
   *  - image：该字段不写，直接用 `src` 本身（图像文件 = 自己就是缩略图）
   *  - pdf/其它：不生成缩略图，回退到 AttachmentCardBody
   * 存在时，渲染路径走纯 Konva image，获得和图像一致的拖拽 / 缩放性能；
   * 不存在时回落到卡片式占位。
   */
  thumbnailDataUrl?: string;
  /** 多媒体时长（毫秒）。video / audio 有；其它文件缺省。 */
  durationMs?: number;
  /** PDF 页数。尽量解析 `/Count` 获得；拿不到就缺省，UI 不显示。 */
  pageCount?: number;
}

export interface Connection {
  id: string;
  fromId: string;
  fromPortId: string;
  toId: string;
  toPortId: string;
}

export type CanvasElement = ShapeElement | TextElement | ImageElement | StickyElement | MediaElement | AIGeneratingElement | FileElement;
