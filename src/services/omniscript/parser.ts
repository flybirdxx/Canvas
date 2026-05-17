import type {
  OmniScriptHighlight,
  OmniScriptParseResult,
  OmniScriptSegment,
  OmniScriptStructuredLine,
} from './types';

export function parseOmniScriptResult(raw: string): OmniScriptParseResult {
  const trimmed = stripJsonFence(raw).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return {
      ok: false,
      message: 'OmniScript 模型输出无法解析为合法 JSON。',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, message: 'OmniScript 输出的 JSON 顶层必须是对象。' };
  }

  const obj = parsed as Record<string, unknown>;
  return {
    segments: normalizeSegments(obj.segments),
    structuredScript: normalizeStructuredScript(obj.structuredScript),
    highlights: normalizeHighlights(obj.highlights),
  };
}

function stripJsonFence(raw: string): string {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match ? match[1] : raw;
}

function normalizeSegments(value: unknown): OmniScriptSegment[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return { summary: item };
    const obj = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      time: toOptionalString(obj.time),
      summary: toRequiredString(obj.summary ?? obj.content ?? obj.text),
    };
  }).filter(item => item.summary.length > 0);
}

function normalizeStructuredScript(value: unknown): OmniScriptStructuredLine[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return { copy: item };
    const obj = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      time: toOptionalString(obj.time),
      visual: toOptionalString(obj.visual ?? obj.shot),
      audio: toOptionalString(obj.audio ?? obj.sound),
      copy: toRequiredString(obj.copy ?? obj.dialogue ?? obj.content ?? obj.text),
    };
  }).filter(item => item.copy.length > 0);
}

function normalizeHighlights(value: unknown): OmniScriptHighlight[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return { reason: item };
    const obj = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      time: toOptionalString(obj.time),
      reason: toRequiredString(obj.reason ?? obj.content ?? obj.text),
    };
  }).filter(item => item.reason.length > 0);
}

function toOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function toRequiredString(value: unknown): string {
  return toOptionalString(value) ?? '';
}
