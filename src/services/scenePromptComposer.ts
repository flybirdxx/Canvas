/**
 * scenePromptComposer — 将 SceneElement 的结构化数据转换为 AI 生成用的自然语言 prompt。
 *
 * E7 Story 3: composeScenePrompt 纯函数
 * 被 Story 4 (FlowResolver) 和 Story 5 (executeNode) 共同依赖。
 */
import type { SceneElement, ScriptLine } from '@/types/canvas';

const EMOJI_MAP: Record<string, string> = {
  开心: '😊',
  愤怒: '😡',
  悲伤: '😢',
  惊讶: '😲',
  恐惧: '😨',
  平静: '😐',
  紧张: '😰',
  兴奋: '🤩',
  厌恶: '🤢',
  思考: '🤔',
  得意: '😏',
  感动: '🥹',
};

/**
 * 将一条 ScriptLine 转换为单行自然语言字符串。
 * - dialogue: 角色（情绪 emoji）：台词
 * - action: [动作] 动作描述
 * - environment: [环境] 环境描写
 */
function formatLine(line: ScriptLine): string {
  switch (line.lineType) {
    case 'action':
      return `[动作] ${line.content}`;
    case 'environment':
      return `[环境] ${line.content}`;
    case 'dialogue':
    default: {
      const emoji = line.emotion && EMOJI_MAP[line.emotion]
        ? ` ${EMOJI_MAP[line.emotion]}`
        : '';
      const role = line.role || '旁白';
      const emotion = line.emotion ? `（${line.emotion}）` : '';
      return `${role}${emotion}${emoji}：${line.content}`;
    }
  }
}

/**
 * 将 SceneElement 转换为自然语言 prompt。
 *
 * 输出格式：
 * ```
 * [场景 N: 标题]
 * 内容概要（如果有）
 *
 * 角色：
 * 角色名（情绪）😄：台词
 * 角色名：台词
 * [动作] 动作描述
 * [环境] 环境描写
 *
 * [导演备注]
 * 备注内容（如果有）
 * ```
 *
 * 当 scene 既无 lines 也无 content 时，返回仅含标题的最小 prompt。
 */
export function composeScenePrompt(scene: SceneElement): string {
  const parts: string[] = [];

  // 1. 场景标题行
  const sceneLabel = scene.title
    ? `[场景 ${scene.sceneNum}: ${scene.title}]`
    : `[场景 ${scene.sceneNum}]`;
  parts.push(sceneLabel);

  // 2. 内容概要（lines 为空时作为 fallback）
  if (scene.content && (!scene.lines || scene.lines.length === 0)) {
    parts.push(scene.content);
  }

  // 3. 结构化 lines
  if (scene.lines && scene.lines.length > 0) {
    // 分组：dialogue / action / environment
    const dialogues = scene.lines.filter(l => l.lineType === 'dialogue');
    const actions = scene.lines.filter(l => l.lineType === 'action');
    const environments = scene.lines.filter(l => l.lineType === 'environment');

    if (dialogues.length > 0) {
      parts.push('');
      parts.push('角色：');
      for (const line of dialogues) {
        parts.push('  ' + formatLine(line));
      }
    }

    if (actions.length > 0) {
      parts.push('');
      parts.push('动作描述：');
      for (const line of actions) {
        parts.push('  ' + formatLine(line));
      }
    }

    if (environments.length > 0) {
      parts.push('');
      parts.push('环境描写：');
      for (const line of environments) {
        parts.push('  ' + formatLine(line));
      }
    }
  }

  // 4. 导演备注（始终追加，即使为空格也跳过）
  if (scene.analysisNote && scene.analysisNote.trim().length > 0) {
    parts.push('');
    parts.push(`[导演备注] ${scene.analysisNote.trim()}`);
  }

  return parts.join('\n');
}
