import { generateTextByModelId } from '@/services/gateway';
import type { GatewayErrorKind, TextGenResult } from '@/services/gateway/types';

export interface OmniScriptSegment {
  time?: string;
  summary: string;
}

export interface OmniScriptStructuredLine {
  time?: string;
  visual?: string;
  audio?: string;
  copy: string;
}

export interface OmniScriptHighlight {
  time?: string;
  reason: string;
}

export interface OmniScriptResult {
  ok?: true;
  segments: OmniScriptSegment[];
  structuredScript: OmniScriptStructuredLine[];
  highlights: OmniScriptHighlight[];
}

export type OmniScriptParseResult =
  | OmniScriptResult
  | { ok: false; message: string; detail?: string };

export type OmniScriptAnalysisResult =
  | { ok: true; result: OmniScriptResult; rawText: string }
  | { ok: false; kind: GatewayErrorKind; message: string; detail?: string };

export interface AnalyzeVideoToOmniScriptOptions {
  model: string;
  videoUrl?: string;
  videoDataUrl?: string;
  videoFileRef?: string;
  notes?: string;
  signal?: AbortSignal;
  generateText?: typeof generateTextByModelId;
}

const OMNISCRIPT_SYSTEM_PROMPT = [
  '你是 OmniScript，一个用于分析视频 cover / 仿写结构的工具。',
  '只基于用户提供的视频素材做拆解，不要编造看不到的信息。',
  '必须输出 JSON，不要 Markdown，不要额外解释。',
  'JSON 结构必须是：{"segments":[],"structuredScript":[],"highlights":[]}。',
  'segments 每项包含 time 和 summary；structuredScript 每项包含 time、visual、audio、copy；highlights 每项包含 time 和 reason。',
].join('\n');

export function parseOmniScriptResult(raw: string): OmniScriptParseResult {
  const trimmed = stripJsonFence(raw).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return {
      ok: false,
      message: 'OmniScript 返回内容不是可解析的 JSON。',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, message: 'OmniScript 返回 JSON 不是对象。' };
  }

  const obj = parsed as Record<string, unknown>;
  return {
    segments: normalizeSegments(obj.segments),
    structuredScript: normalizeStructuredScript(obj.structuredScript),
    highlights: normalizeHighlights(obj.highlights),
  };
}

export async function analyzeVideoToOmniScript(
  options: AnalyzeVideoToOmniScriptOptions,
): Promise<OmniScriptAnalysisResult> {
  const { model, videoUrl, videoDataUrl, videoFileRef, notes, signal } = options;
  const generateText = options.generateText ?? generateTextByModelId;

  if (!videoUrl && !videoDataUrl && !videoFileRef) {
    return {
      ok: false,
      kind: 'empty',
      message: '请先提供视频链接，或连接上游 video/file 节点作为视频来源。',
    };
  }

  const textResult: TextGenResult = await generateText({
    model,
    videoUrl,
    videoDataUrl,
    videoFileRef,
    maxTokens: 2000,
    temperature: 0.2,
    signal,
    messages: [
      { role: 'system', content: OMNISCRIPT_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          '请分析这个视频 cover，用于仿写拆解。',
          notes ? `用户补充要求：${notes}` : '',
          '按 JSON 输出三栏：segments、structuredScript、highlights。',
        ].filter(Boolean).join('\n'),
      },
    ],
  });

  if (textResult.ok === false) {
    return {
      ok: false,
      kind: textResult.kind,
      message: textResult.message.includes('视频理解')
        ? textResult.message
        : `当前模型或 Provider 未接入视频理解能力：${textResult.message}`,
      detail: textResult.detail,
    };
  }

  const parsed = parseOmniScriptResult(textResult.text);
  if ((parsed as { ok?: boolean }).ok === false) {
    const failure = parsed as { ok: false; message: string; detail?: string };
    return { ok: false, kind: 'empty', message: failure.message, detail: failure.detail };
  }
  return { ok: true, result: parsed as OmniScriptResult, rawText: textResult.text };
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
