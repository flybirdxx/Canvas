import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Star, Plus, Check, Clock, Sparkles, X, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import {
  BUILTIN_PRESETS,
  PROMPT_CATEGORIES,
  PromptCategoryId,
  PromptMode,
  PromptPreset,
} from '../data/promptLibrary';
import { usePromptLibraryStore } from '../store/usePromptLibraryStore';

type TabId = 'all' | 'favorites' | 'recent' | 'custom' | PromptCategoryId;

interface Tab {
  id: TabId;
  label: string;
  icon?: React.ReactNode;
}

const LEFT_TABS: Tab[] = [
  { id: 'all', label: '全部', icon: <Sparkles className="w-3 h-3" strokeWidth={1.6} /> },
  { id: 'favorites', label: '收藏', icon: <Star className="w-3 h-3" strokeWidth={1.6} /> },
  { id: 'recent', label: '最近', icon: <Clock className="w-3 h-3" strokeWidth={1.6} /> },
  ...PROMPT_CATEGORIES.map<Tab>(c => ({ id: c.id, label: c.label })),
  { id: 'custom', label: '我的' },
];

export interface PromptLibraryPanelProps {
  mode: PromptMode;
  appliedIds: string[];
  currentPrompt: string;
  onApply: (preset: PromptPreset) => void;
  onDismiss: () => void;
}

export function PromptLibraryPanel({
  mode,
  appliedIds,
  currentPrompt,
  onApply,
  onDismiss,
}: PromptLibraryPanelProps) {
  const { favorites, customPresets, recent, toggleFavorite, addCustom, removeCustom } =
    usePromptLibraryStore();

  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [query, setQuery] = useState('');
  const [savingOpen, setSavingOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveCategory, setSaveCategory] = useState<PromptCategoryId>('illustration');

  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onDismiss();
      } else if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onDismiss]);

  const allPresets = useMemo(
    () => [...BUILTIN_PRESETS, ...customPresets],
    [customPresets],
  );

  const filtered = useMemo(() => {
    let list = allPresets;

    if (activeTab === 'favorites') {
      list = list.filter(p => favorites.includes(p.id));
    } else if (activeTab === 'recent') {
      const ordered = recent
        .map(id => list.find(p => p.id === id))
        .filter((p): p is PromptPreset => !!p);
      list = ordered;
    } else if (activeTab === 'custom') {
      list = list.filter(p => p.isCustom);
    } else if (activeTab !== 'all') {
      list = list.filter(p => p.category === activeTab);
    }

    list = list.filter(p => !p.modes || p.modes.includes(mode));

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        p =>
          p.title.toLowerCase().includes(q) ||
          p.snippet.toLowerCase().includes(q) ||
          p.tags?.some(t => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [allPresets, activeTab, favorites, recent, query, mode]);

  const handleSaveCustom = () => {
    const title = saveTitle.trim();
    if (!title || !currentPrompt.trim()) return;
    const preset: PromptPreset = {
      id: `custom-${uuidv4()}`,
      category: saveCategory,
      title,
      snippet: currentPrompt.trim(),
      modes: [mode],
    };
    addCustom(preset);
    setSavingOpen(false);
    setSaveTitle('');
    setActiveTab('custom');
  };

  return (
    <div
      ref={panelRef}
      className="chip-paper anim-pop absolute flex flex-col overflow-hidden z-40"
      style={{
        bottom: '100%',
        marginBottom: 8,
        left: 0,
        width: 420,
        height: 480,
        boxShadow: 'var(--shadow-ink-3)',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header: search */}
      <div
        className="hairline-b flex items-center gap-2"
        style={{ padding: '9px 12px', background: 'var(--bg-2)' }}
      >
        <Search className="w-3.5 h-3.5 shrink-0" strokeWidth={1.6} style={{ color: 'var(--ink-3)' }} />
        <input
          ref={searchRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="搜索风格、关键词、标签…"
          className="flex-1 bg-transparent focus:outline-none"
          style={{
            fontSize: 12.5,
            color: 'var(--ink-0)',
            border: 'none',
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="btn btn-ghost btn-icon"
            style={{ width: 20, height: 20, padding: 0 }}
            title="清除"
          >
            <X className="w-3 h-3" strokeWidth={1.6} />
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="btn btn-ghost btn-icon"
          style={{ width: 22, height: 22, padding: 0 }}
          title="关闭 (Esc)"
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.6} />
        </button>
      </div>

      {/* Body: two-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left tabs */}
        <div
          className="hairline-r paper-scroll overflow-y-auto"
          style={{ width: 96, flexShrink: 0, background: 'var(--bg-2)', padding: '4px 0' }}
        >
          {LEFT_TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="w-full flex items-center gap-1.5 transition-colors"
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  color: active ? 'var(--accent)' : 'var(--ink-1)',
                  fontWeight: active ? 600 : 500,
                  background: active ? 'var(--bg-0)' : 'transparent',
                  borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                }}
              >
                {tab.icon}
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right grid */}
        <div className="flex-1 min-w-0 paper-scroll overflow-y-auto" style={{ padding: 8 }}>
          {filtered.length === 0 ? (
            <div
              className="h-full flex items-center justify-center"
              style={{ fontSize: 12, color: 'var(--ink-3)' }}
            >
              {activeTab === 'custom'
                ? '还没有自定义预设，点下方 + 保存当前 prompt'
                : query
                ? '没有匹配的预设'
                : '本分类下暂无内容'}
            </div>
          ) : (
            <div className="grid grid-cols-2" style={{ gap: 8 }}>
              {filtered.map(preset => {
                const isApplied = appliedIds.includes(preset.id);
                const isFav = favorites.includes(preset.id);
                return (
                  <div
                    key={preset.id}
                    className="group relative transition-all"
                    style={{
                      borderRadius: 'var(--r-md)',
                      border: `1px solid ${isApplied ? 'var(--accent)' : 'var(--line-1)'}`,
                      background: isApplied
                        ? 'color-mix(in oklch, var(--accent) 8%, var(--bg-0))'
                        : 'var(--bg-0)',
                      padding: 8,
                      boxShadow: isApplied ? 'var(--shadow-ink-1)' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isApplied) {
                        e.currentTarget.style.borderColor = 'var(--accent)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-ink-1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isApplied) {
                        e.currentTarget.style.borderColor = 'var(--line-1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-1" style={{ marginBottom: 4 }}>
                      <div
                        className="truncate"
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--ink-0)',
                        }}
                      >
                        {preset.title}
                      </div>
                      <div className="flex items-center shrink-0" style={{ gap: 2 }}>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            toggleFavorite(preset.id);
                          }}
                          className="transition-colors"
                          style={{
                            padding: 2,
                            borderRadius: 'var(--r-sm)',
                            background: 'transparent',
                            color: isFav ? 'var(--warning)' : 'var(--line-2)',
                            opacity: isFav ? 1 : 0,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={(e) => {
                            if (!isFav) e.currentTarget.style.opacity = '0';
                          }}
                          title={isFav ? '取消收藏' : '收藏'}
                        >
                          <Star
                            className="w-3 h-3"
                            strokeWidth={1.6}
                            fill={isFav ? 'currentColor' : 'none'}
                          />
                        </button>
                        {preset.isCustom && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              if (confirm(`删除自定义预设「${preset.title}」？`))
                                removeCustom(preset.id);
                            }}
                            className="transition-colors opacity-0 group-hover:opacity-100"
                            style={{
                              padding: 2,
                              borderRadius: 'var(--r-sm)',
                              background: 'transparent',
                              color: 'var(--line-2)',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--line-2)')}
                            title="删除"
                          >
                            <Trash2 className="w-3 h-3" strokeWidth={1.6} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div
                      className="line-clamp-3"
                      style={{
                        fontSize: 10.5,
                        lineHeight: 1.55,
                        color: 'var(--ink-2)',
                        marginBottom: 6,
                      }}
                      title={preset.snippet}
                    >
                      {preset.snippet}
                    </div>
                    <button
                      type="button"
                      disabled={isApplied}
                      onClick={() => onApply(preset)}
                      className={isApplied ? '' : 'btn btn-primary'}
                      style={{
                        width: '100%',
                        padding: '4px 0',
                        fontSize: 11,
                        borderRadius: 'var(--r-sm)',
                        gap: 4,
                        justifyContent: 'center',
                        ...(isApplied
                          ? {
                              background: 'color-mix(in oklch, var(--accent) 16%, var(--bg-1))',
                              color: 'var(--accent)',
                              cursor: 'default',
                              border: '1px solid color-mix(in oklch, var(--accent) 36%, transparent)',
                            }
                          : {}),
                      }}
                    >
                      {isApplied ? (
                        <>
                          <Check className="w-3 h-3" strokeWidth={2} />
                          已应用
                        </>
                      ) : (
                        '应用'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer: save custom */}
      <div className="hairline-t" style={{ background: 'var(--bg-2)' }}>
        {savingOpen ? (
          <div className="flex items-center gap-1.5" style={{ padding: 8 }}>
            <input
              value={saveTitle}
              onChange={e => setSaveTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveCustom();
                else if (e.key === 'Escape') setSavingOpen(false);
                e.stopPropagation();
              }}
              placeholder="给当前 prompt 起个名字"
              className="input-paper flex-1 min-w-0"
              style={{ fontSize: 12, padding: '5px 8px' }}
              autoFocus
            />
            <select
              value={saveCategory}
              onChange={e => setSaveCategory(e.target.value as PromptCategoryId)}
              className="input-paper"
              style={{ fontSize: 11, padding: '5px 6px', width: 'auto' }}
            >
              {PROMPT_CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSaveCustom}
              disabled={!saveTitle.trim() || !currentPrompt.trim()}
              className="btn btn-primary"
              style={{ padding: '5px 10px', fontSize: 11 }}
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => setSavingOpen(false)}
              className="btn btn-ghost btn-icon"
              style={{ width: 22, height: 22, padding: 0 }}
              title="取消"
            >
              <X className="w-3 h-3" strokeWidth={1.6} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (!currentPrompt.trim()) {
                alert('当前输入框为空，先写点内容再保存为预设。');
                return;
              }
              setSavingOpen(true);
            }}
            className="w-full flex items-center justify-center gap-1.5 transition-colors"
            style={{
              padding: '8px 0',
              fontSize: 12,
              color: 'var(--ink-1)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.background = 'var(--bg-0)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--ink-1)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
            保存当前 prompt 为预设
          </button>
        )}
      </div>
    </div>
  );
}
