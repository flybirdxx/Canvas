import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useUserTemplatesStore } from '@/store/useUserTemplatesStore';
import { canvasToTemplate } from '@/utils/canvasToTemplate';
import type { CanvasTemplate } from '@/data/templates';
import { TEMPLATE_CATEGORIES } from '@/data/templates';

interface SaveTemplateModalProps {
  open: boolean;
  onClose: () => void;
}

export function SaveTemplateModal({ open, onClose }: SaveTemplateModalProps) {
  const [name, setName] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `模板 ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [category, setCategory] = useState<CanvasTemplate['category']>('短视频');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const saveTemplate = useUserTemplatesStore(s => s.saveTemplate);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSave = () => {
    if (!name.trim()) {
      alert('请输入模板名称');
      return;
    }
    setSaving(true);
    try {
      const tpl = canvasToTemplate(name.trim(), category, description.trim());
      saveTemplate(tpl);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center anim-fade-in"
      style={{ background: 'color-mix(in oklch, var(--ink-0) 32%, transparent)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="chip-paper anim-pop flex flex-col overflow-hidden"
        style={{
          width: 440,
          maxWidth: '95vw',
          borderRadius: 'var(--r-xl)',
          boxShadow: 'var(--shadow-ink-3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="hairline-b flex items-center justify-between"
          style={{ padding: '14px 18px', background: 'var(--bg-2)' }}
        >
          <span className="serif" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-0)' }}>
            保存为模板
          </span>
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

        {/* Form */}
        <div className="flex flex-col" style={{ padding: '20px 18px', gap: 16 }}>
          {/* Name */}
          <div className="flex flex-col" style={{ gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-1)' }}>
              模板名称 <span style={{ color: 'var(--signal)' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input-paper"
              style={{ fontSize: 13 }}
              placeholder="输入模板名称"
              autoFocus
            />
          </div>

          {/* Category */}
          <div className="flex flex-col" style={{ gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-1)' }}>
              分类
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as CanvasTemplate['category'])}
              className="input-paper"
              style={{ fontSize: 13, cursor: 'pointer' }}
            >
              {TEMPLATE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="flex flex-col" style={{ gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-1)' }}>
              描述 <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>（可选）</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="input-paper"
              style={{ fontSize: 13, resize: 'vertical', minHeight: 72 }}
              placeholder="简要描述此模板的用途..."
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="hairline-t flex justify-end gap-2"
          style={{ padding: '12px 18px', background: 'var(--bg-2)' }}
        >
          <button type="button" onClick={onClose} className="btn btn-ghost" style={{ padding: '6px 16px', fontSize: 13 }}>
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="btn btn-primary"
            style={{ padding: '6px 18px', fontSize: 13 }}
          >
            {saving ? '保存中...' : '保存模板'}
          </button>
        </div>
      </div>
    </div>
  );
}
