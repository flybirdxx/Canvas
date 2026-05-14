import type { ElementType, GenerationConfig } from '@/types/canvas';

export interface TemplateElement {
  localId: string;
  type: ElementType;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  src?: string;
  prompt?: string;
  generation?: Partial<GenerationConfig>;
  title?: string;
  videoUrl?: string;
  notes?: string;
  analysisStatus?: 'idle' | 'running' | 'success' | 'error';
  result?: { segments: []; structuredScript: []; highlights: [] };
}

export interface TemplateConnection {
  fromLocalId: string;
  toLocalId: string;
  fromPortIndex?: number;
  toPortIndex?: number;
}

export type TemplateCategory = '短视频' | '小红书' | '视频分析' | '角色设定';

export interface CanvasTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  tags?: string[];
  emoji?: string;
  elements: TemplateElement[];
  connections?: TemplateConnection[];
}

const OMNISCRIPT_COVER: CanvasTemplate = {
  id: 'omniscript-video-cover',
  name: 'OmniScript 视频 Cover 拆解',
  category: '视频分析',
  description: '粘贴视频链接或连接视频文件，拆解分段剧情、结构化脚本和高光时刻。',
  tags: ['视频分析', '仿写', 'Cover'],
  emoji: '🎬',
  elements: [
    {
      localId: 'omniscript',
      type: 'omniscript',
      offsetX: -320,
      offsetY: -220,
      width: 640,
      height: 440,
      title: 'OmniScript',
      videoUrl: '',
      notes: '分析这个视频的开头钩子、转场节奏、文案结构和可复用高光。',
      analysisStatus: 'idle',
      result: { segments: [], structuredScript: [], highlights: [] },
    },
  ],
};

const XIAOHONGSHU_COVER: CanvasTemplate = {
  id: 'xiaohongshu-cover',
  name: '小红书封面',
  category: '小红书',
  description: '标题文案 + 封面图，适合快速起稿。',
  tags: ['1:1', '标题', '封面'],
  emoji: '📌',
  elements: [
    {
      localId: 'copy',
      type: 'text',
      offsetX: -440,
      offsetY: -100,
      width: 320,
      height: 200,
      text: '爆款标题公式\n\n数字 + 痛点 + 反差\n\n正文：\n- 开头引入\n- 3 个要点\n- 结尾互动',
      fontSize: 14,
      fontFamily: 'Arial',
      fill: '#0f172a',
      align: 'left',
    },
    {
      localId: 'cover',
      type: 'image',
      offsetX: 80,
      offsetY: -200,
      width: 400,
      height: 400,
      src: '',
      prompt: '小红书封面，主题：，文字排版居中，色调温暖，高质感',
      generation: { aspect: '1:1', quality: '1K', count: '1' },
    },
  ],
  connections: [{ fromLocalId: 'copy', toLocalId: 'cover', fromPortIndex: 0, toPortIndex: 0 }],
};

const CHARACTER_TURNAROUND: CanvasTemplate = {
  id: 'character-turnaround',
  name: '角色三视图',
  category: '角色设定',
  description: '角色描述文本驱动正面、侧面、背面三视图。',
  tags: ['三视图', '角色设定'],
  emoji: '🧍',
  elements: [
    {
      localId: 'desc',
      type: 'text',
      offsetX: -640,
      offsetY: -100,
      width: 320,
      height: 280,
      text: '角色设定\n\n姓名：\n年龄：\n身份：\n外貌关键词：\n服饰/道具：\n性格：',
      fontSize: 14,
      fontFamily: 'Arial',
      fill: '#111827',
      align: 'left',
    },
    ...['正面', '侧面', '背面'].map((view, i) => ({
      localId: `view-${i}`,
      type: 'image' as ElementType,
      offsetX: -280 + i * 340,
      offsetY: -180,
      width: 320,
      height: 420,
      src: '',
      prompt: `角色${view}站绘，全身，中性灯光，纯灰色背景，高细节`,
      generation: { aspect: '3:4', quality: '1K', count: '1' },
    })),
  ],
  connections: ['view-0', 'view-1', 'view-2'].map((to) => ({
    fromLocalId: 'desc',
    toLocalId: to,
    fromPortIndex: 0,
    toPortIndex: 0,
  })),
};

export const BUILTIN_TEMPLATES: CanvasTemplate[] = [
  OMNISCRIPT_COVER,
  XIAOHONGSHU_COVER,
  CHARACTER_TURNAROUND,
];

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  '视频分析',
  '小红书',
  '角色设定',
  '短视频',
];
