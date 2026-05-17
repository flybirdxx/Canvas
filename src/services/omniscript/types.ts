import type { generateTextByModelId } from '@/services/gateway';
import type { GatewayErrorKind } from '@/services/gateway/types';

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
