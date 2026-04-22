import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Loader2,
  Palette,
  Target,
  Tag,
  ChevronDown,
  Camera,
  Sparkles,
  Languages,
  SlidersHorizontal,
  Layers,
  Upload,
  MoreHorizontal,
} from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { CanvasElement } from '../types/canvas';
import { v4 as uuidv4 } from 'uuid';

interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
  caption?: string;
}

type GenMode = 'image' | 'video' | 'text';

const MODELS: Record<GenMode, DropdownOption[]> = {
  image: [
    { value: 'gpt-image-2', label: 'Lib Nano Pro', caption: '默认图像模型' },
    { value: 'sd-xl', label: 'SD XL', caption: '写实风格' },
    { value: 'flux-pro', label: 'Flux Pro', caption: '高质量' },
  ],
  video: [
    { value: 'seedance-2', label: 'Seedance 2.0 VIP', caption: '文生视频' },
    { value: 'runway-gen3', label: 'Runway Gen-3', caption: '短视频' },
  ],
  text: [
    { value: 'gvlm-3.1', label: 'GVLM 3.1', caption: '通用文本' },
    { value: 'gpt-4o', label: 'GPT-4o', caption: '高阶推理' },
  ],
};

const ASPECT_OPTIONS: DropdownOption[] = [
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
];

const QUALITY_OPTIONS_IMAGE: DropdownOption[] = [
  { value: '512px', label: '512px' },
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
];

const QUALITY_OPTIONS_VIDEO: DropdownOption[] = [
  { value: '480P', label: '480P' },
  { value: '720P', label: '720P' },
  { value: '1080P', label: '1080P' },
];

const DURATION_OPTIONS: DropdownOption[] = [
  { value: '3s', label: '3s' },
  { value: '5s', label: '5s' },
  { value: '10s', label: '10s' },
];

const COUNT_OPTIONS: DropdownOption[] = [
  { value: '1', label: '1 张' },
  { value: '2', label: '2 张' },
  { value: '4', label: '4 张' },
];

const STYLE_PRESETS = [
  '赛博朋克',
  '吉卜力风格',
  '水彩画',
  '3D 渲染',
  '像素艺术',
  '极简线稿',
  '霓虹光效',
];

export interface NodeInputBarProps {
  element: CanvasElement;
  /** Top-left anchor in screen coords (already includes stage translate + scale). */
  x: number;
  y: number;
  /** Bar width in CANVAS units (pre-scale); rendered width = width * scale. */
  width: number;
  /** Canvas scale; applied via CSS transform so font/padding/radii scale together. */
  scale: number;
}

export function NodeInputBar({ element, x, y, width, scale }: NodeInputBarProps) {
  const { updateElement, deleteElements, addElement } = useCanvasStore();
  const { providers } = useSettingsStore();

  // Determine generation mode from element type
  const mode: GenMode = useMemo(() => {
    if (element.type === 'video') return 'video';
    if (element.type === 'text') return 'text';
    return 'image';
  }, [element.type]);

  const prompt = element.prompt ?? '';
  const gen = element.generation ?? {};
  const model = gen.model ?? MODELS[mode][0].value;
  const aspect = gen.aspect ?? '1:1';
  const quality = gen.quality ?? (mode === 'video' ? '720P' : '1K');
  const count = gen.count ?? '1';
  const duration = gen.duration ?? '5s';

  const [isGenerating, setIsGenerating] = useState(false);
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const stylePickerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!stylePickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (!stylePickerRef.current?.contains(e.target as Node)) setStylePickerOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [stylePickerOpen]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, [prompt]);

  const updatePrompt = (v: string) => updateElement(element.id, { prompt: v } as any);
  const updateGen = (patch: Partial<typeof gen>) =>
    updateElement(element.id, { generation: { ...gen, ...patch } } as any);

  const insertStyle = (style: string) => {
    const prefix = prompt.trim().length === 0 ? '' : prompt.trimEnd() + '，';
    updatePrompt(`${prefix}${style}风格`);
    setStylePickerOpen(false);
    textareaRef.current?.focus();
  };

  const insertTag = (tag: string) => {
    const sep = prompt.endsWith(' ') || prompt.length === 0 ? '' : ' ';
    updatePrompt(`${prompt}${sep}${tag} `);
    textareaRef.current?.focus();
  };

  const placeholder = useMemo(() => {
    if (mode === 'image') return '描述你想要生成的画面内容，按 / 呼出指令，@ 引用素材';
    if (mode === 'video') return '描述你想要生成的视频内容，@ 引用素材';
    return '写下你想讲的故事、场景或角色设定...';
  }, [mode]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    if (mode === 'video') {
      alert('视频生成即将上线，敬请期待。');
      return;
    }

    if (mode === 'text') {
      alert('文本生成即将上线。当前已将输入保存到该节点。');
      updateElement(element.id, { text: prompt } as any);
      return;
    }

    // Image generation
    const t8starConfig = providers['t8star'];
    if (!t8starConfig?.apiKey) {
      alert('请先在右上角【设置】中配置 API 密钥 (API Key)。');
      return;
    }

    setIsGenerating(true);
    let placeholderId: string | null = null;
    try {
      const [wRatio, hRatio] = aspect.split(':').map(Number);
      const qualityMap: Record<string, number> = { '512px': 384, '1K': 512, '2K': 640, '4K': 768 };
      const maxSide = qualityMap[quality] ?? 512;
      let w = maxSide;
      let h = maxSide;
      if (wRatio && hRatio) {
        if (wRatio > hRatio) h = maxSide * (hRatio / wRatio);
        else w = maxSide * (wRatio / hRatio);
      }

      // If the node has no image yet, fill it in-place. Otherwise, drop a new node to the right.
      const hasExistingImage =
        element.type === 'image' && typeof (element as any).src === 'string' && (element as any).src.length > 0;

      if (!hasExistingImage) {
        // Show skeleton on the same node
        updateElement(element.id, { width: w, height: h } as any);
      } else {
        placeholderId = uuidv4();
        addElement({
          id: placeholderId,
          type: 'aigenerating',
          x: element.x + element.width + 40,
          y: element.y,
          width: w,
          height: h,
        } as any);
      }

      const response = await fetch(`${t8starConfig.baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t8starConfig.apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt: prompt.trim(),
          size: `${Math.round(w)}x${Math.round(h)}`,
          n: Number(count),
        }),
      });
      if (!response.ok) throw new Error(`API error: ${response.statusText}`);

      const data = await response.json();
      let imageUrl = '';
      if (data?.data?.length > 0) {
        imageUrl =
          data.data[0].url ||
          (data.data[0].b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : '');
      }
      if (!imageUrl) throw new Error('No image data returned from API');

      if (placeholderId) {
        deleteElements([placeholderId]);
        placeholderId = null;
        addElement({
          id: uuidv4(),
          type: 'image',
          x: element.x + element.width + 40,
          y: element.y,
          width: w,
          height: h,
          src: imageUrl,
          prompt: prompt.trim(),
        } as any);
      } else {
        updateElement(element.id, {
          src: imageUrl,
          width: w,
          height: h,
        } as any);
      }
    } catch (err) {
      console.error('Failed to generate image', err);
      alert('生成图像失败，请重试。');
      if (placeholderId) deleteElements([placeholderId]);
    } finally {
      setIsGenerating(false);
    }
  };

  const qualityOpts = mode === 'video' ? QUALITY_OPTIONS_VIDEO : QUALITY_OPTIONS_IMAGE;
  const credits = 14;

  return (
    <div
      className="absolute z-10 pointer-events-auto shadow-[0_12px_40px_rgb(0,0,0,0.12)]"
      style={{
        left: x,
        top: y,
        width,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
      onMouseDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-purple-300/80 overflow-hidden">
        {/* Quick chip row (image/video) */}
        {mode !== 'text' && (
          <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
            <div className="relative" ref={stylePickerRef}>
              <QuickChip
                icon={<Palette className="w-3 h-3" />}
                label="风格"
                onClick={() => setStylePickerOpen(v => !v)}
                active={stylePickerOpen}
              />
              {stylePickerOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-40 bg-white border border-gray-200 rounded-xl shadow-lg p-1 z-20">
                  {STYLE_PRESETS.map(style => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => insertStyle(style)}
                      className="w-full text-left px-2.5 py-1.5 text-[12px] text-gray-700 hover:bg-gray-100 rounded-md"
                    >
                      {style}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <QuickChip
              icon={<Target className="w-3 h-3" />}
              label="聚焦"
              onClick={() => insertTag('[聚焦]')}
            />
            <QuickChip
              icon={<Tag className="w-3 h-3" />}
              label="标记"
              onClick={() => insertTag('@')}
            />
            {mode === 'video' && (
              <>
                <QuickChip
                  icon={<Camera className="w-3 h-3" />}
                  label="运镜"
                  onClick={() => insertTag('[运镜]')}
                />
                <QuickChip
                  icon={<Sparkles className="w-3 h-3" />}
                  label="角色库"
                  onClick={() => insertTag('@角色:')}
                />
              </>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => alert('图生图功能开发中')}
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 hover:bg-gray-100 px-2 py-1 rounded-md transition-colors"
              title="上传参考"
            >
              <Upload className="w-3 h-3" />
              上传
            </button>
          </div>
        )}

        {/* Textarea */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-3 pt-2 pb-2">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={e => updatePrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
                e.stopPropagation();
              }}
              placeholder={placeholder}
              disabled={isGenerating}
              rows={1}
              autoFocus
              className="w-full resize-none bg-transparent text-[12.5px] leading-5 text-gray-800 placeholder-gray-400 focus:outline-none"
              style={{ minHeight: '48px' }}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-t border-gray-100/80 bg-gray-50/60 min-w-0">
            <div className="flex items-center gap-0.5 flex-1 min-w-0">
              <Dropdown
                options={MODELS[mode]}
                value={model}
                onChange={v => updateGen({ model: v })}
                disabled={isGenerating}
                icon={<Layers className="w-3 h-3 text-purple-500 shrink-0" />}
                maxLabelWidth={90}
              />
              {mode === 'image' && (
                <>
                  <ToolbarDivider />
                  <Dropdown options={ASPECT_OPTIONS} value={aspect} onChange={v => updateGen({ aspect: v })} disabled={isGenerating} />
                  <Dropdown options={qualityOpts} value={quality} onChange={v => updateGen({ quality: v })} disabled={isGenerating} />
                </>
              )}
              {mode === 'video' && (
                <>
                  <ToolbarDivider />
                  <Dropdown options={ASPECT_OPTIONS} value={aspect} onChange={v => updateGen({ aspect: v })} disabled={isGenerating} />
                  <Dropdown options={qualityOpts} value={quality} onChange={v => updateGen({ quality: v })} disabled={isGenerating} />
                  <Dropdown options={DURATION_OPTIONS} value={duration} onChange={v => updateGen({ duration: v })} disabled={isGenerating} />
                </>
              )}
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <MoreMenu
                disabled={isGenerating}
                items={[
                  {
                    icon: <Languages className="w-3.5 h-3.5" />,
                    label: '多语言',
                    onClick: () => alert('多语言支持开发中'),
                  },
                  ...(mode !== 'text'
                    ? [
                        {
                          icon: <SlidersHorizontal className="w-3.5 h-3.5" />,
                          label: '高级参数',
                          onClick: () => alert('高级参数开发中'),
                        },
                      ]
                    : []),
                ]}
              />
              {mode !== 'text' && (
                <Dropdown options={COUNT_OPTIONS} value={count} onChange={v => updateGen({ count: v })} disabled={isGenerating} />
              )}
              <div
                className="flex items-center gap-1 px-1.5 py-1 text-[11px] text-amber-600 rounded-md bg-amber-50/70"
                title="剩余积分"
              >
                <span className="text-amber-500">⚡</span>
                <span className="font-mono font-semibold">{credits}</span>
              </div>
              <button
                type="submit"
                disabled={isGenerating || !prompt.trim()}
                className="ml-1 flex items-center justify-center w-7 h-7 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
                title="生成 (Enter)"
              >
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUp className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuickChip({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-full border transition-colors ${
        active
          ? 'bg-purple-50 text-purple-700 border-purple-200'
          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Dropdown({
  options,
  value,
  onChange,
  disabled,
  icon,
  maxLabelWidth,
}: {
  options: DropdownOption[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  /** If set, the current value label is truncated to this px width with a tooltip. */
  maxLabelWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find(o => o.value === value) ?? options[0];
  const label = current?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className={`relative ${maxLabelWidth ? 'min-w-0' : ''}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        title={maxLabelWidth ? label : undefined}
        className={`flex items-center gap-1 px-1.5 py-1 text-[11px] font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          maxLabelWidth ? 'min-w-0' : 'whitespace-nowrap'
        } ${
          open ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        {icon}
        <span
          className={maxLabelWidth ? 'truncate' : 'whitespace-nowrap'}
          style={maxLabelWidth ? { maxWidth: maxLabelWidth } : undefined}
        >
          {label}
        </span>
        <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-0 min-w-[150px] bg-white border border-gray-200 rounded-xl shadow-lg p-1 z-30">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 text-[12px] rounded-md transition-colors flex items-center justify-between ${
                opt.value === value ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{opt.label}</span>
              {opt.caption && <span className="text-[10px] text-gray-400 ml-2">{opt.caption}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface MoreMenuItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function MoreMenu({ items, disabled }: { items: MoreMenuItem[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        title="更多"
        className={`p-1 rounded-md transition-colors disabled:opacity-40 ${
          open ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
        }`}
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 right-0 min-w-[140px] bg-white border border-gray-200 rounded-xl shadow-lg p-1 z-30">
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
            >
              <span className="text-gray-500">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolbarDivider() {
  return <div className="w-[1px] h-4 bg-gray-200 mx-0.5 shrink-0" />;
}
