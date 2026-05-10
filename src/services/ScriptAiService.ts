/**
 * ScriptAiService — AI 结构化分镜服务（引擎 B）。
 *
 * 调用网关的 `generateTextByModelId`，将剧本场次文本解析为
 * 结构化的 ScriptLine[]。配合 parseScript.ts 的正则引擎（A）
 * 形成双引擎策略：正则快速解析标准格式，AI 处理复杂/非结构化文本。
 */
import { v4 as uuidv4 } from 'uuid';
import { generateTextByModelId, listModels } from '@/services/gateway';
import type { ScriptLine, LineType } from '@/types/canvas';
import { EMOTION_PRESETS } from '@/types/canvas';
import { parseSceneLines } from '@/utils/parseScript';

// ── Types ────────────────────────────────────────────────────────────

export interface StructuringResult {
  ok: true;
  lines: ScriptLine[];
}

export interface StructuringError {
  ok: false;
  message: string;
}

export type StructuringOutcome = StructuringResult | StructuringError;

// ── Constants ─────────────────────────────────────────────────────────

const VALID_EMOTIONS = new Set<string>(EMOTION_PRESETS.map(e => e.label));
const VALID_LINE_TYPES = new Set<LineType>(['dialogue', 'action', 'environment']);

const SYSTEM_PROMPT = `你是一个专业的剧本结构化解析器。你的任务是将剧本场次内容转换为结构化的分镜行。

输入是一段剧本文字，你需要将其解析为 JSON 数组，每个元素包含：
- role: 角色名（对白行必填，动作/环境行可为空字符串）
- content: 台词或描述文字
- lineType: "dialogue"（对白）、"action"（动作）或 "environment"（环境/氛围）
- emotion: 情绪标签，仅从以下列表选择：${EMOTION_PRESETS.map(e => e.label).join('、')}。无法判断时省略（不要该字段）

解析规则：
1. "角色名：台词" 或 "角色名 (情绪)：台词" → dialogue，提取角色和台词
2. 描述角色动作的行（如"某某拍桌而起""某某推门而入"）→ action
3. 描述环境/氛围的行（如"雨越下越大""灯光昏暗"）→ environment
4. 保持原有文字内容不变，不要添加、删减或改写
5. 只返回 JSON 数组，不要包含 Markdown 代码块标记或其他任何文字`;

// ── Helpers ───────────────────────────────────────────────────────────

/** 剥离 LLM 返回中常见的 Markdown 代码块标记 */
function stripMarkdownFence(text: string): string {
  let t = text.trim();
  // Remove leading ```json / ``` fences
  t = t.replace(/^```(?:json|JSON)?\s*\n?/i, '');
  // Remove trailing ``` fences
  t = t.replace(/\n?```\s*$/i, '');
  return t.trim();
}

/** 验证并清洗 LLM 返回的单行数据 */
function sanitizeLine(raw: unknown, index: number): ScriptLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const role = typeof obj.role === 'string' ? obj.role.trim() : '';
  const content = typeof obj.content === 'string' ? obj.content.trim() : '';
  if (!content) return null; // skip empty lines

  const lineType: LineType =
    typeof obj.lineType === 'string' && VALID_LINE_TYPES.has(obj.lineType as LineType)
      ? (obj.lineType as LineType)
      : 'dialogue';

  let emotion: string | undefined;
  let emotionEmoji: string | undefined;
  if (typeof obj.emotion === 'string' && obj.emotion.trim()) {
    const rawEmotion = obj.emotion.trim();
    if (VALID_EMOTIONS.has(rawEmotion)) {
      emotion = rawEmotion;
      emotionEmoji = EMOTION_PRESETS.find(e => e.label === rawEmotion)?.emoji;
    }
  }

  return {
    id: uuidv4(),
    role,
    content,
    lineType,
    emotion,
    emotionEmoji,
    timestamp: typeof obj.timestamp === 'number' && obj.timestamp >= 0 ? obj.timestamp : undefined,
  };
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * 获取首个可用的文本模型 ID。没有可用模型时返回 null。
 */
export function getDefaultTextModelId(): string | null {
  const models = listModels('text');
  return models.length > 0 ? models[0].id : null;
}

/**
 * 使用 AI 将场次文本解析为结构化 ScriptLine 数组。
 *
 * @param inputText - 场次的原始文本内容（可能为多行）。
 * @param modelId - 文本模型 ID（默认自动选择第一个可用模型）。
 * @returns StructuringOutcome - 成功时包含 lines，失败时包含错误信息。
 */
export async function structureSceneWithAI(
  inputText: string,
  modelId?: string,
): Promise<StructuringOutcome> {
  if (!inputText || typeof inputText !== 'string' || !inputText.trim()) {
    return { ok: false, message: '输入内容为空' };
  }

  const model = modelId || getDefaultTextModelId();
  if (!model) {
    return {
      ok: false,
      message: '没有可用的文本模型。请先在设置中配置 AI Provider。',
    };
  }

  const result = await generateTextByModelId({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: inputText },
    ],
    temperature: 0.2, // 低温度以获得更一致的结构化输出
  });

  if (result.ok !== true) {
    return {
      ok: false,
      message: `AI 请求失败：${result.message}${result.detail ? ` — ${result.detail}` : ''}`,
    };
  }

  // Parse the JSON response
  const cleaned = stripMarkdownFence(result.text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // CR-10: JSON 解析失败 → 降级到正则引擎
    const fallbackLines = parseSceneLines(inputText);
    if (fallbackLines.length === 0) {
      return { ok: false, message: 'AI 返回了无法解析的内容，降级解析也未得到有效行' };
    }
    return { ok: true, lines: fallbackLines };
  }

  if (!Array.isArray(parsed)) {
    // CR-10: 返回非数组 → 降级到正则引擎
    const fallbackLines = parseSceneLines(inputText);
    if (fallbackLines.length === 0) {
      return { ok: false, message: 'AI 返回格式不正确，降级解析也未得到有效行' };
    }
    return { ok: true, lines: fallbackLines };
  }

  const lines: ScriptLine[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const line = sanitizeLine(parsed[i], i);
    if (line) lines.push(line);
  }

  if (lines.length === 0) {
    // CR-10: AI 返回了空数据 → 降级到正则引擎
    const fallbackLines = parseSceneLines(inputText);
    if (fallbackLines.length === 0) {
      return { ok: false, message: 'AI 未返回有效行数据，降级解析也未得到有效行' };
    }
    return { ok: true, lines: fallbackLines };
  }

  return { ok: true, lines };
}
