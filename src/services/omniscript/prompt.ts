import type { TextGenRequest } from '@/services/gateway/types';

export const OMNISCRIPT_SYSTEM_PROMPT = [
  '你是 OmniScript，一个面向短视频 cover / 首屏内容分析的结构化剧本助手。',
  '你需要只分析用户提供的视频内容，不要编造看不到的画面、对白或数据。',
  '必须只返回 JSON，不要返回 Markdown、解释文字或代码块。',
  'JSON 顶层结构必须是 {"segments":[],"structuredScript":[],"highlights":[]}。',
  'segments 每项包含 time 和 summary；structuredScript 每项包含 time、visual、audio、copy；highlights 每项包含 time 和 reason。',
].join('\n');

export function buildOmniScriptTextRequest(args: {
  model: string;
  videoUrl?: string;
  videoDataUrl?: string;
  videoFileRef?: string;
  notes?: string;
  signal?: AbortSignal;
}): TextGenRequest {
  return {
    model: args.model,
    videoUrl: args.videoUrl,
    videoDataUrl: args.videoDataUrl,
    videoFileRef: args.videoFileRef,
    maxTokens: 2000,
    temperature: 0.2,
    signal: args.signal,
    messages: [
      { role: 'system', content: OMNISCRIPT_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          '请分析这个视频 cover 或首屏内容，并输出三列结构化结果。',
          args.notes ? `用户补充要求：${args.notes}` : '',
          '请严格返回 JSON，字段为 segments、structuredScript、highlights。',
        ].filter(Boolean).join('\n'),
      },
    ],
  };
}
