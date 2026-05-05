import { v4 as uuidv4 } from 'uuid';
import type { ParsedScene } from '../types/canvas';
import { useCanvasStore } from '../store/useCanvasStore';

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

/**
 * 根据剧本节点的锚点列表，在画布上批量创建 scene 节点。
 * 每个 scene 节点绑定 scriptId，指向父剧本节点。
 * 位置按 sceneNum 编号依次错开排列（相邻 40px 垂直偏移）。
 */
export function convertScriptToScenes(
  scriptId: string,
  scenes: ParsedScene[],
  scriptNodeX: number,
  scriptNodeY: number,
): string[] {
  const addElement = useCanvasStore.getState().addElement;
  const sceneIds: string[] = [];

  scenes.forEach((parsed, index) => {
    const id = uuidv4();
    const VERTICAL_OFFSET = 40;
    const baseWidth = 320;
    const baseHeight = 200;

    addElement({
      id,
      type: 'scene',
      x: scriptNodeX + 60 + (index % 2) * 30,
      y: scriptNodeY + 320 + index * VERTICAL_OFFSET,
      width: baseWidth,
      height: baseHeight,
      sceneNum: parsed.sceneNum,
      title: parsed.title,
      content: parsed.content,
      scriptId,
    });

    sceneIds.push(id);
  });

  return sceneIds;
}
