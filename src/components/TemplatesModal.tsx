import { useEffect, useMemo, useState } from 'react';
import { X, Sparkles, Search, Save, Trash2 } from 'lucide-react';
import {
  BUILTIN_TEMPLATES,
  TEMPLATE_CATEGORIES,
  CanvasTemplate,
  TemplateCategory,
} from '@/data/templates';
import { instantiateTemplate } from '@/utils/instantiateTemplate';
import { useUserTemplatesStore } from '@/store/useUserTemplatesStore';
import { SaveTemplateModal } from './SaveTemplateModal';

type FilterKey = 'all' | TemplateCategory;

interface TemplatesModalProps {
  open: boolean;
  onClose: () => void;
}

export function TemplatesModal({ open, onClose }: TemplatesModalProps) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [isSaveOpen, setIsSaveOpen] = useState(false);

  const userTemplates = useUserTemplatesStore(s => s.templates);
  const deleteTemplate = useUserTemplatesStore(s => s.deleteTemplate);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleDelete = (tpl: CanvasTemplate) => {
    if (confirm(`删除模板「${tpl.name}」？此操作不可撤销。`)) {
      deleteTemplate(tpl.id);
    }
  };

  const allTemplates = useMemo(
    () => [...BUILTIN_TEMPLATES, ...userTemplates],
    [userTemplates],
  );

  const filtered = useMemo(() => {
    const byCat = filter === 'all'
      ? allTemplates
      : allTemplates.filter(t => t.category === filter);
    const q = query.trim().toLowerCase();
    if (!q) return byCat;
    return byCat.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      (t.tags ?? []).some(tag => tag.toLowerCase().includes(q)),
    );
  }, [allTemplates, filter, query]);

  if (!open) return null;

  const use = (tpl: CanvasTemplate) => {
    instantiateTemplate(tpl);
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center anim-fade-in"
        style={{ background: 'color-mix(in oklch, var(--ink-0) 32%, transparent)', backdropFilter: 'blur(6px)', zIndex: 50 }}
        onClick={onClose}
      />
      <div
        className="chip-paper anim-pop flex flex-col overflow-hidden"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 880,
          maxWidth: '95vw',
          height: 620,
          maxHeight: '90vh',
          borderRadius: 'var(--r-xl)',
          boxShadow: 'var(--shadow-ink-3)',
          zIndex: 51,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="hairline-b flex items-center justify-between"
          style={{ padding: '12px 20px', background: 'var(--bg-2)', flexShrink: 0 }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--accent)' }} />
            <span className="serif" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-0)' }}>
              模板市场
            </span>
            <span className="meta" style={{ fontSize: 10.5, marginLeft: 4, letterSpacing: '0.04em' }}>
              一键创建常用场景
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSaveOpen(true)}
              className="btn btn-ghost"
              style={{ padding: '4px 10px', fontSize: 12, gap: 4 }}
              title="将当前画布保存为自定义模板"
            >
              <Save className="w-3.5 h-3.5" strokeWidth={1.6} />
              保存画布
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-icon"
              style={{ width: 28, height: 28, borderRadius: '50%' }}
              title="关闭 (Esc)"
            >
              <X className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Sidebar */}
          <div
            className="hairline-r paper-scroll flex flex-col overflow-y-auto"
            style={{ width: 168, padding: 10, gap: 2, background: 'var(--bg-2)', flexShrink: 0 }}
          >
            <SideTab active={filter === 'all'} onClick={() => setFilter('all')}>
              全部 · {BUILTIN_TEMPLATES.length + userTemplates.length}
            </SideTab>
            {TEMPLATE_CATEGORIES.map(cat => (
              <SideTab
                key={cat}
                active={filter === cat}
                onClick={() => setFilter(cat)}
              >
                {cat} · {BUILTIN_TEMPLATES.filter(t => t.category === cat).length + userTemplates.filter(t => t.category === cat).length}
              </SideTab>
            ))}

            <div className="flex-1" />
            <p style={{ fontSize: 10.5, lineHeight: 1.6, padding: 6, color: 'var(--ink-3)' }}>
              使用模板会在视口中心落下一组预连接的节点，可直接编辑 prompt。
            </p>
          </div>

          {/* Main grid */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="hairline-b" style={{ padding: 12 }}>
              <div className="relative">
                <Search
                  className="absolute"
                  style={{
                    width: 14,
                    height: 14,
                    color: 'var(--ink-3)',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                  strokeWidth={1.6}
                />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="搜索名称、标签..."
                  className="input-paper"
                  style={{ fontSize: 12.5, paddingLeft: 30 }}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 paper-scroll overflow-y-auto" style={{ padding: 14 }}>
              {filtered.length === 0 ? (
                <div
                  style={{
                    padding: '64px 0',
                    textAlign: 'center',
                    fontSize: 12.5,
                    color: 'var(--ink-3)',
                  }}
                >
                  没有匹配的模板
                </div>
              ) : (
                <div className="grid grid-cols-2" style={{ gap: 12 }}>
                  {filtered.map(tpl => {
                    const isBuiltin = BUILTIN_TEMPLATES.some(b => b.id === tpl.id);
                    return (
                      <TemplateCard
                        key={tpl.id}
                        template={tpl}
                        onUse={() => use(tpl)}
                        onDelete={isBuiltin ? undefined : () => handleDelete(tpl)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <SaveTemplateModal open={isSaveOpen} onClose={() => setIsSaveOpen(false)} />
    </>
  );
}

function SideTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left transition-colors"
      style={{
        padding: '7px 10px',
        fontSize: 12.5,
        borderRadius: 'var(--r-sm)',
        background: active ? 'var(--bg-0)' : 'transparent',
        color: active ? 'var(--ink-0)' : 'var(--ink-1)',
        fontWeight: active ? 600 : 500,
        boxShadow: active ? 'var(--shadow-ink-1)' : 'none',
        border: active ? '1px solid var(--line-1)' : '1px solid transparent',
      }}
    >
      {children}
    </button>
  );
}

function TemplateCard({
  template,
  onUse,
  onDelete,
}: {
  template: CanvasTemplate;
  onUse: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className="flex flex-col overflow-hidden transition-all"
      style={{
        background: 'var(--bg-0)',
        border: '1px solid var(--line-1)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--shadow-ink-1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.boxShadow = 'var(--shadow-ink-2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--line-1)';
        e.currentTarget.style.boxShadow = 'var(--shadow-ink-1)';
      }}
    >
      <div
        className="hairline-b relative overflow-hidden"
        style={{
          height: 112,
          background: 'linear-gradient(135deg, color-mix(in oklch, var(--accent) 10%, var(--bg-1)), color-mix(in oklch, var(--signal) 8%, var(--bg-1)))',
        }}
      >
        <TemplatePreview template={template} />
        <div
          className="absolute"
          style={{ top: 6, left: 8, fontSize: 18, lineHeight: 1 }}
        >
          {template.emoji ?? '🧩'}
        </div>
      </div>

      <div className="flex-1 flex flex-col" style={{ padding: 12 }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3
              className="serif truncate"
              style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-0)' }}
            >
              {template.name}
            </h3>
            <p
              style={{
                fontSize: 11.5,
                lineHeight: 1.55,
                marginTop: 2,
                color: 'var(--ink-2)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {template.description}
            </p>
          </div>
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="btn btn-ghost btn-icon"
              style={{ width: 22, height: 22, flexShrink: 0, opacity: 0.6 }}
              title="删除模板"
            >
              <Trash2 className="w-3 h-3" strokeWidth={1.8} />
            </button>
          )}
        </div>

        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap" style={{ gap: 4, marginTop: 8 }}>
            {template.tags.map(t => (
              <span
                key={t}
                style={{
                  fontSize: 10,
                  padding: '1px 7px',
                  borderRadius: 'var(--r-pill)',
                  color: 'var(--ink-2)',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--line-1)',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={onUse}
          className="btn btn-primary"
          style={{ marginTop: 12, width: '100%', padding: '6px 0', fontSize: 12.5 }}
        >
          使用此模板
        </button>
      </div>
    </div>
  );
}

function TemplatePreview({ template }: { template: CanvasTemplate }) {
  const box = useMemo(() => {
    if (template.elements.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of template.elements) {
      minX = Math.min(minX, el.offsetX);
      minY = Math.min(minY, el.offsetY);
      maxX = Math.max(maxX, el.offsetX + el.width);
      maxY = Math.max(maxY, el.offsetY + el.height);
    }
    return { minX, minY, maxX, maxY };
  }, [template]);

  if (!box) return null;

  const contentW = box.maxX - box.minX;
  const contentH = box.maxY - box.minY;
  const viewW = 220;
  const viewH = 100;
  const padding = 8;
  const scale = Math.min((viewW - padding * 2) / contentW, (viewH - padding * 2) / contentH);
  const offsetX = (viewW - contentW * scale) / 2 - box.minX * scale;
  const offsetY = (viewH - contentH * scale) / 2 - box.minY * scale;

  // Tokens mirrored to sRGB for SVG fills.
  const colorFor = (type: string) => {
    switch (type) {
      case 'text': return { fill: '#E9F0EA', stroke: '#4A8466' };
      case 'image': return { fill: '#E7EEF6', stroke: '#3A6AA8' };
      case 'video': return { fill: '#F8E8E4', stroke: '#A8502C' };
      case 'audio': return { fill: '#F6EDDB', stroke: '#A07020' };
      case 'sticky': return { fill: '#F2E9B8', stroke: '#8E7D2A' };
      default: return { fill: '#EFE7D6', stroke: '#6F6752' };
    }
  };

  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full h-full" style={{ filter: 'url(#ink-wobble)' }}>
      {(template.connections ?? []).map((c, i) => {
        const from = template.elements.find(e => e.localId === c.fromLocalId);
        const to = template.elements.find(e => e.localId === c.toLocalId);
        if (!from || !to) return null;
        const fx = (from.offsetX + from.width) * scale + offsetX;
        const fy = (from.offsetY + from.height / 2) * scale + offsetY;
        const tx = to.offsetX * scale + offsetX;
        const ty = (to.offsetY + to.height / 2) * scale + offsetY;
        const mid = (fx + tx) / 2;
        return (
          <path
            key={i}
            d={`M ${fx} ${fy} C ${mid} ${fy}, ${mid} ${ty}, ${tx} ${ty}`}
            fill="none"
            stroke="#6F6752"
            strokeOpacity={0.5}
            strokeWidth={1}
          />
        );
      })}
      {template.elements.map((el, i) => {
        const c = colorFor(el.type);
        return (
          <rect
            key={i}
            x={el.offsetX * scale + offsetX}
            y={el.offsetY * scale + offsetY}
            width={el.width * scale}
            height={el.height * scale}
            rx={3}
            fill={c.fill}
            stroke={c.stroke}
            strokeOpacity={0.75}
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}
