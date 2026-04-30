import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Loader2,
  BookMarked,
  Target,
  Tag,
  ChevronDown,
  Camera,
  Sparkles,
  Languages,
  SlidersHorizontal,
  Layers,
  Upload,
  MoreHorizontal,
  X,
  Link2,
  Brush,
} from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';
import { usePromptLibraryStore } from '../store/usePromptLibraryStore';
import { useAssetLibraryStore } from '../store/useAssetLibraryStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { CanvasElement, AppliedPreset, NodeVersion } from '../types/canvas';
import { PromptPreset } from '../data/promptLibrary';
import { PromptLibraryPanel } from './PromptLibraryPanel';
import { runGeneration, GenRequest } from '../services/imageGeneration';
// [telemetry] file-node discovery（观察窗结束后删这一行 + 下方 2 处 bumpTelemetry）
import { bumpTelemetry } from '../services/fileNodeTelemetry';
import { createRectMaskPng, loadImageNaturalSize } from '../utils/mask';
import { runVideoGeneration, VideoGenRequest } from '../services/videoGeneration';
import { listModels, getProvider, findModel, computeUnitPrice } from '../services/gateway';
import { computeBatchGrid } from '../utils/gridLayout';
import {
  getUpstreamTextContributions,
  getUpstreamImageContributions,
  composeEffectivePrompt,
  UpstreamTextContribution,
  UpstreamImageContribution,
} from '../utils/flowResolver';
import { v4 as uuidv4 } from 'uuid';

interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
  caption?: string;
}

type GenMode = 'image' | 'video' | 'text';

/**
 * 模型下拉数据来源于网关 registry。组件内部 `useMemo` 调用此函数、并订阅
 * `useSettingsStore.providers` 实现响应式：用户在设置弹窗里填 / 清 key，
 * 下拉 caption 立即同步"未配置密钥"标注，无需重启或重挂载。
 *
 * - caption 会拼上 Provider 名与原始 caption（便于消歧）。
 * - 对于 `auth !== 'none'` 但未配置 apiKey 的 provider，额外追加 "未配置密钥"
 *   作为可见提示——依然允许用户选中，真正发起请求时由 provider 返回结构化
 *   missingKey 错误，避免在这里重复一层拦截。
 * - 列表为空时返回单个占位项，明确提示用户"暂无已接入模型"。
 */
function buildModelOptions(
  capability: GenMode,
  providerConfigs: Record<string, { apiKey: string; baseUrl: string }>,
): DropdownOption[] {
  const items = listModels(capability).map(m => {
    const p = getProvider(m.providerId);
    const providerTag = p?.name ?? m.providerId;
    const needsKey = (p?.auth ?? 'none') !== 'none';
    const hasKey = !needsKey || !!providerConfigs[m.providerId]?.apiKey?.trim();
    const baseCaption = m.caption ? `${providerTag} · ${m.caption}` : providerTag;
    const caption = hasKey ? baseCaption : `${baseCaption} · 未配置密钥`;
    return { value: m.id, label: m.label, caption };
  });
  if (items.length === 0) {
    const hint =
      capability === 'text'
        ? '暂无文本模型，请先接入 Provider'
        : capability === 'video'
          ? '暂无视频模型，请先接入 Provider'
          : '暂无图像模型，请先接入 Provider';
    return [{ value: '', label: hint, caption: '设置 → API 设置' }];
  }
  return items;
}

const ASPECT_OPTIONS: DropdownOption[] = [
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
];

const QUALITY_OPTIONS_IMAGE: DropdownOption[] = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
  { value: 'auto', label: 'Auto' },
];

/**
 * aspect × quality → 合规像素尺寸（字符串 "WxH" 或 "auto"）。
 *
 * 所有条目同时满足 gpt-image-2 的四条约束：
 *   · 最大边 ≤ 3840
 *   · 两边均为 16 的倍数
 *   · 长短比 ≤ 3:1
 *   · 总像素 [655360, 8294400]
 *
 * 选值原则：
 *   · 1:1 @ 4K：官方没给，但 3840×3840 = 14.7M 超了 8.3M 上限，
 *     所以向下取 2880×2880（= 8.29M），略低于 4K 但在约束内。
 *   · 16:9 和 9:16 在 4K 档位用官方推荐的 3840×2160 / 2160×3840。
 *   · 4:3 / 3:4 的 4K 档同样按比例取 16 整除 + 不超 8.3M。
 *   · auto 档完全透传给后端，由服务端自行判断。
 */
const IMAGE_SIZE_PRESETS: Record<string, Record<string, string>> = {
  '1:1':  { '1K': '1024x1024', '2K': '2048x2048', '4K': '2880x2880', 'auto': 'auto' },
  '16:9': { '1K': '1280x720',  '2K': '2048x1152', '4K': '3840x2160', 'auto': 'auto' },
  '9:16': { '1K': '720x1280',  '2K': '1152x2048', '4K': '2160x3840', 'auto': 'auto' },
  '4:3':  { '1K': '1024x768',  '2K': '2048x1536', '4K': '2880x2160', 'auto': 'auto' },
  '3:4':  { '1K': '768x1024',  '2K': '1536x2048', '4K': '2160x2880', 'auto': 'auto' },
};

function resolveImageSize(aspect: string, quality: string): { size: string; w: number; h: number } {
  const fromTable = IMAGE_SIZE_PRESETS[aspect]?.[quality] ?? '1024x1024';
  if (fromTable === 'auto') {
    // auto 档透给后端；canvas 占位符尺寸用一个稳妥的默认，不影响返图后的替换。
    return { size: 'auto', w: 1024, h: 1024 };
  }
  const [w, h] = fromTable.split('x').map(Number);
  return { size: fromTable, w, h };
}

/**
 * placeholder / image 节点在**画布坐标**里的显示尺寸。和 API 输出的像素分辨率
 * 是两个维度：一张 3840×2160 的图完全可以渲染到 480×270 的 canvas rect 里，
 * 浏览器下采样，不掉细节。
 *
 * 之所以需要单独一个函数：直接用 resolveImageSize 的返回值当节点尺寸会让
 * 2K / 4K 档位在画布上巨大如山（默认 image 节点才 480×360）。这里按比例
 * 取长边 {@link PLACEHOLDER_LONG_SIDE}，保证 placeholder 和普通节点视觉
 * 体量一致。
 */
const PLACEHOLDER_LONG_SIDE = 480;
function computePlaceholderDisplaySize(aspect: string): { w: number; h: number } {
  const m = aspect.match(/^(\d+):(\d+)$/);
  if (!m) return { w: PLACEHOLDER_LONG_SIDE, h: PLACEHOLDER_LONG_SIDE };
  const aw = Number(m[1]);
  const ah = Number(m[2]);
  if (!(aw > 0) || !(ah > 0)) return { w: PLACEHOLDER_LONG_SIDE, h: PLACEHOLDER_LONG_SIDE };
  if (aw >= ah) {
    return { w: PLACEHOLDER_LONG_SIDE, h: Math.round(PLACEHOLDER_LONG_SIDE * (ah / aw)) };
  }
  return { w: Math.round(PLACEHOLDER_LONG_SIDE * (aw / ah)), h: PLACEHOLDER_LONG_SIDE };
}

const QUALITY_OPTIONS_VIDEO: DropdownOption[] = [
  { value: '480P', label: '480P' },
  { value: '720P', label: '720P' },
  { value: '1080P', label: '1080P' },
];

const DURATION_OPTIONS: DropdownOption[] = [
  { value: '3s', label: '3s' },
  { value: '5s', label: '5s' },
  { value: '10s', label: '10s' },
];

const COUNT_OPTIONS: DropdownOption[] = [
  { value: '1', label: '1 张' },
  { value: '2', label: '2 张' },
  { value: '4', label: '4 张' },
];

/**
 * Remove a preset snippet from a prompt string, preserving reasonable punctuation.
 * The snippet was originally inserted with either a leading `，` (prompt non-empty)
 * or as the full prompt (prompt was empty). Removal tries leading-comma form first,
 * then bare form, then trims any orphan leading `，`.
 */
function removeSnippetFromPrompt(prompt: string, snippet: string): string {
  const withComma = `，${snippet}`;
  if (prompt.includes(withComma)) {
    return prompt.replace(withComma, '');
  }
  if (prompt.includes(snippet)) {
    const out = prompt.replace(snippet, '');
    return out.replace(/^[，,\s]+/, '');
  }
  return prompt;
}

/**
 * Collect the versions history for an image/video anchor before replacing it
 * in place. If the element already tracks versions, use them verbatim;
 * otherwise seed with a synthetic "v1" entry so the current src isn't lost.
 * Returns `undefined` for anchors that have no src to preserve (e.g. fresh
 * empty image nodes) — caller skips passing `inheritedVersions` in that case.
 */
function computeInheritedVersions(el: CanvasElement): NodeVersion[] | undefined {
  if (el.type !== 'image' && el.type !== 'video') return undefined;
  const currentSrc = ((el as any).src ?? '') as string;
  const existing = ((el as any).versions as NodeVersion[] | undefined) ?? [];
  if (existing.length > 0) return existing;
  if (!currentSrc) return undefined;
  return [{
    id: uuidv4(),
    src: currentSrc,
    prompt: ((el as any).prompt ?? '').trim() || undefined,
    createdAt: Date.now(),
  }];
}

export interface NodeInputBarProps {
  element: CanvasElement;
  /** Top-left anchor in screen coords (already includes stage translate + scale). */
  x: number;
  y: number;
  /** Bar width in CANVAS units (pre-scale); rendered width = width * scale. */
  width: number;
  /** Canvas scale; applied via CSS transform so font/padding/radii scale together. */
  scale: number;
}

export function NodeInputBar({ element, x, y, width, scale }: NodeInputBarProps) {
  const { updateElement, deleteElements, addElement, replaceElement } = useCanvasStore();
  const deleteConnections = useCanvasStore(s => s.deleteConnections);
  const elementsAll = useCanvasStore(s => s.elements);
  const connectionsAll = useCanvasStore(s => s.connections);
  const inpaintMask = useCanvasStore(s => s.inpaintMask);
  const setInpaintMask = useCanvasStore(s => s.setInpaintMask);
  const { pushRecent, findPreset } = usePromptLibraryStore();

  // Determine generation mode from element type
  const mode: GenMode = useMemo(() => {
    if (element.type === 'video') return 'video';
    if (element.type === 'text') return 'text';
    return 'image';
  }, [element.type]);

  // Reactive model list — 订阅 providers config，配置变化自动重算 caption。
  const providerConfigs = useSettingsStore(s => s.providers);
  const modelOptions = useMemo(
    () => buildModelOptions(mode, providerConfigs),
    [mode, providerConfigs],
  );

  const prompt = element.prompt ?? '';
  const gen = element.generation ?? {};
  const model = gen.model ?? modelOptions[0]?.value ?? '';
  const aspect = gen.aspect ?? '1:1';
  const quality = gen.quality ?? (mode === 'video' ? '720P' : '1K');
  // qualityLevel 只有少数模型用（如 RH 官方稳定版），默认 medium 对齐文档示例。
  const qualityLevel = gen.qualityLevel ?? 'medium';
  const count = gen.count ?? '1';
  const duration = gen.duration ?? '5s';
  const appliedPresets: AppliedPreset[] = gen.appliedPresets ?? [];
  const appliedIds = useMemo(() => appliedPresets.map(p => p.id), [appliedPresets]);
  const references: string[] = gen.references ?? [];
  const MAX_REFERENCES = 4;

  // Upstream text contributions from connected nodes. Re-computed whenever
  // connections / elements change, so deleting a link or editing an upstream
  // text node updates the preview chips and effective prompt automatically.
  const upstream: UpstreamTextContribution[] = useMemo(
    () => getUpstreamTextContributions(element.id, elementsAll, connectionsAll),
    [element.id, elementsAll, connectionsAll],
  );
  const effectivePrompt = useMemo(
    () => composeEffectivePrompt(prompt, upstream),
    [prompt, upstream],
  );
  // Incoming image connections — used as seed frame for video mode. Image
  // mode ignores these for now (image nodes don't expose an image input port
  // yet; image→image via connections is a future extension).
  const upstreamImages: UpstreamImageContribution[] = useMemo(
    () => getUpstreamImageContributions(element.id, elementsAll, connectionsAll),
    [element.id, elementsAll, connectionsAll],
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // F15 inpaint: toggleable sub-mode available only when anchor is a
  // non-empty image node. The rect itself lives in the store so the
  // InpaintOverlay (sibling DOM layer) can read/write it independently.
  const hasImageSrc =
    element.type === 'image' &&
    typeof (element as any).src === 'string' &&
    (element as any).src.length > 0;
  const isInpaintMode =
    mode === 'image' &&
    hasImageSrc &&
    inpaintMask !== null &&
    inpaintMask.elementId === element.id;
  const inpaintRect =
    isInpaintMode && inpaintMask ? inpaintMask.rect : null;

  // Clear the inpaint session if the anchor changes (user selects a
  // different node) so stray rects don't linger.
  useEffect(() => {
    if (!inpaintMask) return;
    if (inpaintMask.elementId !== element.id) return;
    if (mode !== 'image' || !hasImageSrc) {
      setInpaintMask(null);
    }
  }, [element.id, mode, hasImageSrc, inpaintMask, setInpaintMask]);

  const toggleInpaintMode = () => {
    if (!hasImageSrc || mode !== 'image') return;
    if (isInpaintMode) {
      setInpaintMask(null);
      return;
    }
    setInpaintMask({ elementId: element.id, rect: null });
  };

  const clearInpaintRect = () => {
    if (!isInpaintMode) return;
    setInpaintMask({ elementId: element.id, rect: null });
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, [prompt]);

  const updatePrompt = (v: string) => updateElement(element.id, { prompt: v } as any);
  const updateGen = (patch: Partial<typeof gen>) =>
    updateElement(element.id, { generation: { ...gen, ...patch } } as any);

  const applyPreset = (preset: PromptPreset) => {
    if (appliedIds.includes(preset.id)) return;
    const nextPrompt =
      prompt.trim().length === 0
        ? preset.snippet
        : `${prompt.trimEnd()}，${preset.snippet}`;
    updateElement(element.id, {
      prompt: nextPrompt,
      generation: {
        ...gen,
        appliedPresets: [...appliedPresets, { id: preset.id, snippet: preset.snippet }],
      },
    } as any);
    pushRecent(preset.id);
    textareaRef.current?.focus();
  };

  const removePreset = (id: string) => {
    const target = appliedPresets.find(p => p.id === id);
    if (!target) return;
    const nextPrompt = removeSnippetFromPrompt(prompt, target.snippet);
    updateElement(element.id, {
      prompt: nextPrompt,
      generation: {
        ...gen,
        appliedPresets: appliedPresets.filter(p => p.id !== id),
      },
    } as any);
  };

  const addReferences = (urls: string[]) => {
    if (urls.length === 0) return;
    const next = [...references, ...urls].slice(0, MAX_REFERENCES);
    updateGen({ references: next });
  };

  const removeReference = (index: number) => {
    const next = references.filter((_, i) => i !== index);
    updateGen({ references: next });
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOverRef, setIsDragOverRef] = useState(false);

  const handleRefFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const slots = Math.max(0, MAX_REFERENCES - references.length);
    const picks = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, slots);
    const urls: string[] = [];
    for (const f of picks) {
      const url = await new Promise<string | null>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => resolve(null);
        r.readAsDataURL(f);
      });
      if (url) urls.push(url);
    }
    addReferences(urls);
  };

  /**
   * Accept drag-drop onto the input bar as reference-image intake. Two paths:
   *  1) From the asset library panel (dataTransfer `application/x-canvas-asset`)
   *  2) From the OS (files) — same reader pipeline as the upload button
   */
  const handleRefDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverRef(false);
    if (mode !== 'image') return;

    const assetId = e.dataTransfer.getData('application/x-canvas-asset');
    if (assetId) {
      const asset = useAssetLibraryStore.getState().findAsset(assetId);
      if (asset && asset.kind === 'image') {
        addReferences([asset.src]);
      }
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleRefFiles(e.dataTransfer.files);
    }
  };

  const insertTag = (tag: string) => {
    const sep = prompt.endsWith(' ') || prompt.length === 0 ? '' : ' ';
    updatePrompt(`${prompt}${sep}${tag} `);
    textareaRef.current?.focus();
  };

  const placeholder = useMemo(() => {
    if (isInpaintMode) {
      return inpaintRect
        ? '描述要在选区内填充的内容（例如：把这块改成樱花丛）'
        : '先在图上框选要重绘的区域，再描述新内容';
    }
    if (mode === 'image') return '描述你想要生成的画面内容，按 / 呼出指令，@ 引用素材';
    if (mode === 'video') return '描述你想要生成的视频内容，@ 引用素材';
    return '写下你想讲的故事、场景或角色设定...';
  }, [mode, isInpaintMode, inpaintRect]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isGenerating) return;
    // Effective prompt combines upstream contributions with local input.
    // Empty effective prompt means there's truly nothing to send — bail.
    if (!effectivePrompt.trim()) return;

    if (mode === 'video') {
      // Video pipeline — structurally identical to the image path but spawns
      // exactly one placeholder and delegates to the video service. Providers
      // aren't online yet; the current gateway returns a structured failure
      // that surfaces through the existing error panel + retry flow.
      const [wR, hR] = aspect.split(':').map(Number);
      const qmap: Record<string, number> = { '480P': 480, '720P': 720, '1080P': 1080 };
      const short = qmap[quality] ?? 720;
      let vw = short;
      let vh = short;
      if (wR && hR) {
        if (wR >= hR) vw = Math.round(short * (wR / hR));
        else vh = Math.round(short * (hR / wR));
      }
      const secs = parseInt(duration.replace(/[^0-9]/g, ''), 10) || 5;

      // Anchor is the video node itself; reuse its footprint for the placeholder.
      // F2: seed the placeholder with the anchor's existing history so the
      // successful replacement keeps all prior versions reachable.
      // Bug fix: 用 replaceElement 原地替换锚点，保留"上游图 → anchor.seed"
      // 这根连线；否则 deleteElements 会顺手把连线一起删了。
      const pid = uuidv4();
      const inheritedVersions = computeInheritedVersions(element);
      replaceElement(element.id, {
        id: pid,
        type: 'aigenerating',
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        inheritedVersions,
        inheritedPrompt: prompt,
      } as any, '开始视频生成');

      const vreq: VideoGenRequest = {
        model,
        prompt: effectivePrompt,
        size: `${vw}x${vh}`,
        w: element.width,
        h: element.height,
        durationSec: secs,
        // F14: first connected upstream image becomes the seed frame. If the
        // user has linked multiple image nodes, we take the first; the UI
        // shows thumbnails for all of them so they can delete extras.
        seedImage: upstreamImages[0]?.src,
      };

      setIsGenerating(true);
      try {
        await runVideoGeneration(pid, vreq);
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    if (mode === 'text') {
      alert('文本生成即将上线。当前已将输入保存到该节点。');
      updateElement(element.id, { text: prompt } as any);
      return;
    }

    // F15: Local inpainting branch — takes priority over the standard image
    // path. Requires: a drawn mask rect, a non-empty source, and a provider
    // that accepts /images/edits + `mask`. We force gpt-image-2 (t8star) 因为
    // 目前只有它真实对接了 OpenAI DALL·E 风格的 edits 端点；其它 provider
    // （RunningHub 的异步端点）不吃 mask 字段。
    if (isInpaintMode && inpaintRect && element.type === 'image') {
      const srcUrl = ((element as any).src as string) || '';
      if (!srcUrl) return;

      // Load the source image's natural size so the mask PNG matches
      // dimensions exactly (edits 接口约束). Fall back to element size
      // if the natural-size probe fails (e.g., CORS-tainted remote image).
      const natural = await loadImageNaturalSize(srcUrl);
      const maskW = natural?.w ?? Math.max(64, Math.round(element.width));
      const maskH = natural?.h ?? Math.max(64, Math.round(element.height));
      const maskDataUrl = createRectMaskPng(maskW, maskH, inpaintRect);
      if (!maskDataUrl) return;

      const inpaintModel = 'gpt-image-2';

      const pid = uuidv4();
      // F2: preserve version history through the in-place replacement.
      const inheritedVersions = computeInheritedVersions(element);

      // Clear the inpaint session before deleting the source so the overlay
      // doesn't flicker onto the placeholder.
      // Bug fix: 同图像生成路径——replaceElement 保留锚点上的连线（比如
      // 有人连了一个 prompt 节点 → image.Prompt，inpaint 后还要接着用）。
      setInpaintMask(null);
      replaceElement(element.id, {
        id: pid,
        type: 'aigenerating',
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        inheritedVersions,
        inheritedPrompt: prompt,
      } as any, '开始局部重绘');

      const req: GenRequest = {
        model: inpaintModel,
        prompt: effectivePrompt,
        // 'auto' 让 gpt-image-2 沿用输入图的原始尺寸。
        size: 'auto',
        n: 1,
        w: element.width,
        h: element.height,
        references: [srcUrl],
        maskImage: maskDataUrl,
      };

      setIsGenerating(true);
      try {
        await runGeneration([pid], req);
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // 尺寸的两个维度：
    //   · resolved.size：发给后端的"合规"API 分辨率（1024/2048/3840…）
    //   · displaySize：节点在画布坐标里的显示尺寸（长边 480，和默认 image
    //     节点同量级）。用 API 分辨率直接当画布尺寸会让 2K/4K 档的
    //     placeholder 在画布上巨大如山——3840 canvas unit 约是普通节点的 8×。
    const resolved = resolveImageSize(aspect, quality);
    const displaySize = computePlaceholderDisplaySize(aspect);

    const n = Math.max(1, Number(count) || 1);

    // If the anchor is a fresh empty image node (no src yet), drop it and put the
    // first placeholder in its slot so the user doesn't end up with an orphan shell.
    const isEmptyImageAnchor =
      element.type === 'image' &&
      typeof (element as any).src === 'string' &&
      (element as any).src.length === 0;

    // 失败的 placeholder 也当成"锚点"：用户在 bar 里改完参数提交，就地把
    // 这个坏点换成新 placeholder，不再在边上另外开一块。不然画布会越挂
    // 越多空框，用户也不知道该删哪个。
    const isErroredAnchor =
      element.type === 'aigenerating' && !!(element as any).error;

    // F2: "regenerate in place" — when the anchor is a non-empty image and
    // the user wants a single output, we replace the anchor (rather than
    // spawning a sibling) and preserve its history via inheritedVersions.
    // Batches (n>1) keep spawning siblings since each becomes its own node.
    // 失败占位符同理，但它本身没有 image 历史，不需要 inheritedVersions。
    const isReplaceInPlace =
      (element.type === 'image' && !isEmptyImageAnchor && n === 1) ||
      (isErroredAnchor && n === 1);

    // Merge connection-sourced images with user-uploaded references. Upstream
    // images go first so they take priority when we hit the MAX cap. Dedup by
    // URL so the same image linked + uploaded doesn't count twice.
    const linkedUrls = upstreamImages.map(u => u.src);
    const mergedRefs: string[] = [];
    for (const url of [...linkedUrls, ...references]) {
      if (!url) continue;
      if (mergedRefs.includes(url)) continue;
      if (mergedRefs.length >= MAX_REFERENCES) break;
      mergedRefs.push(url);
    }

    // For empty anchor: pretend there is a virtual node one slot to the left,
    // so computeBatchGrid places slot 0 exactly at the original element's coords.
    // For in-place: use the anchor rect so the placeholder lands exactly on it.
    const anchorRect =
      isEmptyImageAnchor
        ? { x: element.x - displaySize.w - 40, y: element.y, w: displaySize.w, h: displaySize.h }
        : { x: element.x, y: element.y, w: element.width, h: element.height };

    const slots = isReplaceInPlace
      // In-place mode: placeholder sits exactly where the anchor was, at the
      // anchor's original size — no grid math needed.
      ? [{ x: element.x, y: element.y, w: element.width, h: element.height }]
      : computeBatchGrid(anchorRect, n);

    // Capture versions BEFORE deleting the anchor.
    // image 锚点：从它自己的 versions 里拿；
    // errored placeholder 锚点：从它之前 inherit 的 versions 透传（别丢历史）。
    const inheritedVersions = isReplaceInPlace
      ? (element.type === 'aigenerating'
          ? ((element as any).inheritedVersions as NodeVersion[] | undefined)
          : computeInheritedVersions(element))
      : undefined;

    // 快照给 placeholder：如果生成失败，bar 重新显示时能原样恢复用户的 prompt
    // 和所有档位。不塞的话用户只能从零重填，体验极差。
    const placeholderGeneration = {
      model,
      aspect,
      quality,
      qualityLevel,
      count,
      references: mergedRefs.length > 0 ? mergedRefs : undefined,
      appliedPresets,
    };

    // Bug fix: 替换锚点时不再走 "deleteElements + addElement" ——
    // deleteElements 会把所有指向 anchor 的连线（尤其 img2img 的 file→Ref）
    // 一起清除，点击生成连线就蒸发。改用 replaceElement 在原地交换节点，
    // 端口 id 继承自锚点、连线的 fromId/toId 统一改写到新 placeholder。
    //
    // 只有第一个 placeholder 落在原锚点位置、能真正"替换"；批量 n>1 的
    // 其它 slot 仍然走 addElement（它们落在新格子里，天然没有连线需要继承）。
    const placeholderIds: string[] = [];
    const shouldReplaceAnchor = (isEmptyImageAnchor || isReplaceInPlace);
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const id = uuidv4();
      placeholderIds.push(id);
      const placeholderEl = {
        id,
        type: 'aigenerating',
        x: slot.x,
        y: slot.y,
        width: slot.w,
        height: slot.h,
        prompt,
        generation: placeholderGeneration,
        // Only the first (and in practice, only) placeholder in in-place
        // mode inherits history.
        ...(isReplaceInPlace && i === 0
          ? { inheritedVersions, inheritedPrompt: prompt }
          : {}),
      } as any;

      if (shouldReplaceAnchor && i === 0) {
        replaceElement(element.id, placeholderEl, '开始图像生成');
      } else {
        addElement(placeholderEl);
      }
    }

    const req: GenRequest = {
      model,
      prompt: effectivePrompt,
      // auto 档位要把字面量透传给后端；其它档位用合规像素串。
      size: resolved.size,
      // 归一化比例值直接给那些只吃 aspectRatio 的 provider（e.g. RunningHub）。
      aspect,
      // UI 档位原样透传。走 size 的 provider（t8star）根本不读；走 resolution
      // 的 provider（RH 官方稳定版）靠这个字段发送必填 body。
      resolution: quality,
      qualityLevel: qualityLevelOpts ? qualityLevel : undefined,
      n,
      // w/h 记的是"画布显示尺寸"（和 placeholder 一致）——不是 API 像素分辨率。
      // 这两个字段只在 retry / pendingTask 快照里兜底，用来记录节点形状，
      // 不会被真正当 size 参数发给后端。
      w: displaySize.w,
      h: displaySize.h,
      references: mergedRefs.length > 0 ? mergedRefs : undefined,
    };

    // [telemetry] 观察窗：img2img 中上游源是 file 还是 image 节点。
    // 只在"这次生成带有连线参考"时记一笔；纯 text2img / 纯手动上传参考的
    // run 都不计，避免稀释分母。分类依据：第 1 条上游贡献（和 seedImage
    // 的挑选逻辑保持一致，单图 provider 实际就是它）。
    try {
      if (upstreamImages.length > 0) {
        const firstSourceId = upstreamImages[0].sourceId;
        const srcEl = elementsAll.find(e => e.id === firstSourceId);
        if (srcEl?.type === 'file') bumpTelemetry('img2imgFromFileNode');
        else if (srcEl?.type === 'image') bumpTelemetry('img2imgFromImageNode');
      }
    } catch {
      // 埋点不允许影响主流程
    }

    setIsGenerating(true);
    try {
      await runGeneration(placeholderIds, req);
    } finally {
      setIsGenerating(false);
    }
  };

  // 按当前选中的模型决定 aspect / resolution / qualityLevel 下拉的内容。
  //   · `supportedAspects` 缺省 → 用全集（向后兼容老 descriptor）
  //   · `supportedResolutions` 缺省 + `supportsSize === false` → 隐藏分辨率下拉；
  //     缺省 + `supportsSize === true` → 用全局 1K/2K/4K/Auto；显式给出 → 过滤成子集。
  //   · `supportedQualityLevels` 缺省 → 不渲染质量轴下拉；显式给出 → 显示这些档位。
  //   · 任意档位在模型切换后如果不在新模型的支持集里，自动 snap 到第一档，
  //     避免发出去一个 provider 直接拒绝的请求。
  const selectedModelDesc = useMemo(
    () => (mode !== 'text' ? findModel(model)?.model : undefined),
    [mode, model],
  );
  const aspectOpts = useMemo(() => {
    const supported = selectedModelDesc?.supportedAspects;
    if (!supported || supported.length === 0) return ASPECT_OPTIONS;
    // 保留 ASPECT_OPTIONS 里出现过的标签顺序，没列进来的（如 RH 低价的 21:9）
    // 直接拼到末尾，免得 UI 突然多/少几条让人困惑。
    const known = ASPECT_OPTIONS.filter(o => supported.includes(o.value));
    const extras = supported
      .filter(v => !ASPECT_OPTIONS.some(o => o.value === v))
      .map(v => ({ value: v, label: v }));
    return [...known, ...extras];
  }, [selectedModelDesc]);

  // 分辨率下拉：默认 image 档位列表，根据 model.supportedResolutions 过滤。
  const imageResolutionOpts = useMemo<DropdownOption[]>(() => {
    const supported = selectedModelDesc?.supportedResolutions;
    if (!supported || supported.length === 0) return QUALITY_OPTIONS_IMAGE;
    const known = QUALITY_OPTIONS_IMAGE.filter(o => supported.includes(o.value));
    const extras = supported
      .filter(v => !QUALITY_OPTIONS_IMAGE.some(o => o.value === v))
      .map(v => ({ value: v, label: v }));
    return [...known, ...extras];
  }, [selectedModelDesc]);

  // 质量轴下拉（可选控件）。只有显式声明 supportedQualityLevels 的模型才渲染。
  const qualityLevelOpts = useMemo<DropdownOption[] | null>(() => {
    const supported = selectedModelDesc?.supportedQualityLevels;
    if (!supported || supported.length === 0) return null;
    return supported.map(v => ({ value: v, label: v }));
  }, [selectedModelDesc]);

  // 模型一换：任意当前选中的档位如果不再被支持，静默 snap 到第一项。
  useEffect(() => {
    if (mode === 'text') return;
    if (aspectOpts.length > 0 && !aspectOpts.some(o => o.value === aspect)) {
      updateGen({ aspect: aspectOpts[0].value });
    }
  }, [aspectOpts, aspect, mode]);
  useEffect(() => {
    if (mode !== 'image') return;
    if (imageResolutionOpts.length > 0 && !imageResolutionOpts.some(o => o.value === quality)) {
      updateGen({ quality: imageResolutionOpts[0].value });
    }
  }, [imageResolutionOpts, quality, mode]);
  useEffect(() => {
    if (mode !== 'image') return;
    if (!qualityLevelOpts) return;
    if (!qualityLevelOpts.some(o => o.value === qualityLevel)) {
      updateGen({ qualityLevel: qualityLevelOpts[0].value });
    }
  }, [qualityLevelOpts, qualityLevel, mode]);

  // image 模式下是否展示分辨率下拉。video 不走 supportsSize 逻辑，自有清晰度档位。
  const showResolutionDropdown =
    mode === 'video' ||
    // 显式给出就一定展示，否则尊重 supportsSize 的布尔语义
    !!selectedModelDesc?.supportedResolutions?.length ||
    selectedModelDesc?.supportsSize !== false;
  const qualityOpts = mode === 'video' ? QUALITY_OPTIONS_VIDEO : imageResolutionOpts;

  // 当前参数组合下的单价 + 总价。provider 没配 pricing（如 t8star）→ undefined，
  // UI 降级为占位符 '—'；配了但档位查不到 → 同样 undefined（保守显示，不编价）。
  const unitPrice = useMemo(() => {
    if (!selectedModelDesc) return undefined;
    if (mode !== 'image') return undefined; // 视频定价逻辑留待后续；文本无费用
    return computeUnitPrice(selectedModelDesc, {
      resolution: quality,
      qualityLevel,
    });
  }, [selectedModelDesc, mode, quality, qualityLevel]);
  const nNum = Math.max(1, Number(count) || 1);
  const totalPrice = unitPrice ? unitPrice.amount * nNum : undefined;

  return (
    <div
      className="absolute z-10 pointer-events-auto"
      style={{
        left: x,
        top: y,
        width,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        filter: 'none',
      }}
      onMouseDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      <div
        className="overflow-visible transition-colors"
        style={{
          background: 'var(--bg-2)',
          border: 'none',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-ink-1)',
          overflow: 'hidden',
        }}
        onDragOver={(e) => {
          if (mode !== 'image') return;
          if (references.length >= MAX_REFERENCES) return;
          // Accept both asset-library drags and OS file drags.
          const types = Array.from(e.dataTransfer.types);
          if (types.includes('application/x-canvas-asset') || types.includes('Files')) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            if (!isDragOverRef) setIsDragOverRef(true);
          }
        }}
        onDragLeave={() => {
          if (isDragOverRef) setIsDragOverRef(false);
        }}
        onDrop={handleRefDrop}
      >
        <div style={{ maxHeight: expanded ? '600px' : '0', overflow: 'hidden', transition: 'max-height 300ms ease' }}>
        {/* Quick chip row — all modes get the prompt-library entry; image/video get extra chips */}
        <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
          <div className="relative">
            <QuickChip
              icon={<BookMarked className="w-3 h-3" />}
              label="提示词库"
              onClick={() => setLibraryOpen(v => !v)}
              active={libraryOpen}
            />
            {libraryOpen && (
              <PromptLibraryPanel
                mode={mode}
                appliedIds={appliedIds}
                currentPrompt={prompt}
                onApply={applyPreset}
                onDismiss={() => setLibraryOpen(false)}
              />
            )}
          </div>
          {mode !== 'text' && (
            <>
              <QuickChip
                icon={<Target className="w-3 h-3" />}
                label="聚焦"
                onClick={() => insertTag('[聚焦]')}
              />
              <QuickChip
                icon={<Tag className="w-3 h-3" />}
                label="标记"
                onClick={() => insertTag('@')}
              />
              {mode === 'video' && (
                <>
                  <QuickChip
                    icon={<Camera className="w-3 h-3" />}
                    label="运镜"
                    onClick={() => insertTag('[运镜]')}
                  />
                  <QuickChip
                    icon={<Sparkles className="w-3 h-3" />}
                    label="角色库"
                    onClick={() => insertTag('@角色:')}
                  />
                </>
              )}
              {mode === 'image' && (
                <QuickChip
                  icon={<Brush className="w-3 h-3" />}
                  label="局部重绘"
                  onClick={toggleInpaintMode}
                  active={isInpaintMode}
                  disabled={!hasImageSrc || isGenerating}
                  title={
                    !hasImageSrc
                      ? '需要先有生成图像才能局部重绘'
                      : isInpaintMode
                        ? '退出局部重绘（保留整图）'
                        : '开启局部重绘（框选区域 + 提示词）'
                  }
                />
              )}
              <div className="flex-1" />
              {mode === 'image' && (
                <>
                  <button
                    type="button"
                    disabled={references.length >= MAX_REFERENCES || isGenerating}
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-ghost shrink-0 whitespace-nowrap"
                    style={{ padding: '4px 9px', fontSize: 11.5 }}
                    title={
                      references.length >= MAX_REFERENCES
                        ? `最多 ${MAX_REFERENCES} 张参考图`
                        : '添加参考图（图生图）'
                    }
                  >
                    <Upload className="w-3 h-3" />
                    参考图{references.length > 0 ? ` · ${references.length}` : ''}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      handleRefFiles(e.target.files);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  />
                </>
              )}
            </>
          )}
        </div>

        {/* Linked upstream text contributions — read-only chips with X to unlink.
            Rendered for all modes so video/text nodes also show where prompt
            context is coming from. */}
        {upstream.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 px-3 pt-1 pb-1">
            <span className="chip-meta chip-meta--signal">
              <Link2 className="w-2.5 h-2.5" strokeWidth={1.6} />
              连线输入 {upstream.length}
            </span>
            {upstream.map((u) => (
              <span
                key={u.connectionId}
                className="inline-flex items-center gap-1"
                style={{
                  paddingLeft: 8, paddingRight: 2, paddingTop: 2, paddingBottom: 2,
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--bg-1)',
                  color: 'var(--signal)',
                  border: '1px solid color-mix(in oklch, var(--signal) 25%, transparent)',
                  fontSize: 10.5,
                }}
                title={u.content.length > 200 ? u.content.slice(0, 200) + '…' : u.content}
              >
                <span className="truncate" style={{ maxWidth: 140 }}>{u.label}</span>
                <button
                  type="button"
                  onClick={() => deleteConnections([u.connectionId])}
                  className="transition-colors"
                  style={{
                    padding: 2, borderRadius: '50%',
                    color: 'var(--signal)', background: 'transparent',
                    cursor: 'pointer', border: 'none',
                  }}
                  title="断开此连线"
                >
                  <X className="w-2.5 h-2.5" strokeWidth={1.8} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* F14 (image): Linked upstream images → merged into references
            array up to MAX_REFERENCES. Rendered above the manual reference
            thumbnails so the user sees connection-sourced refs first. */}
        {mode === 'image' && upstreamImages.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pt-1 pb-1">
            <span className="chip-meta chip-meta--accent">
              <Link2 className="w-2.5 h-2.5" strokeWidth={1.6} />
              连线参考 {upstreamImages.length}
            </span>
            {upstreamImages.map((u, idx) => {
              // Linked refs share the same MAX cap with manual uploads;
              // anything above MAX_REFERENCES or duplicated with a manual
              // upload is sent nowhere. Surface this with a dimmed style.
              const willBeSent =
                idx < MAX_REFERENCES && !references.includes(u.src);
              return (
                <ThumbChip
                  key={u.connectionId}
                  src={u.src}
                  alt={u.label}
                  tone={willBeSent ? 'accent' : 'muted'}
                  badge={!willBeSent ? '忽略' : undefined}
                  title={
                    willBeSent
                      ? `参考图（来自连线）· ${u.label}`
                      : `${u.label}（超出上限或与已上传重复，不会发送）`
                  }
                  onRemove={() => deleteConnections([u.connectionId])}
                />
              );
            })}
          </div>
        )}

        {/* F14: Linked upstream image → video seed frame(s). Shown only for
            video mode. First thumbnail is the active seed; others display
            with a subtle "备用" badge so users know only one feeds through. */}
        {mode === 'video' && upstreamImages.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pt-1 pb-1">
            <span className="chip-meta chip-meta--accent">
              <Link2 className="w-2.5 h-2.5" strokeWidth={1.6} />
              seed 帧 {upstreamImages.length}
            </span>
            {upstreamImages.map((u, idx) => (
              <ThumbChip
                key={u.connectionId}
                src={u.src}
                alt={u.label}
                tone={idx === 0 ? 'accent' : 'muted'}
                badge={idx > 0 ? '备用' : undefined}
                title={
                  idx === 0
                    ? `seed 帧 · ${u.label}`
                    : `${u.label}（多张时仅首张参与生成，可 X 断开）`
                }
                onRemove={() => deleteConnections([u.connectionId])}
              />
            ))}
          </div>
        )}

        {/* Reference image thumbnails (image-to-image) */}
        {mode === 'image' && references.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pt-1 pb-1">
            {references.map((url, idx) => (
              <ThumbChip
                key={`${idx}-${url.slice(0, 16)}`}
                src={url}
                alt={`ref-${idx}`}
                tone="accent"
                title={`参考图 ${idx + 1}`}
                onRemove={() => removeReference(idx)}
              />
            ))}
            <span className="mono" style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 4 }}>
              图生图 · {references.length}/{MAX_REFERENCES}
            </span>
          </div>
        )}

        {/* F15: inpaint status strip — shown only in inpaint sub-mode.
            Tells the user whether they still need to draw a rect, shows
            the coverage fraction once drawn, and offers a quick clear. */}
        {isInpaintMode && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pt-1 pb-1">
            <span className="chip-meta chip-meta--accent">
              <Brush className="w-2.5 h-2.5" strokeWidth={1.6} />
              局部重绘 · gpt-image-2
            </span>
            {inpaintRect ? (
              <span
                className="inline-flex items-center gap-1"
                style={{
                  paddingLeft: 8, paddingRight: 2, paddingTop: 2, paddingBottom: 2,
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--bg-1)',
                  color: 'var(--accent)',
                  border: '1px solid color-mix(in oklch, var(--accent) 25%, transparent)',
                  fontSize: 10.5,
                }}
              >
                选区 {Math.round(inpaintRect.w * inpaintRect.h * 100)}%
                <button
                  type="button"
                  onClick={clearInpaintRect}
                  style={{
                    padding: 2, borderRadius: '50%', border: 'none',
                    background: 'transparent', color: 'var(--accent)', cursor: 'pointer',
                  }}
                  title="清除选区，重新框选"
                >
                  <X className="w-2.5 h-2.5" strokeWidth={1.8} />
                </button>
              </span>
            ) : (
              <span className="serif-it" style={{ fontSize: 10.5, color: 'var(--accent)' }}>
                在图上拖拽框选要重绘的区域
              </span>
            )}
          </div>
        )}

        {/* Applied presets chips — render above textarea, clickable x to undo */}
        {appliedPresets.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 px-3 pt-1 pb-1">
            {appliedPresets.map(ap => {
              const preset = findPreset(ap.id);
              const label = preset?.title ?? ap.snippet.slice(0, 8);
              return (
                <span
                  key={ap.id}
                  className="inline-flex items-center gap-1"
                  style={{
                    paddingLeft: 8, paddingRight: 2, paddingTop: 2, paddingBottom: 2,
                    borderRadius: 'var(--r-pill)',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    border: '1px solid color-mix(in oklch, var(--accent) 20%, transparent)',
                    fontSize: 10.5,
                  }}
                  title={ap.snippet}
                >
                  <span className="truncate" style={{ maxWidth: 120 }}>{label}</span>
                  <button
                    type="button"
                    onClick={() => removePreset(ap.id)}
                    style={{
                      padding: 2, borderRadius: '50%', border: 'none',
                      background: 'transparent', color: 'var(--accent)', cursor: 'pointer',
                    }}
                    title="移除该预设"
                  >
                    <X className="w-2.5 h-2.5" strokeWidth={1.8} />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        </div> {/* collapse wrapper */}
        {/* Textarea */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-3 pt-2 pb-2">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={e => updatePrompt(e.target.value)}
              onFocus={() => setExpanded(true)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
                e.stopPropagation();
              }}
              placeholder={placeholder}
              disabled={isGenerating}
              rows={1}
              autoFocus
              className="w-full resize-none bg-transparent focus:outline-none"
              style={{
                minHeight: 52,
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--ink-0)',
              }}
            />
          </div>

          {/* Bottom toolbar */}
          <div
            className="flex items-center gap-1 min-w-0 hairline-t"
            style={{
              padding: '5px 8px',
              background: 'var(--bg-2)',
              borderBottomLeftRadius: '0',
              borderBottomRightRadius: '0',
            }}
          >
            <div className="flex items-center gap-0.5 flex-1 min-w-0">
              <Dropdown
                options={modelOptions}
                value={model}
                onChange={v => updateGen({ model: v })}
                disabled={isGenerating || isInpaintMode}
                icon={<Layers className="w-3 h-3 shrink-0" style={{ color: 'var(--accent)' }} />}
                maxLabelWidth={120}
              />
              {/* In inpaint mode we force model=gpt-image-2 + size=auto + n=1,
                  so hide the aspect/quality dropdowns to keep the bar honest
                  about what parameters actually matter. */}
              {mode === 'image' && !isInpaintMode && (
                <>
                  <ToolbarDivider />
                  <Dropdown options={aspectOpts} value={aspect} onChange={v => updateGen({ aspect: v })} disabled={isGenerating} />
                  {showResolutionDropdown && (
                    <Dropdown options={qualityOpts} value={quality} onChange={v => updateGen({ quality: v })} disabled={isGenerating} />
                  )}
                  {qualityLevelOpts && (
                    <Dropdown options={qualityLevelOpts} value={qualityLevel} onChange={v => updateGen({ qualityLevel: v })} disabled={isGenerating} />
                  )}
                </>
              )}
              {mode === 'video' && (
                <>
                  <ToolbarDivider />
                  <Dropdown options={aspectOpts} value={aspect} onChange={v => updateGen({ aspect: v })} disabled={isGenerating} />
                  <Dropdown options={qualityOpts} value={quality} onChange={v => updateGen({ quality: v })} disabled={isGenerating} />
                  <Dropdown options={DURATION_OPTIONS} value={duration} onChange={v => updateGen({ duration: v })} disabled={isGenerating} />
                </>
              )}
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <MoreMenu
                disabled={isGenerating}
                items={[
                  {
                    icon: <Languages className="w-3.5 h-3.5" />,
                    label: '多语言',
                    onClick: () => alert('多语言支持开发中'),
                  },
                  ...(mode !== 'text'
                    ? [
                        {
                          icon: <SlidersHorizontal className="w-3.5 h-3.5" />,
                          label: '高级参数',
                          onClick: () => alert('高级参数开发中'),
                        },
                      ]
                    : []),
                ]}
              />
              {mode !== 'text' && !isInpaintMode && (
                <Dropdown options={COUNT_OPTIONS} value={count} onChange={v => updateGen({ count: v })} disabled={isGenerating} />
              )}
              {/* Price tag: unit × count = total. Provider 没配 pricing 时占位符
                  '—'——比编一个假数字要诚实。hover tooltip 拆开给出"{单价}/张 × N"
                  方便用户核算。 */}
              <div
                className="flex items-center gap-1 mono"
                style={{
                  padding: '4px 8px',
                  fontSize: 11.5,
                  color: 'var(--warning)',
                  background: 'color-mix(in oklch, var(--warning) 14%, transparent)',
                  border: '1px solid color-mix(in oklch, var(--warning) 22%, transparent)',
                  borderRadius: 'var(--r-sm)',
                }}
                title={
                  unitPrice
                    ? `本次预估：${unitPrice.currency}${unitPrice.amount.toFixed(2)}/张 × ${nNum} = ${unitPrice.currency}${(unitPrice.amount * nNum).toFixed(2)}`
                    : '该模型未提供价格信息'
                }
              >
                <span style={{ fontWeight: 600 }}>
                  {totalPrice !== undefined && unitPrice
                    ? `${unitPrice.currency}${totalPrice.toFixed(2)}`
                    : '—'}
                </span>
              </div>
              <button
                type="submit"
                disabled={
                  isGenerating ||
                  !effectivePrompt.trim() ||
                  (isInpaintMode && !inpaintRect)
                }
                className="ml-1 flex items-center justify-center transition-colors"
                style={{
                  width: 30, height: 30,
                  borderRadius: 'var(--r-sm)',
                  background: (isGenerating || !effectivePrompt.trim() || (isInpaintMode && !inpaintRect))
                    ? 'var(--bg-3)'
                    : 'var(--accent)',
                  color: (isGenerating || !effectivePrompt.trim() || (isInpaintMode && !inpaintRect))
                    ? 'var(--ink-3)'
                    : 'var(--accent-fg)',
                  boxShadow: (isGenerating || !effectivePrompt.trim() || (isInpaintMode && !inpaintRect))
                    ? 'none'
                    : 'var(--shadow-ink-1)',
                  border: 'none',
                  cursor: (isGenerating || !effectivePrompt.trim() || (isInpaintMode && !inpaintRect))
                    ? 'not-allowed'
                    : 'pointer',
                }}
                title={(() => {
                  if (isInpaintMode) {
                    if (!inpaintRect) return '请先在图上框选要重绘的区域';
                    return `局部重绘 (Enter) · 选区 ${Math.round(inpaintRect.w * inpaintRect.h * 100)}%`;
                  }
                  const hints: string[] = [];
                  if (upstream.length > 0) hints.push(`已合并 ${upstream.length} 个上游连线`);
                  if (mode === 'video' && upstreamImages.length > 0) {
                    hints.push(
                      `seed 帧来自上游${upstreamImages.length > 1 ? `（共 ${upstreamImages.length}，取第 1 张）` : ''}`,
                    );
                  }
                  if (mode === 'image' && upstreamImages.length > 0) {
                    // Only count refs that actually make it through the dedup+cap.
                    const effective = upstreamImages
                      .filter(u => !references.includes(u.src))
                      .slice(0, MAX_REFERENCES).length;
                    if (effective > 0) {
                      hints.push(`连线参考图 ${effective} 张`);
                    }
                  }
                  return hints.length > 0 ? `生成 (Enter) · ${hints.join(' · ')}` : '生成 (Enter)';
                })()}
              >
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUp className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuickChip({
  icon,
  label,
  onClick,
  active,
  disabled,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  const bg = disabled ? 'var(--bg-2)' : active ? 'var(--accent-soft)' : 'var(--bg-1)';
  const fg = disabled ? 'var(--ink-3)' : active ? 'var(--accent)' : 'var(--ink-1)';
  const border = disabled
    ? 'var(--line-0)'
    : active
      ? 'color-mix(in oklch, var(--accent) 22%, transparent)'
      : 'var(--line-1)';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      // shrink-0 + whitespace-nowrap：当 bar 被节点宽度限制得很窄时（小节点），
      // 防止 flex 容器把 chip 压扁、让中文标签换行（"提示词库" → "提示\n词库"）。
      // 宁可 chip 行横向溢出/裁切，也不让单个 chip 内部看起来破碎。
      className="flex items-center gap-1 shrink-0 whitespace-nowrap transition-colors"
      style={{
        padding: '4px 9px',
        fontSize: 11.5,
        fontWeight: 500,
        borderRadius: 'var(--r-pill)',
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (disabled || active) return;
        e.currentTarget.style.background = 'var(--bg-2)';
        e.currentTarget.style.color = 'var(--ink-0)';
      }}
      onMouseLeave={(e) => {
        if (disabled || active) return;
        e.currentTarget.style.background = 'var(--bg-1)';
        e.currentTarget.style.color = 'var(--ink-1)';
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * ThumbChip — the tiny square thumb used for reference / seed images.
 * Accent tone = active (wired through); muted tone = deprioritised
 * (over-cap / non-seed). Hover reveals a remove pill in the top-right.
 */
function ThumbChip({
  src,
  alt,
  tone,
  badge,
  title,
  onRemove,
}: {
  src: string;
  alt: string;
  tone: 'accent' | 'muted';
  badge?: string;
  title?: string;
  onRemove: () => void;
}) {
  return (
    <div
      className="relative group/thumb"
      style={{
        width: 40, height: 40,
        borderRadius: 'var(--r-sm)',
        overflow: 'hidden',
        background: 'var(--bg-3)',
        border: tone === 'accent'
          ? '2px solid color-mix(in oklch, var(--accent) 32%, transparent)'
          : '1px solid var(--line-1)',
        opacity: tone === 'muted' ? 0.55 : 1,
        boxShadow: 'var(--shadow-ink-0)',
      }}
      title={title}
    >
      <img src={src} alt={alt} className="w-full h-full object-cover" />
      {badge && (
        <div
          className="absolute bottom-0 left-0 right-0 text-center"
          style={{
            fontSize: 8,
            background: 'rgba(20,15,10,0.55)',
            color: 'var(--accent-fg)',
            padding: '1px 0',
            letterSpacing: '0.1em',
          }}
        >
          {badge}
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="group-hover/thumb:opacity-100 transition-opacity"
        style={{
          position: 'absolute',
          top: -5, right: -5,
          width: 16, height: 16,
          borderRadius: '50%',
          background: 'var(--ink-0)',
          color: 'var(--bg-0)',
          border: '1px solid var(--bg-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          cursor: 'pointer',
          boxShadow: 'var(--shadow-ink-1)',
        }}
        title="移除"
      >
        <X className="w-2.5 h-2.5" strokeWidth={2} />
      </button>
    </div>
  );
}

/**
 * Cross-popup coordinator — any popup (Dropdown / MoreMenu) that opens
 * broadcasts a claim event; all others receive it and close themselves
 * unless they are the claimant. Keeps only one popup visible at a time
 * inside a NodeInputBar without threading context through every prop.
 */
const POPUP_CLAIM_EVENT = 'canvas:popup-claim';
function claimPopup(id: number) {
  window.dispatchEvent(new CustomEvent(POPUP_CLAIM_EVENT, { detail: id }));
}
function usePopupCoordinator(open: boolean, setOpen: (v: boolean) => void) {
  const idRef = useRef<number>(0);
  useEffect(() => {
    if (!open) return;
    idRef.current = Math.random();
    claimPopup(idRef.current);
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as number;
      if (detail !== idRef.current) setOpen(false);
    };
    window.addEventListener(POPUP_CLAIM_EVENT, handler);
    return () => window.removeEventListener(POPUP_CLAIM_EVENT, handler);
  }, [open, setOpen]);
}

function Dropdown({
  options,
  value,
  onChange,
  disabled,
  icon,
  maxLabelWidth,
}: {
  options: DropdownOption[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  /** If set, the current value label is truncated to this px width with a tooltip. */
  maxLabelWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find(o => o.value === value) ?? options[0];
  const label = current?.label ?? value;

  usePopupCoordinator(open, setOpen);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className={`relative ${maxLabelWidth ? 'min-w-0' : ''}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        title={maxLabelWidth ? label : undefined}
        className={`flex items-center gap-1 transition-colors ${
          maxLabelWidth ? 'min-w-0' : 'whitespace-nowrap'
        }`}
        style={{
          padding: '4px 6px',
          fontSize: 11,
          fontWeight: 500,
          borderRadius: 'var(--r-sm)',
          background: open ? 'var(--bg-3)' : 'transparent',
          color: open ? 'var(--ink-0)' : 'var(--ink-1)',
          border: '1px solid transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          if (disabled || open) return;
          e.currentTarget.style.background = 'var(--bg-3)';
          e.currentTarget.style.color = 'var(--ink-0)';
        }}
        onMouseLeave={(e) => {
          if (disabled || open) return;
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--ink-1)';
        }}
      >
        {icon}
        <span
          className={maxLabelWidth ? 'truncate' : 'whitespace-nowrap'}
          style={maxLabelWidth ? { maxWidth: maxLabelWidth } : undefined}
        >
          {label}
        </span>
        <ChevronDown className="w-3 h-3 opacity-60 shrink-0" strokeWidth={1.6} />
      </button>
      {open && (
        <div
          className="chip-paper anim-pop"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            width: 'max-content',
            maxWidth: 'min(420px, calc(100vw - 80px))',
            padding: 4,
            zIndex: 30,
            boxShadow: 'var(--shadow-ink-3)',
          }}
        >
          {options.map(opt => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className="w-full text-left transition-colors flex items-center"
                style={{
                  padding: '6px 10px',
                  gap: 14,
                  fontSize: 12,
                  borderRadius: 'var(--r-sm)',
                  background: selected ? 'var(--bg-3)' : 'transparent',
                  color: selected ? 'var(--ink-0)' : 'var(--ink-1)',
                  fontWeight: selected ? 600 : 400,
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (selected) return;
                  e.currentTarget.style.background = 'var(--bg-2)';
                }}
                onMouseLeave={(e) => {
                  if (selected) return;
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ whiteSpace: 'nowrap' }}>{opt.label}</span>
                {opt.caption && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 10,
                      color: 'var(--ink-3)',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {opt.caption}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface MoreMenuItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function MoreMenu({ items, disabled }: { items: MoreMenuItem[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  usePopupCoordinator(open, setOpen);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        title="更多"
        className="transition-colors"
        style={{
          padding: 5,
          borderRadius: 'var(--r-sm)',
          background: open ? 'var(--bg-3)' : 'transparent',
          color: open ? 'var(--ink-0)' : 'var(--ink-2)',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.6} />
      </button>
      {open && (
        <div
          className="chip-paper anim-pop"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            right: 0,
            width: 'max-content',
            maxWidth: 'min(320px, calc(100vw - 80px))',
            padding: 4,
            zIndex: 30,
            boxShadow: 'var(--shadow-ink-3)',
          }}
        >
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 transition-colors"
              style={{
                padding: '6px 10px',
                fontSize: 12,
                color: 'var(--ink-1)',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--r-sm)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center' }}>{item.icon}</span>
              <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolbarDivider() {
  return (
    <div
      className="shrink-0"
      style={{ width: 1, height: 15, background: 'var(--line-1)', margin: '0 3px', opacity: 0.6 }}
    />
  );
}
