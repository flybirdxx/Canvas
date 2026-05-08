import type { ElementType, GenerationConfig } from '@/types/canvas';

/**
 * A single element inside a template. Coordinates are expressed relative to
 * the template's pivot point (usually the element centroid). The instantiator
 * translates them to absolute canvas coords when placing.
 *
 * `ports` are intentionally omitted — the store auto-seeds inputs/outputs
 * based on element type when `addElement` runs, so templates reference ports
 * by their default index (outputs[0], inputs[0]) rather than by id.
 */
export interface TemplateElement {
  /** Local id within the template; used by connections to link siblings. */
  localId: string;
  type: ElementType;
  /** Offset from template pivot in canvas units. */
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;

  // Element-specific payloads — only set the ones relevant to `type`.
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  align?: 'left' | 'center' | 'right' | 'justify';

  src?: string;
  prompt?: string;
  generation?: Partial<GenerationConfig>;
}

/** Connection across two template elements, referencing port INDEXES (0-based). */
export interface TemplateConnection {
  fromLocalId: string;
  toLocalId: string;
  /** Index into the source element's `outputs[]`, default 0. */
  fromPortIndex?: number;
  /** Index into the target element's `inputs[]`, default 0. */
  toPortIndex?: number;
}

export type TemplateCategory = '短视频' | '小红书' | '故事分镜' | '角色设定';

export interface CanvasTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  /** Short tags shown on cards. */
  tags?: string[];
  /** Single emoji for the card header, keeps UI lightweight. */
  emoji?: string;
  elements: TemplateElement[];
  connections?: TemplateConnection[];
}

// ---------- Built-in templates -----------------------------------------------
// Sizes chosen to match the rest of the app (image nodes default 400×300).

/** 1. 短视频 4 分镜: script text → 4 scene images, connected. */
const SHORT_VIDEO_STORYBOARD: CanvasTemplate = {
  id: 'short-video-storyboard-4',
  name: '短视频 4 分镜',
  category: '短视频',
  description: '剧本节点驱动 4 个分镜，适合抖音 / 视频号 / YouTube Shorts 起稿',
  tags: ['4 分镜', '竖屏 9:16', '剧本'],
  emoji: '🎬',
  elements: [
    {
      localId: 'script',
      type: 'text',
      offsetX: -560,
      offsetY: -140,
      width: 340,
      height: 280,
      text: '# 短视频剧本\n\n主题：\n节奏：15s 开场 + 3 个反转 + 收束\n目标情绪：\n\n镜头 1：\n镜头 2：\n镜头 3：\n镜头 4：',
      fontSize: 14,
      fontFamily: 'Arial',
      fill: '#111827',
      align: 'left',
    },
    ...[0, 1, 2, 3].map((i) => ({
      localId: `scene-${i + 1}`,
      type: 'image' as ElementType,
      offsetX: -120 + (i % 2) * 440,
      offsetY: -200 + Math.floor(i / 2) * 340,
      width: 400,
      height: 300,
      src: '',
      prompt: `镜头 ${i + 1}：`,
      generation: { aspect: '9:16', quality: '1K', count: '1' },
    })),
  ],
  connections: [0, 1, 2, 3].map((i) => ({
    fromLocalId: 'script',
    toLocalId: `scene-${i + 1}`,
    fromPortIndex: 0,
    toPortIndex: 0,
  })),
};

/** 2. 小红书封面: 文案 text + 1 封面图 (1:1). */
const XIAOHONGSHU_COVER: CanvasTemplate = {
  id: 'xiaohongshu-cover',
  name: '小红书封面',
  category: '小红书',
  description: '标题文案 + 封面图（1:1），复制即用',
  tags: ['1:1', '标题', '封面'],
  emoji: '📕',
  elements: [
    {
      localId: 'copy',
      type: 'text',
      offsetX: -440,
      offsetY: -100,
      width: 320,
      height: 200,
      text: '【爆款标题公式】\n数字 + 痛点 + 反差\n\n正文：\n• 开头引入\n• 3 个要点\n• 结尾互动',
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
  connections: [
    { fromLocalId: 'copy', toLocalId: 'cover', fromPortIndex: 0, toPortIndex: 0 },
  ],
};

/** 3. 四格故事漫画 2×2. */
const FOUR_PANEL_STORY: CanvasTemplate = {
  id: 'four-panel-story',
  name: '四格故事漫画',
  category: '故事分镜',
  description: '起承转合 2×2 格局，每格预填 prompt 提示',
  tags: ['4 格', '起承转合'],
  emoji: '📚',
  elements: [
    { name: '起', prompt: '起：开场角色/场景，交代主体和情绪' },
    { name: '承', prompt: '承：事件推进，引入冲突或悬念' },
    { name: '转', prompt: '转：转折点，出现意外或反差' },
    { name: '合', prompt: '合：收束，给出结果或幽默点' },
  ].map((cfg, i) => ({
    localId: `panel-${i + 1}`,
    type: 'image' as ElementType,
    offsetX: -220 + (i % 2) * 440,
    offsetY: -220 + Math.floor(i / 2) * 340,
    width: 400,
    height: 300,
    src: '',
    prompt: cfg.prompt,
    generation: { aspect: '4:3', quality: '1K', count: '1' },
  })),
  connections: [],
};

/** 4. 角色三视图: description → front/side/back. */
const CHARACTER_TURNAROUND: CanvasTemplate = {
  id: 'character-turnaround',
  name: '角色三视图',
  category: '角色设定',
  description: '角色描述文本驱动正 / 侧 / 背三视图',
  tags: ['三视图', '角色设定', '游戏 / 动画'],
  emoji: '🧝',
  elements: [
    {
      localId: 'desc',
      type: 'text',
      offsetX: -640,
      offsetY: -100,
      width: 320,
      height: 280,
      text: '# 角色设定\n\n姓名：\n年龄：\n身份：\n外貌关键词：\n服饰/道具：\n性格：\n标志性动作/表情：',
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
      prompt: `角色${view}立绘，全身，中性灯光，纯灰色背景，高细节`,
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
  SHORT_VIDEO_STORYBOARD,
  XIAOHONGSHU_COVER,
  FOUR_PANEL_STORY,
  CHARACTER_TURNAROUND,
];

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  '短视频',
  '小红书',
  '故事分镜',
  '角色设定',
];
