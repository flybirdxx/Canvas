import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Loader2,
  BookMarked,
  Target,
  Tag,
  Camera,
  Sparkles,
  Languages,
  SlidersHorizontal,
  Layers,
  Upload,
  X,
  Link2,
  Brush,
  CheckCircle2,
} from 'lucide-react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { usePromptLibraryStore } from '@/store/usePromptLibraryStore';
import { useAssetLibraryStore } from '@/store/useAssetLibraryStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import type { CanvasElement, AppliedPreset } from '@/types/canvas';
import { PromptPreset } from '@/data/promptLibrary';
import { PromptLibraryPanel } from './PromptLibraryPanel';
import { runGeneration } from '@/services/imageGeneration';
import { runVideoGeneration } from '@/services/videoGeneration';
import { runTextGeneration } from '@/services/textGeneration';
import { findModel, computeUnitPrice } from '@/services/gateway';
import { submitVideo } from './input-bar/submitVideo';
import { submitImage } from './input-bar/submitImage';
import {
  getUpstreamTextContributions,
  getUpstreamImageContributions,
  composeEffectivePrompt,
  UpstreamTextContribution,
  UpstreamImageContribution,
} from '@/utils/flowResolver';
import { QuickChip } from './ui/QuickChip';
import { ThumbChip } from './ui/ThumbChip';
import { Dropdown } from './ui/Dropdown';
import { MoreMenu } from './ui/MoreMenu';
import { ToolbarDivider } from './ui/ToolbarDivider';
import {
  type DropdownOption,
  type GenMode,
  buildModelOptions,
  ASPECT_OPTIONS,
  QUALITY_OPTIONS_IMAGE,
  QUALITY_OPTIONS_VIDEO,
  DURATION_OPTIONS,
  COUNT_OPTIONS,
  removeSnippetFromPrompt,
} from './input-bar/utils';

export interface NodeInputBarProps {
  element: CanvasElement;
  x: number;
  y: number;
  width: number;
  scale: number;
}

export function NodeInputBar({ element, x, y, width, scale }: NodeInputBarProps) {
  const { updateElement, addElement, replaceElement } = useCanvasStore();
  const deleteConnections = useCanvasStore(s => s.deleteConnections);
  const elementsAll = useCanvasStore(s => s.elements);
  const connectionsAll = useCanvasStore(s => s.connections);
  const inpaintMask = useCanvasStore(s => s.inpaintMask);
  const setInpaintMask = useCanvasStore(s => s.setInpaintMask);
  const { pushRecent, findPreset } = usePromptLibraryStore();

  const mode: GenMode = useMemo(() => {
    if (element.type === 'video' || element.type === 'audio') return 'video';
    if (element.type === 'text') return 'text';
    return 'image';
  }, [element.type]);

  const providerConfigs = useSettingsStore(s => s.providers);
  const modelOptions = useMemo(
    () => buildModelOptions(mode, providerConfigs),
    [mode, providerConfigs],
  );

  const prompt = element.prompt ?? '';
  const gen = useMemo(() => element.generation ?? {}, [element.generation]);
  const model = gen.model ?? modelOptions[0]?.value ?? '';
  const aspect = gen.aspect ?? '1:1';
  const quality = gen.quality ?? (mode === 'video' ? '720P' : '1K');
  const qualityLevel = gen.qualityLevel ?? 'medium';
  const count = gen.count ?? '1';
  const duration = gen.duration ?? '5s';
  const appliedPresets = useMemo<AppliedPreset[]>(
    () => gen.appliedPresets ?? [],
    [gen.appliedPresets],
  );
  const appliedIds = useMemo(() => appliedPresets.map(p => p.id), [appliedPresets]);
  const references: string[] = gen.references ?? [];
  const MAX_REFERENCES = 4;

  const upstream: UpstreamTextContribution[] = useMemo(
    () => getUpstreamTextContributions(element.id, elementsAll, connectionsAll),
    [element.id, elementsAll, connectionsAll],
  );
  const effectivePrompt = useMemo(
    () => composeEffectivePrompt(prompt, upstream),
    [prompt, upstream],
  );
  const upstreamImages: UpstreamImageContribution[] = useMemo(
    () => getUpstreamImageContributions(element.id, elementsAll, connectionsAll),
    [element.id, elementsAll, connectionsAll],
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasImageSrc =
    element.type === 'image' &&
    (element.src ?? '').length > 0;
  const isInpaintMode =
    mode === 'image' &&
    hasImageSrc &&
    inpaintMask !== null &&
    inpaintMask.elementId === element.id;
  const inpaintRect =
    isInpaintMode && inpaintMask ? inpaintMask.rect : null;
  const isPlanningDraftPending = element.planningDraft?.status === 'pendingReview';

  useEffect(() => {
    if (!inpaintMask) return;
    if (inpaintMask.elementId !== element.id) return;
    if (mode !== 'image' || !hasImageSrc) {
      setInpaintMask(null);
    }
  }, [element.id, mode, hasImageSrc, inpaintMask, setInpaintMask]);

  const toggleInpaintMode = () => {
    if (!hasImageSrc || mode !== 'image') return;
    if (isInpaintMode) {
      setInpaintMask(null);
      return;
    }
    setInpaintMask({ elementId: element.id, rect: null });
  };

  const clearInpaintRect = () => {
    if (!isInpaintMode) return;
    setInpaintMask({ elementId: element.id, rect: null });
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, [prompt]);

  const updatePrompt = (v: string) => updateElement(element.id, { prompt: v });
  const updateGen = useCallback((patch: Partial<typeof gen>) => {
    updateElement(element.id, { generation: { ...gen, ...patch } });
  }, [element.id, gen, updateElement]);
  const approvePlanningDraft = useCallback(() => {
    if (!element.planningDraft) return;
    updateElement(
      element.id,
      { planningDraft: { ...element.planningDraft, status: 'approved' } },
      '确认规划执行节点',
    );
  }, [element.id, element.planningDraft, updateElement]);

  const applyPreset = (preset: PromptPreset) => {
    if (appliedIds.includes(preset.id)) return;
    const nextPrompt =
      prompt.trim().length === 0
        ? preset.snippet
        : `${prompt.trimEnd()}，${preset.snippet}`;
    updateElement(element.id, {
      prompt: nextPrompt,
      generation: {
        ...gen,
        appliedPresets: [...appliedPresets, { id: preset.id, snippet: preset.snippet }],
      },
    });
    pushRecent(preset.id);
    textareaRef.current?.focus();
  };

  const removePreset = (id: string) => {
    const target = appliedPresets.find(p => p.id === id);
    if (!target) return;
    const nextPrompt = removeSnippetFromPrompt(prompt, target.snippet);
    updateElement(element.id, {
      prompt: nextPrompt,
      generation: {
        ...gen,
        appliedPresets: appliedPresets.filter(p => p.id !== id),
      },
    });
  };

  const addReferences = (urls: string[]) => {
    if (urls.length === 0) return;
    const next = [...references, ...urls].slice(0, MAX_REFERENCES);
    updateGen({ references: next });
  };

  const removeReference = (index: number) => {
    const next = references.filter((_, i) => i !== index);
    updateGen({ references: next });
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOverRef, setIsDragOverRef] = useState(false);

  const handleRefFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const slots = Math.max(0, MAX_REFERENCES - references.length);
    const picks = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, slots);
    const urls: string[] = [];
    for (const f of picks) {
      const url = await new Promise<string | null>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => resolve(null);
        r.readAsDataURL(f);
      });
      if (url) urls.push(url);
    }
    addReferences(urls);
  };

  const handleRefDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverRef(false);
    if (mode !== 'image') return;
    const assetId = e.dataTransfer.getData('application/x-canvas-asset');
    if (assetId) {
      const asset = useAssetLibraryStore.getState().findAsset(assetId);
      if (asset && asset.kind === 'image') {
        addReferences([asset.src]);
      }
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleRefFiles(e.dataTransfer.files);
    }
  };

  const insertTag = (tag: string) => {
    const sep = prompt.endsWith(' ') || prompt.length === 0 ? '' : ' ';
    updatePrompt(`${prompt}${sep}${tag} `);
    textareaRef.current?.focus();
  };

  const placeholder = useMemo(() => {
    if (isInpaintMode) {
      return inpaintRect
        ? '描述要在选区内填充的内容（例如：把这块改成樱花丛）'
        : '先在图上框选要重绘的区域，再描述新内容';
    }
    if (mode === 'image') return '描述你想要生成的画面内容，按 / 呼出指令，@ 引用素材';
    if (mode === 'video') return '描述你想要生成的视频内容，@ 引用素材';
    return '写下你想讲的故事、场景或角色设定...';
  }, [mode, isInpaintMode, inpaintRect]);

  // ── Submit: delegates to extracted handlers ─────────────────────────
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isGenerating) return;
    if (isPlanningDraftPending) return;
    if (!effectivePrompt.trim()) return;

    if (mode === 'video') {
      await submitVideo({
        element, prompt, effectivePrompt, aspect, quality, duration, model,
        upstreamImages, replaceElement, setIsGenerating, runVideoGeneration,
      });
      return;
    }

    if (mode === 'text') {
      setIsGenerating(true);
      runTextGeneration({
        elementId: element.id,
        prompt: effectivePrompt,
        model,
        setIsGenerating: (v) => setIsGenerating(v),
      });
      return;
    }

    // Image mode — includes standard generation and inpainting
    await submitImage({
      element, prompt, effectivePrompt, aspect, quality, qualityLevel,
      qualityLevelOpts, count, model, references, upstreamImages,
      isInpaintMode, inpaintRect, setInpaintMask,
      replaceElement, addElement, setIsGenerating, runGeneration,
    });
  };

  // ── Model-dependent dropdown options ────────────────────────────────
  const selectedModelDesc = useMemo(
    () => (mode !== 'text' ? findModel(model)?.model : undefined),
    [mode, model],
  );
  const aspectOpts = useMemo(() => {
    const supported = selectedModelDesc?.supportedAspects;
    if (!supported || supported.length === 0) return ASPECT_OPTIONS;
    const known = ASPECT_OPTIONS.filter(o => supported.includes(o.value));
    const extras = supported
      .filter(v => !ASPECT_OPTIONS.some(o => o.value === v))
      .map(v => ({ value: v, label: v }));
    return [...known, ...extras];
  }, [selectedModelDesc]);

  const imageResolutionOpts = useMemo<DropdownOption[]>(() => {
    const supported = selectedModelDesc?.supportedResolutions;
    if (!supported || supported.length === 0) return QUALITY_OPTIONS_IMAGE;
    const known = QUALITY_OPTIONS_IMAGE.filter(o => supported.includes(o.value));
    const extras = supported
      .filter(v => !QUALITY_OPTIONS_IMAGE.some(o => o.value === v))
      .map(v => ({ value: v, label: v }));
    return [...known, ...extras];
  }, [selectedModelDesc]);

  const qualityLevelOpts = useMemo<DropdownOption[] | null>(() => {
    const supported = selectedModelDesc?.supportedQualityLevels;
    if (!supported || supported.length === 0) return null;
    return supported.map(v => ({ value: v, label: v }));
  }, [selectedModelDesc]);

  useEffect(() => {
    if (mode === 'text') return;
    if (aspectOpts.length > 0 && !aspectOpts.some(o => o.value === aspect)) {
      updateGen({ aspect: aspectOpts[0].value });
    }
  }, [aspectOpts, aspect, mode, updateGen]);
  useEffect(() => {
    if (mode !== 'image') return;
    if (imageResolutionOpts.length > 0 && !imageResolutionOpts.some(o => o.value === quality)) {
      updateGen({ quality: imageResolutionOpts[0].value });
    }
  }, [imageResolutionOpts, quality, mode, updateGen]);
  useEffect(() => {
    if (mode !== 'image') return;
    if (!qualityLevelOpts) return;
    if (!qualityLevelOpts.some(o => o.value === qualityLevel)) {
      updateGen({ qualityLevel: qualityLevelOpts[0].value });
    }
  }, [qualityLevelOpts, qualityLevel, mode, updateGen]);

  const showResolutionDropdown =
    mode === 'video' ||
    !!selectedModelDesc?.supportedResolutions?.length ||
    selectedModelDesc?.supportsSize !== false;
  const qualityOpts = mode === 'video' ? QUALITY_OPTIONS_VIDEO : imageResolutionOpts;

  const unitPrice = useMemo(() => {
    if (!selectedModelDesc) return undefined;
    if (mode !== 'image') return undefined;
    return computeUnitPrice(selectedModelDesc, { resolution: quality, qualityLevel });
  }, [selectedModelDesc, mode, quality, qualityLevel]);
  const nNum = Math.max(1, Number(count) || 1);
  const totalPrice = unitPrice ? unitPrice.amount * nNum : undefined;

  const costEstimate = useMemo(() => {
    const modelId = element.generation?.model;
    if (!modelId) return undefined;
    const found = findModel(modelId);
    if (!found) return undefined;
    const cnt = parseInt(String(element.generation?.count || '1'), 10) || 1;
    const unit = computeUnitPrice(found.model, {
      resolution: element.generation?.quality,
      qualityLevel: element.generation?.qualityLevel,
    });
    if (!unit) return undefined;
    return { unit, total: { amount: unit.amount * cnt, currency: unit.currency }, count: cnt };
  }, [element.generation?.model, element.generation?.quality, element.generation?.qualityLevel, element.generation?.count]);
  const submitDisabled =
    isGenerating ||
    !effectivePrompt.trim() ||
    (isInpaintMode && !inpaintRect) ||
    isPlanningDraftPending;

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div
      className="absolute z-10 pointer-events-auto"
      style={{
        left: x, top: y, width,
        transform: `scale(${scale})`, transformOrigin: 'top left', filter: 'none',
      }}
      onMouseDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      <div
        className="overflow-visible transition-colors"
        style={{
          background: 'var(--bg-2)', border: 'none', borderRadius: '16px',
          boxShadow: 'var(--shadow-ink-1)',
        }}
        onDragOver={(e) => {
          if (mode !== 'image') return;
          if (references.length >= MAX_REFERENCES) return;
          const types = Array.from(e.dataTransfer.types);
          if (types.includes('application/x-canvas-asset') || types.includes('Files')) {
            e.preventDefault(); e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            if (!isDragOverRef) setIsDragOverRef(true);
          }
        }}
        onDragLeave={() => { if (isDragOverRef) setIsDragOverRef(false); }}
        onDrop={handleRefDrop}
      >
        <div style={{ maxHeight: expanded ? '600px' : '0', overflow: 'hidden', transition: 'max-height 300ms ease' }}>
        <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
          <div className="relative">
            <QuickChip icon={<BookMarked className="w-3 h-3" />} label="提示词库"
              onClick={() => setLibraryOpen(v => !v)} active={libraryOpen} />
            {libraryOpen && (
              <PromptLibraryPanel mode={mode} appliedIds={appliedIds} currentPrompt={prompt}
                onApply={applyPreset} onDismiss={() => setLibraryOpen(false)} />
            )}
          </div>
          {mode !== 'text' && (
            <>
              <QuickChip icon={<Target className="w-3 h-3" />} label="聚焦" onClick={() => insertTag('[聚焦]')} />
              <QuickChip icon={<Tag className="w-3 h-3" />} label="标记" onClick={() => insertTag('@')} />
              {mode === 'video' && (
                <>
                  <QuickChip icon={<Camera className="w-3 h-3" />} label="运镜" onClick={() => insertTag('[运镜]')} />
                  <QuickChip icon={<Sparkles className="w-3 h-3" />} label="角色库" onClick={() => insertTag('@角色:')} />
                </>
              )}
              {mode === 'image' && (
                <QuickChip icon={<Brush className="w-3 h-3" />} label="局部重绘"
                  onClick={toggleInpaintMode} active={isInpaintMode}
                  disabled={!hasImageSrc || isGenerating}
                  title={!hasImageSrc ? '需要先有生成图像才能局部重绘'
                    : isInpaintMode ? '退出局部重绘（保留整图）' : '开启局部重绘（框选区域 + 提示词）'} />
              )}
              <div className="flex-1" />
              {mode === 'image' && (
                <>
                  <button type="button" disabled={references.length >= MAX_REFERENCES || isGenerating}
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-ghost shrink-0 whitespace-nowrap"
                    style={{ padding: '4px 9px', fontSize: 11.5 }}
                    title={references.length >= MAX_REFERENCES ? `最多 ${MAX_REFERENCES} 张参考图` : '添加参考图（图生图）'}>
                    <Upload className="w-3 h-3" />参考图{references.length > 0 ? ` · ${references.length}` : ''}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple hidden
                    onChange={(e) => { handleRefFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ''; }} />
                </>
              )}
            </>
          )}
        </div>
        {isPlanningDraftPending && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pt-1 pb-1">
            <span className="chip-meta chip-meta--accent">
              来自规划 · 待确认
            </span>
            <QuickChip
              icon={<CheckCircle2 className="w-3 h-3" />}
              label="确认可执行"
              onClick={approvePlanningDraft}
              disabled={isGenerating}
              title="确认规划执行节点"
            />
          </div>
        )}
        {upstream.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 px-3 pt-1 pb-1">
            <span className="chip-meta chip-meta--signal"><Link2 className="w-2.5 h-2.5" strokeWidth={1.6} />连线输入 {upstream.length}</span>
            {upstream.map((u) => (
              <span key={u.connectionId} className="inline-flex items-center gap-1"
                style={{ paddingLeft: 8, paddingRight: 2, paddingTop: 2, paddingBottom: 2, borderRadius: 'var(--r-pill)',
                  background: 'var(--bg-1)', color: 'var(--signal)',
                  border: '1px solid color-mix(in oklch, var(--signal) 25%, transparent)', fontSize: 10.5 }}
                title={u.content.length > 200 ? u.content.slice(0, 200) + '…' : u.content}>
                <span className="truncate" style={{ maxWidth: 140 }}>{u.label}</span>
                <button type="button" onClick={() => deleteConnections([u.connectionId])} className="transition-colors"
                  style={{ padding: 2, borderRadius: '50%', color: 'var(--signal)', background: 'transparent', cursor: 'pointer', border: 'none' }}
                  title="断开此连线">
                  <X className="w-2.5 h-2.5" strokeWidth={1.8} />
                </button>
              </span>
            ))}
          </div>
        )}
        {mode === 'image' && upstreamImages.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pt-1 pb-1">
            <span className="chip-meta chip-meta--accent"><Link2 className="w-2.5 h-2.5" strokeWidth={1.6} />连线参考 {upstreamImages.length}</span>
            {upstreamImages.map((u, idx) => {
              const willBeSent = idx < MAX_REFERENCES && !references.includes(u.src);
              return (
                <ThumbChip key={u.connectionId} src={u.src} alt={u.label}
                  tone={willBeSent ? 'accent' : 'muted'} badge={!willBeSent ? '忽略' : undefined}
                  title={willBeSent ? `参考图（来自连线）· ${u.label}` : `${u.label}（超出上限或与已上传重复，不会发送）`}
                  onRemove={() => deleteConnections([u.connectionId])} />
              );
            })}
          </div>
        )}
        {mode === 'video' && upstreamImages.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pt-1 pb-1">
            <span className="chip-meta chip-meta--accent"><Link2 className="w-2.5 h-2.5" strokeWidth={1.6} />seed 帧 {upstreamImages.length}</span>
            {upstreamImages.map((u, idx) => (
              <ThumbChip key={u.connectionId} src={u.src} alt={u.label}
                tone={idx === 0 ? 'accent' : 'muted'} badge={idx > 0 ? '备用' : undefined}
                title={idx === 0 ? `seed 帧 · ${u.label}` : `${u.label}（多张时仅首张参与生成，可 X 断开）`}
                onRemove={() => deleteConnections([u.connectionId])} />
            ))}
          </div>
        )}
        {mode === 'image' && references.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pt-1 pb-1">
            {references.map((url, idx) => (
              <ThumbChip key={`${idx}-${url.slice(0, 16)}`} src={url} alt={`ref-${idx}`} tone="accent"
                title={`参考图 ${idx + 1}`} onRemove={() => removeReference(idx)} />
            ))}
            <span className="mono" style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 4 }}>图生图 · {references.length}/{MAX_REFERENCES}</span>
          </div>
        )}
        {isInpaintMode && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pt-1 pb-1">
            <span className="chip-meta chip-meta--accent"><Brush className="w-2.5 h-2.5" strokeWidth={1.6} />局部重绘 · gpt-image-2</span>
            {inpaintRect ? (
              <span className="inline-flex items-center gap-1"
                style={{ paddingLeft: 8, paddingRight: 2, paddingTop: 2, paddingBottom: 2, borderRadius: 'var(--r-pill)',
                  background: 'var(--bg-1)', color: 'var(--accent)',
                  border: '1px solid color-mix(in oklch, var(--accent) 25%, transparent)', fontSize: 10.5 }}>
                选区 {Math.round(inpaintRect.w * inpaintRect.h * 100)}%
                <button type="button" onClick={clearInpaintRect}
                  style={{ padding: 2, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--accent)', cursor: 'pointer' }}
                  title="清除选区，重新框选"><X className="w-2.5 h-2.5" strokeWidth={1.8} /></button>
              </span>
            ) : (
              <span className="serif-it" style={{ fontSize: 10.5, color: 'var(--accent)' }}>在图上拖拽框选要重绘的区域</span>
            )}
          </div>
        )}
        {appliedPresets.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 px-3 pt-1 pb-1">
            {appliedPresets.map(ap => {
              const preset = findPreset(ap.id);
              const label = preset?.title ?? ap.snippet.slice(0, 8);
              return (
                <span key={ap.id} className="inline-flex items-center gap-1"
                  style={{ paddingLeft: 8, paddingRight: 2, paddingTop: 2, paddingBottom: 2, borderRadius: 'var(--r-pill)',
                    background: 'var(--accent-soft)', color: 'var(--accent)',
                    border: '1px solid color-mix(in oklch, var(--accent) 20%, transparent)', fontSize: 10.5 }}
                  title={ap.snippet}>
                  <span className="truncate" style={{ maxWidth: 120 }}>{label}</span>
                  <button type="button" onClick={() => removePreset(ap.id)}
                    style={{ padding: 2, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--accent)', cursor: 'pointer' }}
                    title="移除该预设"><X className="w-2.5 h-2.5" strokeWidth={1.8} /></button>
                </span>
              );
            })}
          </div>
        )}
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-3 pt-2 pb-2">
            <textarea ref={textareaRef} value={prompt} onChange={e => updatePrompt(e.target.value)}
              onFocus={() => setExpanded(true)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } e.stopPropagation(); }}
              placeholder={placeholder} disabled={isGenerating} rows={1} autoFocus
              className="w-full resize-none bg-transparent focus:outline-none"
              style={{ minHeight: 52, fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.55, color: 'var(--ink-0)' }} />
          </div>
          <div className="flex items-center gap-1 min-w-0 hairline-t"
            style={{ padding: '5px 8px', background: 'var(--bg-2)', borderBottomLeftRadius: '0', borderBottomRightRadius: '0' }}>
            <div className="flex items-center gap-0.5 flex-1 min-w-0">
              <Dropdown options={modelOptions} value={model} onChange={v => updateGen({ model: v })}
                disabled={isGenerating || isInpaintMode}
                icon={<Layers className="w-3 h-3 shrink-0" style={{ color: 'var(--accent)' }} />} maxLabelWidth={120} />
              {mode === 'image' && !isInpaintMode && (
                <>
                  <ToolbarDivider />
                  <Dropdown options={aspectOpts} value={aspect} onChange={v => updateGen({ aspect: v })} disabled={isGenerating} />
                  {showResolutionDropdown && (
                    <Dropdown options={qualityOpts} value={quality} onChange={v => updateGen({ quality: v })} disabled={isGenerating} />
                  )}
                  {qualityLevelOpts && (
                    <Dropdown options={qualityLevelOpts} value={qualityLevel} onChange={v => updateGen({ qualityLevel: v })} disabled={isGenerating} />
                  )}
                </>
              )}
              {mode === 'video' && (
                <>
                  <ToolbarDivider />
                  <Dropdown options={aspectOpts} value={aspect} onChange={v => updateGen({ aspect: v })} disabled={isGenerating} />
                  <Dropdown options={qualityOpts} value={quality} onChange={v => updateGen({ quality: v })} disabled={isGenerating} />
                  <Dropdown options={DURATION_OPTIONS} value={duration} onChange={v => updateGen({ duration: v })} disabled={isGenerating} />
                </>
              )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <MoreMenu disabled={isGenerating} items={[
                { icon: <Languages className="w-3.5 h-3.5" />, label: '多语言', onClick: () => alert('多语言支持开发中') },
                ...(mode !== 'text' ? [{ icon: <SlidersHorizontal className="w-3.5 h-3.5" />, label: '高级参数', onClick: () => alert('高级参数开发中') }] : []),
              ]} />
              {mode !== 'text' && !isInpaintMode && (
                <Dropdown options={COUNT_OPTIONS} value={count} onChange={v => updateGen({ count: v })} disabled={isGenerating} />
              )}
              <div className="flex items-center gap-1 mono"
                style={{ padding: '4px 8px', fontSize: 11.5, color: 'var(--warning)',
                  background: 'color-mix(in oklch, var(--warning) 14%, transparent)',
                  border: '1px solid color-mix(in oklch, var(--warning) 22%, transparent)', borderRadius: 'var(--r-sm)' }}
                title={unitPrice ? `本次预估：${unitPrice.currency}${unitPrice.amount.toFixed(2)}/张 × ${nNum} = ${unitPrice.currency}${(unitPrice.amount * nNum).toFixed(2)}` : '该模型未提供价格信息'}>
                <span style={{ fontWeight: 600 }}>{totalPrice !== undefined && unitPrice ? `${unitPrice.currency}${totalPrice.toFixed(2)}` : '—'}</span>
              </div>
              {costEstimate && (
                <span className="chip-meta mono" style={{ fontSize: 9.5, padding: '2px 6px', background: 'var(--bg-3)', color: 'var(--ink-2)', borderRadius: 'var(--r-sm)', whiteSpace: 'nowrap' }}
                  title={`单价 ${costEstimate.unit.currency}${costEstimate.unit.amount.toFixed(2)} × ${costEstimate.count} 张`}>
                  约 {costEstimate.total.currency}{costEstimate.total.amount.toFixed(2)}
                </span>
              )}
              <button type="submit"
                aria-label="生成"
                disabled={submitDisabled}
                className="ml-1 flex items-center justify-center transition-colors"
                style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)',
                  background: submitDisabled ? 'var(--bg-3)' : 'var(--accent)',
                  color: submitDisabled ? 'var(--ink-3)' : 'var(--accent-fg)',
                  boxShadow: submitDisabled ? 'none' : 'var(--shadow-ink-1)',
                  border: 'none',
                  cursor: submitDisabled ? 'not-allowed' : 'pointer' }}
                title={(() => {
                  if (isPlanningDraftPending) return '请先确认规划执行节点';
                  if (isInpaintMode) {
                    if (!inpaintRect) return '请先在图上框选要重绘的区域';
                    return `局部重绘 (Enter) · 选区 ${Math.round(inpaintRect.w * inpaintRect.h * 100)}%`;
                  }
                  const hints: string[] = [];
                  if (upstream.length > 0) hints.push(`已合并 ${upstream.length} 个上游连线`);
                  if (mode === 'video' && upstreamImages.length > 0)
                    hints.push(`seed 帧来自上游${upstreamImages.length > 1 ? `（共 ${upstreamImages.length}，取第 1 张）` : ''}`);
                  if (mode === 'image' && upstreamImages.length > 0) {
                    const effective = upstreamImages.filter(u => !references.includes(u.src)).slice(0, MAX_REFERENCES).length;
                    if (effective > 0) hints.push(`连线参考图 ${effective} 张`);
                  }
                  return hints.length > 0 ? `生成 (Enter) · ${hints.join(' · ')}` : '生成 (Enter)';
                })()}>
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUp className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
