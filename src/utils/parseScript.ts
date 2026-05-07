import { v4 as uuidv4 } from 'uuid';
import type { ParsedScene } from '../types/canvas';


/**
 * 正则：匹配 ### 场 <数字> 格式的分镜锚点标题。
 * 支持格式：
 * - ### 场 1：咖啡厅相遇  → sceneNum=1, title="咖啡厅相遇"
 * - ### 场 2 雨中追逐     → sceneNum=2, title="雨中追逐"
 * - ### 场 3：           → sceneNum=3, title=""
 * 不匹配：### 场 一、### 场景 1、## 场 1 等
 */
const SCENE_HEADING_RE = /^###\s*场\s*(\d+)[：:：]?\s*(.*)$/;

export function parseScriptMarkdown(text: string): ParsedScene[] {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split('\n');
  const scenes: ParsedScene[] = [];
  let current: ParsedScene | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const match = line.match(SCENE_HEADING_RE);

    if (match) {
      if (current) {
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
    }
  }

  if (current) {
    scenes.push(current);
  }

  return scenes;
}


