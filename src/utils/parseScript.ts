import { v4 as uuidv4 } from 'uuid';
import type { ParsedScene, ScriptLine, LineType } from '@/types/canvas';
import { EMOTION_PRESETS } from '@/types/canvas';


/**
 * 正则：匹配 ### 场 <数字> 格式的分镜锚点标题。
 * 支持格式：
 * - ### 场 1：咖啡厅相遇  → sceneNum=1, title="咖啡厅相遇"
 * - ### 场 2 雨中追逐     → sceneNum=2, title="雨中追逐"
 * - ### 场 3：           → sceneNum=3, title=""
 * 不匹配：### 场 一、### 场景 1、## 场 1 等
 */
const SCENE_HEADING_RE = /^###\s*场\s*(\d+)[：:：]?\s*(.*)$/;

/**
 * 结构化行解析正则：
 *
 * - 对白：角色 (情绪)：台词  → 提取角色、情绪、台词
 * - 对白：角色：台词         → 提取角色、台词
 * - 动作：[动作] 描述        → lineType='action'
 * - 环境：[环境] 描述        → lineType='environment'
 * - 旁白：旁白：内容         → role='旁白', lineType='dialogue'
 */

// 角色 (情绪)：内容
const DIALOGUE_EMOTION_RE = /^(.+?)\s*[（(]([^）)]+)[）)]\s*[：:：]\s*(.+)$/;

// 角色：内容（普通对白 / 旁白）
const DIALOGUE_PLAIN_RE = /^(.+?)\s*[：:：]\s*(.+)$/;

// [动作] 描述
const ACTION_RE = /^\[动作\]\s*(.+)$/;

// [环境] 描述
const ENVIRONMENT_RE = /^\[环境\]\s*(.+)$/;

/** 口语到预设情绪的别名映射 */
const EMOTION_ALIASES: Record<string, string> = {
  生气: '愤怒',
  发怒: '愤怒',
  大怒: '愤怒',
  伤心: '悲伤',
  难过: '悲伤',
  流泪: '悲伤',
  害怕: '恐惧',
  惊恐: '恐惧',
  吓: '恐惧',
  焦虑: '紧张',
  不安: '紧张',
  高兴: '开心',
  愉快: '开心',
  快乐: '开心',
  惊异: '惊讶',
  吃惊: '惊讶',
  震惊: '惊讶',
  冷静: '平静',
  沉着: '平静',
  激动: '兴奋',
  讨厌: '厌恶',
  恶心: '厌恶',
  沉思: '思考',
  思索: '思考',
  骄傲: '得意',
  感动: '感动',
  感激: '感动',
};

/**
 * 从预设情绪表中查找匹配的情绪。
 * 支持别名映射：如 "生气" → "愤怒"
 */
function findEmotion(text: string): { label: string; emoji: string } | undefined {
  const cleaned = text.replace(/[的地得了着]$/, '').trim();

  // Check alias first (colloquial → standard)
  if (EMOTION_ALIASES[cleaned]) {
    const standardLabel = EMOTION_ALIASES[cleaned];
    const preset = EMOTION_PRESETS.find(p => p.label === standardLabel);
    if (preset) return preset;
  }

  // Exact match
  for (const preset of EMOTION_PRESETS) {
    if (preset.label === cleaned) return preset;
  }
  // Partial match if text contains the emotion label
  for (const preset of EMOTION_PRESETS) {
    if (cleaned.includes(preset.label) || preset.label.includes(cleaned)) return preset;
  }
  return undefined;
}

/**
 * 将纯文本内容解析为结构化 ScriptLine 数组。
 * 按行解析，每行尝试匹配对话/动作/环境模式。
 */
export function parseSceneLines(content: string): ScriptLine[] {
  if (!content || typeof content !== 'string') return [];

  const lines = content.split('\n');
  const result: ScriptLine[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Try [情绪] 快捷语法
    const actionMatch = line.match(ACTION_RE);
    if (actionMatch) {
      const lineType: LineType = 'action';
      const lineContent = actionMatch[1].trim();
      result.push({
        id: uuidv4(),
        role: '',
        content: lineContent,
        emotion: undefined,
        emotionEmoji: undefined,
        lineType,
        timestamp: undefined,
      });
      continue;
    }

    const envMatch = line.match(ENVIRONMENT_RE);
    if (envMatch) {
      const lineType: LineType = 'environment';
      const lineContent = envMatch[1].trim();
      result.push({
        id: uuidv4(),
        role: '',
        content: lineContent,
        emotion: undefined,
        emotionEmoji: undefined,
        lineType,
        timestamp: undefined,
      });
      continue;
    }

    // Try 角色 (情绪)：内容
    const emotionMatch = line.match(DIALOGUE_EMOTION_RE);
    if (emotionMatch) {
      const role = emotionMatch[1].trim();
      const rawEmotion = emotionMatch[2].trim();
      const lineContent = emotionMatch[3].trim();

      let emotion: string | undefined;
      let emotionEmoji: string | undefined;

      const found = findEmotion(rawEmotion);
      if (found) {
        emotion = found.label;
        emotionEmoji = found.emoji;
      } else {
        emotion = rawEmotion;
      }

      result.push({
        id: uuidv4(),
        role,
        content: lineContent,
        emotion,
        emotionEmoji,
        lineType: 'dialogue',
        timestamp: undefined,
      });
      continue;
    }

    // Try 角色：内容
    const plainMatch = line.match(DIALOGUE_PLAIN_RE);
    if (plainMatch) {
      const role = plainMatch[1].trim();
      const lineContent = plainMatch[2].trim();

      result.push({
        id: uuidv4(),
        role,
        content: lineContent,
        emotion: undefined,
        emotionEmoji: undefined,
        lineType: 'dialogue',
        timestamp: undefined,
      });
      continue;
    }

    // CR-9: unrecognised lines are plain narration, not dialogue.
    // Labelling them 'dialogue' inflated the dialogue count in the analysis tab.
    result.push({
      id: uuidv4(),
      role: '',
      content: line,
      emotion: undefined,
      emotionEmoji: undefined,
      lineType: 'action',
      timestamp: undefined,
    });
  }

  return result;
}

export function parseScriptMarkdown(text: string): ParsedScene[] {
  if (!text || typeof text !== 'string') return [];

  const rawLines = text.split('\n');
  const scenes: ParsedScene[] = [];
  let current: ParsedScene | null = null;
  /** CR-2: collect lines before the first scene anchor so they aren't silently dropped. */
  const preambleLines: string[] = [];

  for (const raw of rawLines) {
    const line = raw.trimEnd();
    const match = line.match(SCENE_HEADING_RE);

    if (match) {
      if (current) {
        current.lines = parseSceneLines(current.content);
        scenes.push(current);
      }
      const sceneNum = parseInt(match[1], 10);
      const title = match[2].trim();
      current = { sceneNum, title, content: '' };
    } else if (current !== null) {
      if (current.content.length > 0) {
        current.content += '\n';
      }
      current.content += line;
    } else {
      // CR-2: save lines before the first anchor as preamble
      if (line.trim()) {
        preambleLines.push(line);
      }
    }
  }

  if (current) {
    // CR-2: prepend preamble to the first scene's content
    if (scenes.length === 0 && preambleLines.length > 0) {
      current.content = preambleLines.join('\n') + (current.content ? '\n' + current.content : '');
    }
    current.lines = parseSceneLines(current.content);
    scenes.push(current);
  } else if (preambleLines.length > 0) {
    // CR-2: no scene anchors at all — treat entire text as a single scene
    const content = preambleLines.join('\n');
    scenes.push({
      sceneNum: 1,
      title: '',
      content,
      lines: parseSceneLines(content),
    });
  }

  return scenes;
}
