/**
 * F11 提示词库 — 内建预设
 *
 * 每条预设的 `snippet` 会以 `，${snippet}` 的形式追加到用户 prompt 末尾。
 * `modes` 缺省时视为全模式可用；指定后只在对应 NodeInputBar 模式下出现。
 */

export type PromptMode = 'image' | 'video' | 'text';

export type PromptCategoryId =
  | 'photography'
  | 'illustration'
  | 'product'
  | 'cnStyle'
  | '3d'
  | 'texture';

export interface PromptCategory {
  id: PromptCategoryId;
  label: string;
}

export const PROMPT_CATEGORIES: PromptCategory[] = [
  { id: 'photography', label: '摄影' },
  { id: 'illustration', label: '插画' },
  { id: 'product', label: '产品' },
  { id: 'cnStyle', label: '国风' },
  { id: '3d', label: '3D' },
  { id: 'texture', label: '质感' },
];

export interface PromptPreset {
  id: string;
  category: PromptCategoryId;
  title: string;
  snippet: string;
  /** Which NodeInputBar modes this preset shows up in. Omit = all modes. */
  modes?: PromptMode[];
  tags?: string[];
  /** If true, this preset was created by the user; persisted in usePromptLibraryStore. */
  isCustom?: boolean;
}

export const BUILTIN_PRESETS: PromptPreset[] = [
  // ============ 摄影 (10) ============
  {
    id: 'photo-cinematic',
    category: 'photography',
    title: '电影感',
    snippet: '电影级构图，35mm 胶片质感，浅景深，戏剧性光影',
    tags: ['电影', '胶片'],
  },
  {
    id: 'photo-portrait',
    category: 'photography',
    title: '人像写真',
    snippet: '85mm 人像镜头，f/1.4 大光圈虚化，柔和自然光',
    modes: ['image'],
  },
  {
    id: 'photo-golden-hour',
    category: 'photography',
    title: '黄金时刻',
    snippet: '黄昏黄金时刻，暖色调逆光，长阴影',
  },
  {
    id: 'photo-bw',
    category: 'photography',
    title: '黑白纪实',
    snippet: '黑白摄影，高对比度，纪实风格，颗粒感',
  },
  {
    id: 'photo-macro',
    category: 'photography',
    title: '微距特写',
    snippet: '微距摄影，极浅景深，超高细节，柔和侧光',
    modes: ['image'],
  },
  {
    id: 'photo-street',
    category: 'photography',
    title: '街拍纪实',
    snippet: '街头摄影，抓拍瞬间，自然城市光影，Leica 风格',
  },
  {
    id: 'photo-aerial',
    category: 'photography',
    title: '航拍俯视',
    snippet: '无人机航拍，正俯视角，对称构图，极致广度',
  },
  {
    id: 'photo-dolly',
    category: 'photography',
    title: '推轨镜头',
    snippet: '缓慢推轨镜头，Dolly in，主体居中，焦点收束',
    modes: ['video'],
  },
  {
    id: 'photo-pan',
    category: 'photography',
    title: '横摇运镜',
    snippet: '平滑横摇 pan，匀速扫过场景，保持地平线稳定',
    modes: ['video'],
  },
  {
    id: 'photo-handheld',
    category: 'photography',
    title: '手持跟拍',
    snippet: '手持跟拍，轻微晃动，第一视角代入感',
    modes: ['video'],
  },

  // ============ 插画 (10) ============
  {
    id: 'ill-ghibli',
    category: 'illustration',
    title: '吉卜力风',
    snippet: '吉卜力工作室风格，柔和水彩，温暖色调，梦幻治愈',
  },
  {
    id: 'ill-watercolor',
    category: 'illustration',
    title: '水彩画',
    snippet: '水彩手绘，湿画法晕染，留白，纸张肌理',
    modes: ['image'],
  },
  {
    id: 'ill-ink',
    category: 'illustration',
    title: '线稿墨线',
    snippet: '黑白线稿，极简墨线，留白构图，日式漫画风',
    modes: ['image'],
  },
  {
    id: 'ill-flat',
    category: 'illustration',
    title: '扁平插画',
    snippet: '扁平化插画，纯色色块，几何构成，轻量阴影',
    modes: ['image'],
  },
  {
    id: 'ill-cyberpunk',
    category: 'illustration',
    title: '赛博朋克',
    snippet: '赛博朋克，霓虹紫粉蓝，雨夜街道，全息广告',
  },
  {
    id: 'ill-pixel',
    category: 'illustration',
    title: '像素艺术',
    snippet: '16-bit 像素艺术，复古游戏风，调色板受限',
    modes: ['image'],
  },
  {
    id: 'ill-ukiyoe',
    category: 'illustration',
    title: '浮世绘',
    snippet: '日本浮世绘，木版画质感，平面化色彩，粗线条',
    modes: ['image'],
  },
  {
    id: 'ill-concept',
    category: 'illustration',
    title: '概念设定',
    snippet: '游戏概念原画，氛围感张力，宏大世界观',
  },
  {
    id: 'ill-narrative-open',
    category: 'illustration',
    title: '开篇氛围',
    snippet: '以第三人称开头，缓慢建立场景，强调氛围与感官细节',
    modes: ['text'],
  },
  {
    id: 'ill-narrative-twist',
    category: 'illustration',
    title: '反转结尾',
    snippet: '在结尾处给出一次意料之外但合情合理的反转',
    modes: ['text'],
  },

  // ============ 产品 (8) ============
  {
    id: 'prod-studio',
    category: 'product',
    title: '棚拍白底',
    snippet: '产品棚拍，纯白背景，均匀柔光，无阴影，电商主图',
    modes: ['image'],
  },
  {
    id: 'prod-gradient',
    category: 'product',
    title: '渐变背景',
    snippet: '柔和渐变背景，产品居中，高光反射，专业商业摄影',
    modes: ['image'],
  },
  {
    id: 'prod-scene',
    category: 'product',
    title: '生活场景',
    snippet: '产品融入真实生活场景，环境光，自然陈设',
  },
  {
    id: 'prod-tech',
    category: 'product',
    title: '数码科技',
    snippet: '深色背景，冷色霓虹轮廓光，金属反射，科技感',
    modes: ['image'],
  },
  {
    id: 'prod-minimal',
    category: 'product',
    title: '极简陈列',
    snippet: '极简主义排布，大量留白，单一主光，Muji 风格',
    modes: ['image'],
  },
  {
    id: 'prod-splash',
    category: 'product',
    title: '动态飞溅',
    snippet: '高速冻结瞬间，液体飞溅，水花围绕产品',
    modes: ['image'],
  },
  {
    id: 'prod-explode',
    category: 'product',
    title: '爆炸图解',
    snippet: '产品爆炸分解图，零件悬浮，工程示意风',
    modes: ['image'],
  },
  {
    id: 'prod-hero-video',
    category: 'product',
    title: '产品 Hero',
    snippet: '产品 360 度旋转展示，匀速转台，studio 灯光',
    modes: ['video'],
  },

  // ============ 国风 (8) ============
  {
    id: 'cn-ink',
    category: 'cnStyle',
    title: '水墨山水',
    snippet: '中国水墨画，留白意境，远山近水，墨分五色',
    modes: ['image'],
  },
  {
    id: 'cn-gongbi',
    category: 'cnStyle',
    title: '工笔重彩',
    snippet: '工笔重彩画，细腻线条，矿物颜料，宋代花鸟',
    modes: ['image'],
  },
  {
    id: 'cn-hanfu',
    category: 'cnStyle',
    title: '汉服人物',
    snippet: '传统汉服，飘逸衣袂，发髻金钗，东方古典人物',
  },
  {
    id: 'cn-dunhuang',
    category: 'cnStyle',
    title: '敦煌飞天',
    snippet: '敦煌壁画风格，飞天伎乐，矿物色，斑驳岁月感',
    modes: ['image'],
  },
  {
    id: 'cn-palace',
    category: 'cnStyle',
    title: '故宫红墙',
    snippet: '朱红宫墙琉璃瓦，斗拱飞檐，金色装饰，皇家气派',
  },
  {
    id: 'cn-guochao',
    category: 'cnStyle',
    title: '国潮插画',
    snippet: '国潮风格，祥云纹样，大红大金，现代与传统融合',
    modes: ['image'],
  },
  {
    id: 'cn-poetry',
    category: 'cnStyle',
    title: '古诗意境',
    snippet: '以五言或七言古诗意象作引，讲究对仗与留白',
    modes: ['text'],
  },
  {
    id: 'cn-wuxia',
    category: 'cnStyle',
    title: '武侠氛围',
    snippet: '武侠江湖氛围，快意恩仇，内敛克制的语言风格',
    modes: ['text'],
  },

  // ============ 3D (8) ============
  {
    id: '3d-octane',
    category: '3d',
    title: 'Octane 渲染',
    snippet: 'Octane 渲染，物理材质，全局光照，8K 超清细节',
    modes: ['image'],
  },
  {
    id: '3d-blender',
    category: '3d',
    title: 'Blender Cycles',
    snippet: 'Blender Cycles 渲染，光线追踪，真实反射与折射',
    modes: ['image'],
  },
  {
    id: '3d-isometric',
    category: '3d',
    title: '等距 3D',
    snippet: '等距轴测视角，3D 立体场景，低多边形风格，柔和配色',
    modes: ['image'],
  },
  {
    id: '3d-claymation',
    category: '3d',
    title: '黏土定格',
    snippet: '黏土定格动画风格，手工质感，温暖灯光，指纹纹理',
  },
  {
    id: '3d-pixar',
    category: '3d',
    title: '皮克斯',
    snippet: '皮克斯动画风格，圆润造型，饱和色调，表情生动',
  },
  {
    id: '3d-voxel',
    category: '3d',
    title: '体素方块',
    snippet: '体素艺术，方块构建，MagicaVoxel 风格，像素化立体',
    modes: ['image'],
  },
  {
    id: '3d-volumetric',
    category: '3d',
    title: '体积光',
    snippet: '强体积光束，丁达尔效应，尘埃粒子，影院级氛围',
  },
  {
    id: '3d-turntable',
    category: '3d',
    title: '转台环绕',
    snippet: '相机围绕主体 360 度匀速环绕，3D 转台展示',
    modes: ['video'],
  },

  // ============ 质感 (8) ============
  {
    id: 'tex-metal',
    category: 'texture',
    title: '金属拉丝',
    snippet: '金属拉丝表面，各向异性反射，冷色高光',
  },
  {
    id: 'tex-glass',
    category: 'texture',
    title: '磨砂玻璃',
    snippet: '磨砂玻璃质感，半透明，柔和漫反射，冰凉触感',
  },
  {
    id: 'tex-liquid',
    category: 'texture',
    title: '液态金属',
    snippet: '液态金属，流体扭曲反射，水银般表面',
  },
  {
    id: 'tex-velvet',
    category: 'texture',
    title: '丝绒质感',
    snippet: '丝绒天鹅绒，柔软反光，边缘光晕，高级暗调',
    modes: ['image'],
  },
  {
    id: 'tex-paper',
    category: 'texture',
    title: '纸张纹理',
    snippet: '粗糙手工纸纹理，纤维可见，轻微泛黄',
    modes: ['image'],
  },
  {
    id: 'tex-neon',
    category: 'texture',
    title: '霓虹光效',
    snippet: '霓虹管发光，粉紫蓝渐变，轻微辉光外溢',
  },
  {
    id: 'tex-holo',
    category: 'texture',
    title: '全息幻彩',
    snippet: '全息虹彩表面，随角度变色，Y2K 审美',
    modes: ['image'],
  },
  {
    id: 'tex-ink-bleed',
    category: 'texture',
    title: '墨晕纸感',
    snippet: '宣纸上的墨晕渗透，不规则边缘，东方手作气质',
    modes: ['image'],
  },
];

export function getCategoryLabel(id: PromptCategoryId): string {
  return PROMPT_CATEGORIES.find(c => c.id === id)?.label ?? id;
}
