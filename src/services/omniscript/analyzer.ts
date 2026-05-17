import { generateTextByModelId } from '@/services/gateway';
import type { TextGenResult } from '@/services/gateway/types';
import { buildOmniScriptTextRequest } from './prompt';
import { parseOmniScriptResult } from './parser';
import type {
  AnalyzeVideoToOmniScriptOptions,
  OmniScriptAnalysisResult,
  OmniScriptResult,
} from './types';

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

  const textResult: TextGenResult = await generateText(buildOmniScriptTextRequest({
    model,
    videoUrl,
    videoDataUrl,
    videoFileRef,
    notes,
    signal,
  }));

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
