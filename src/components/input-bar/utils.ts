/**
 * input-bar pure functions & constants.
 *
 * Extracted from NodeInputBar.tsx so the component stays focused on
 * wiring state and UI, while the model-option builder, size resolvers,
 * and preset helpers are independently testable.
 */
import { v4 as uuidv4 } from 'uuid';
import { listModels, getProvider } from '@/services/gateway';
import type { CanvasElement, NodeVersion } from '@/types/canvas';

// ── Types ────────────────────────────────────────────────────────────

export interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
  caption?: string;
}

export type GenMode = 'image' | 'video' | 'text';

// ── Constants ────────────────────────────────────────────────────────

export const ASPECT_OPTIONS: DropdownOption[] = [
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
];

export const QUALITY_OPTIONS_IMAGE: DropdownOption[] = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
  { value: 'auto', label: 'Auto' },
];

export const IMAGE_SIZE_PRESETS: Record<string, Record<string, string>> = {
  '1:1':  { '1K': '1024x1024', '2K': '2048x2048', '4K': '2880x2880', 'auto': 'auto' },
  '16:9': { '1K': '1280x720',  '2K': '2048x1152', '4K': '3840x2160', 'auto': 'auto' },
  '9:16': { '1K': '720x1280',  '2K': '1152x2048', '4K': '2160x3840', 'auto': 'auto' },
  '4:3':  { '1K': '1024x768',  '2K': '2048x1536', '4K': '2880x2160', 'auto': 'auto' },
  '3:4':  { '1K': '768x1024',  '2K': '1536x2048', '4K': '2160x2880', 'auto': 'auto' },
};

export const QUALITY_OPTIONS_VIDEO: DropdownOption[] = [
  { value: '480P', label: '480P' },
  { value: '720P', label: '720P' },
  { value: '1080P', label: '1080P' },
];

export const DURATION_OPTIONS: DropdownOption[] = [
  { value: '3s', label: '3s' },
  { value: '5s', label: '5s' },
  { value: '10s', label: '10s' },
];

export const COUNT_OPTIONS: DropdownOption[] = [
  { value: '1', label: '1 张' },
  { value: '2', label: '2 张' },
  { value: '4', label: '4 张' },
];

export const PLACEHOLDER_LONG_SIDE = 480;

// ── Model option builder ─────────────────────────────────────────────

export function buildModelOptions(
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

// ── Size resolution ──────────────────────────────────────────────────

export function resolveImageSize(aspect: string, quality: string): { size: string; w: number; h: number } {
  const fromTable = IMAGE_SIZE_PRESETS[aspect]?.[quality] ?? '1024x1024';
  if (fromTable === 'auto') {
    return { size: 'auto', w: 1024, h: 1024 };
  }
  const [w, h] = fromTable.split('x').map(Number);
  return { size: fromTable, w, h };
}

export function computePlaceholderDisplaySize(aspect: string): { w: number; h: number } {
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

// ── Preset helpers ───────────────────────────────────────────────────

export function removeSnippetFromPrompt(prompt: string, snippet: string): string {
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

// ── Version history ──────────────────────────────────────────────────

export function computeInheritedVersions(el: CanvasElement): NodeVersion[] | undefined {
  if (el.type !== 'image' && el.type !== 'video') return undefined;
  const currentSrc = (el.src ?? '') as string;
  const existing = (el.versions as NodeVersion[] | undefined) ?? [];
  if (existing.length > 0) return existing;
  if (!currentSrc) return undefined;
  return [{
    id: uuidv4(),
    src: currentSrc,
    prompt: (el.prompt ?? '').trim() || undefined,
    createdAt: Date.now(),
  }];
}
