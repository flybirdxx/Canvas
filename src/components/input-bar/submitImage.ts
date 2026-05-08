/**
 * submitImage — image generation & inpainting submission extracted from NodeInputBar.
 *
 * Two paths:
 *   1) Local inpainting (F15) — requires a drawn mask rect + non-empty source image.
 *      Forces gpt-image-2 (t8star), the only provider currently accepting the mask field.
 *   2) Standard image generation — supports single (replace-in-place) and batch (grid spawn).
 *      Merges connection-sourced images with user-uploaded references (dedup, cap 4).
 */
import { v4 as uuidv4 } from 'uuid';
import type { CanvasElement, NodeVersion, GenerationConfig } from '@/types/canvas';
import type { UpstreamImageContribution } from '@/utils/flowResolver';
import type { GenRequest } from '@/services/imageGeneration';
import { createRectMaskPng, loadImageNaturalSize } from '@/utils/mask';
import { computeBatchGrid } from '@/utils/gridLayout';
import {
  resolveImageSize,
  computePlaceholderDisplaySize,
  computeInheritedVersions,
} from './utils';

export interface SubmitImageConfig {
  element: CanvasElement;
  prompt: string;
  effectivePrompt: string;
  aspect: string;
  quality: string;
  qualityLevel: string;
  qualityLevelOpts: { value: string; label: string }[] | null;
  count: string;
  model: string;
  references: string[];
  upstreamImages: UpstreamImageContribution[];
  isInpaintMode: boolean;
  inpaintRect: { x: number; y: number; w: number; h: number } | null;
  setInpaintMask: (state: { elementId: string; rect: { x: number; y: number; w: number; h: number } | null } | null) => void;
  replaceElement: (oldId: string, newElement: CanvasElement, label?: string) => void;
  addElement: (element: CanvasElement) => void;
  setIsGenerating: (v: boolean) => void;
  runGeneration: (ids: string[], req: GenRequest) => Promise<void>;
}

export async function submitImage(config: SubmitImageConfig): Promise<void> {
  const {
    element, prompt, effectivePrompt, aspect, quality, qualityLevel,
    qualityLevelOpts, count, model, references, upstreamImages,
    isInpaintMode, inpaintRect, setInpaintMask,
    replaceElement, addElement, setIsGenerating, runGeneration,
  } = config;

  // ── Inpaint path ───────────────────────────────────────────────────
  if (isInpaintMode && inpaintRect && element.type === 'image') {
    const srcUrl = (element.src ?? '') as string;
    if (!srcUrl) return;

    const natural = await loadImageNaturalSize(srcUrl);
    const maskW = natural?.w ?? Math.max(64, Math.round(element.width));
    const maskH = natural?.h ?? Math.max(64, Math.round(element.height));
    const maskDataUrl = createRectMaskPng(maskW, maskH, inpaintRect);
    if (!maskDataUrl) return;

    const inpaintModel = 'gpt-image-2';
    const pid = uuidv4();
    const inheritedVersions = computeInheritedVersions(element);

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
    }, '开始局部重绘');

    const req: GenRequest = {
      model: inpaintModel,
      prompt: effectivePrompt,
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

  // ── Standard image generation path ─────────────────────────────────
  const resolved = resolveImageSize(aspect, quality);
  const displaySize = computePlaceholderDisplaySize(aspect);
  const n = Math.max(1, Number(count) || 1);

  const isEmptyImageAnchor =
    element.type === 'image' &&
    (element.src ?? '').length === 0;

  const isErroredAnchor =
    element.type === 'aigenerating' && !!element.error;

  const isReplaceInPlace =
    (element.type === 'image' && !isEmptyImageAnchor && n === 1) ||
    (isErroredAnchor && n === 1);

  // Merge connection-sourced images with user-uploaded references.
  const linkedUrls = upstreamImages.map(u => u.src);
  const mergedRefs: string[] = [];
  const MAX_REFERENCES = 4;
  for (const url of [...linkedUrls, ...references]) {
    if (!url) continue;
    if (mergedRefs.includes(url)) continue;
    if (mergedRefs.length >= MAX_REFERENCES) break;
    mergedRefs.push(url);
  }

  const anchorRect =
    isEmptyImageAnchor
      ? { x: element.x - displaySize.w - 40, y: element.y, w: displaySize.w, h: displaySize.h }
      : { x: element.x, y: element.y, w: element.width, h: element.height };

  const slots = isReplaceInPlace
    ? [{ x: element.x, y: element.y, w: element.width, h: element.height }]
    : computeBatchGrid(anchorRect, n);

  const inheritedVersions = isReplaceInPlace
    ? (element.type === 'aigenerating'
        ? element.inheritedVersions
        : computeInheritedVersions(element))
    : undefined;

  const placeholderGeneration = {
    model,
    aspect,
    quality,
    qualityLevel,
    count,
    references: mergedRefs.length > 0 ? mergedRefs : undefined,
  } satisfies Partial<GenerationConfig>;

  const placeholderIds: string[] = [];
  const shouldReplaceAnchor = (isEmptyImageAnchor || isReplaceInPlace);
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const id = uuidv4();
    placeholderIds.push(id);
    const placeholderEl = {
      id,
      type: 'aigenerating' as const,
      x: slot.x,
      y: slot.y,
      width: slot.w,
      height: slot.h,
      prompt,
      generation: placeholderGeneration,
      ...(isReplaceInPlace && i === 0
        ? { inheritedVersions, inheritedPrompt: prompt }
        : {}),
    };

    if (shouldReplaceAnchor && i === 0) {
      replaceElement(element.id, placeholderEl, '开始图像生成');
    } else {
      addElement(placeholderEl);
    }
  }

  const req: GenRequest = {
    model,
    prompt: effectivePrompt,
    size: resolved.size,
    aspect,
    resolution: quality,
    qualityLevel: qualityLevelOpts ? qualityLevel : undefined,
    n,
    w: displaySize.w,
    h: displaySize.h,
    references: mergedRefs.length > 0 ? mergedRefs : undefined,
  };

  setIsGenerating(true);
  try {
    await runGeneration(placeholderIds, req);
  } finally {
    setIsGenerating(false);
  }
}
