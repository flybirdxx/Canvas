/**
 * ScriptLineEditor — 单行剧本编辑器。
 *
 * OmniScript 风格的紧凑行内编辑：左侧角色 + 情绪，右侧内容输入，
 * 底部快捷操作栏（行类型、时间戳、删除）。
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Trash2, GripVertical } from 'lucide-react';
import type { ScriptLine, LineType } from '@/types/canvas';
import { EMOTION_PRESETS } from '@/types/canvas';

interface ScriptLineEditorProps {
  line: ScriptLine;
  /** 当前场次已使用的所有角色（用于下拉建议） */
  knownRoles: string[];
  onChange: (updated: ScriptLine) => void;
  onDelete: () => void;
  /** 精简模式：用于场景卡片内嵌预览 */
  compact?: boolean;
}

export function ScriptLineEditor({
  line,
  knownRoles,
  onChange,
  onDelete,
  compact = false,
}: ScriptLineEditorProps) {
  const [showRoleSuggest, setShowRoleSuggest] = useState(false);
  const [showEmotionPicker, setShowEmotionPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const roleInputRef = useRef<HTMLInputElement>(null);
  const emotionBtnRef = useRef<HTMLButtonElement>(null);

  // Close pickers on outside click
  useEffect(() => {
    if (!showRoleSuggest && !showEmotionPicker && !showTypePicker) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('.sl-picker')) return;
      setShowRoleSuggest(false);
      setShowEmotionPicker(false);
      setShowTypePicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showRoleSuggest, showEmotionPicker, showTypePicker]);

  const handleRoleChange = useCallback((role: string) => {
    onChange({ ...line, role });
    setShowRoleSuggest(false);
  }, [line, onChange]);

  const handleEmotionSelect = useCallback((label: string, emoji: string) => {
    onChange({ ...line, emotion: label, emotionEmoji: emoji });
    setShowEmotionPicker(false);
  }, [line, onChange]);

  const handleLineTypeChange = useCallback((lt: LineType) => {
    onChange({ ...line, lineType: lt });
    setShowTypePicker(false);
  }, [line, onChange]);

  const isDialogue = line.lineType === 'dialogue';

  return (
    <div
      className="sl-row"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 2 : 4,
        padding: compact ? '4px 0' : '6px 0',
        borderBottom: '1px solid var(--line-1, rgba(0,0,0,0.06))',
      }}
    >
      {/* 主行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* 拖拽手柄 */}
        {!compact && (
          <div style={{ color: 'var(--ink-3)', cursor: 'grab', flexShrink: 0, opacity: 0.4 }}>
            <GripVertical size={12} strokeWidth={1.6} />
          </div>
        )}

        {/* 情绪 Emoji */}
        <button
          ref={emotionBtnRef}
          className="sl-picker"
          onClick={() => setShowEmotionPicker(v => !v)}
          title={line.emotion || '选择情绪'}
          style={{
            width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
            background: 'var(--bg-3)',
            border: '1px solid var(--line-1)',
            borderRadius: 'var(--r-sm)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {line.emotionEmoji || '🎭'}
        </button>

        {/* CR-8: emotion picker positioned relative to its trigger button */}
        {showEmotionPicker && emotionBtnRef.current && (
          <div
            className="sl-picker"
            style={{
              position: 'fixed',
              zIndex: 50,
              top: emotionBtnRef.current.getBoundingClientRect().bottom + 4,
              left: emotionBtnRef.current.getBoundingClientRect().left - 4,
              background: 'var(--bg-1)',
              border: '1px solid var(--line-2)',
              borderRadius: 'var(--r-sm)',
              boxShadow: 'var(--shadow-ink-2)',
              padding: 6,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 3,
            }}
          >
            <button
              onClick={() => handleEmotionSelect('', '🎭')}
              style={{
                padding: '4px 8px', fontSize: 13, background: 'transparent', border: 'none',
                borderRadius: 'var(--r-xs)', cursor: 'pointer', color: 'var(--ink-1)',
                gridColumn: '1 / -1', textAlign: 'left',
              }}
            >
              🎭 无情绪
            </button>
            {EMOTION_PRESETS.map(({ label, emoji }) => (
              <button
                key={label}
                onClick={() => handleEmotionSelect(label, emoji)}
                style={{
                  padding: '3px 6px', fontSize: 14, background:
                    line.emotion === label ? 'var(--accent-soft, color-mix(in srgb, var(--accent) 15%, transparent))' : 'transparent',
                  border: line.emotion === label ? '1px solid var(--accent)' : '1px solid transparent',
                  borderRadius: 'var(--r-xs)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center',
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* 角色输入 */}
        <div style={{ position: 'relative', minWidth: 70, flexShrink: 0 }}>
          <input
            ref={roleInputRef}
            value={line.role}
            onChange={e => onChange({ ...line, role: e.target.value })}
            onFocus={() => setShowRoleSuggest(knownRoles.length > 0)}
            placeholder="角色"
            className="input-paper"
            style={{
              width: '100%',
              fontSize: 12,
              fontWeight: 600,
              padding: '3px 6px',
              textAlign: 'center',
              background: isDialogue ? 'var(--bg-2)' : 'transparent',
            }}
          />
          {showRoleSuggest && knownRoles.filter(r => r).length > 0 && (
            <div
              className="sl-picker"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                zIndex: 50,
                background: 'var(--bg-1)',
                border: '1px solid var(--line-2)',
                borderRadius: 'var(--r-sm)',
                boxShadow: 'var(--shadow-ink-2)',
                minWidth: 90,
                padding: 4,
              }}
            >
              {[...new Set(knownRoles.filter(r => r))].map(role => (
                <button
                  key={role}
                  onClick={() => handleRoleChange(role)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '3px 8px', fontSize: 12,
                    background: 'transparent', border: 'none',
                    borderRadius: 'var(--r-xs)', cursor: 'pointer',
                    color: 'var(--ink-0)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {role}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 内容输入 */}
        <input
          value={line.content}
          onChange={e => onChange({ ...line, content: e.target.value })}
          placeholder={isDialogue ? '台词…' : line.lineType === 'action' ? '动作描述…' : '环境描述…'}
          className="input-paper"
          style={{
            flex: 1,
            fontSize: 12,
            padding: '3px 8px',
            fontStyle: isDialogue ? 'normal' : 'italic',
            color: isDialogue ? 'var(--ink-0)' : 'var(--ink-1)',
          }}
        />

        {/* 行类型切换 */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            className="sl-picker"
            onClick={() => setShowTypePicker(v => !v)}
            style={{
              padding: '2px 6px',
              fontSize: 10,
              fontWeight: 500,
              background: 'var(--bg-3)',
              border: '1px solid var(--line-1)',
              borderRadius: '99px',
              cursor: 'pointer',
              color: 'var(--ink-1)',
              whiteSpace: 'nowrap',
            }}
          >
            {line.lineType === 'dialogue' ? '💬 对白' : line.lineType === 'action' ? '🎬 动作' : '🌤 环境'}
          </button>
          {showTypePicker && (
            <div
              className="sl-picker"
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                zIndex: 50,
                background: 'var(--bg-1)',
                border: '1px solid var(--line-2)',
                borderRadius: 'var(--r-sm)',
                boxShadow: 'var(--shadow-ink-2)',
                minWidth: 90,
                padding: 4,
              }}
            >
              {([
                { type: 'dialogue' as LineType, label: '💬 对白' },
                { type: 'action' as LineType, label: '🎬 动作' },
                { type: 'environment' as LineType, label: '🌤 环境' },
              ]).map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => handleLineTypeChange(type)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '3px 8px', fontSize: 11,
                    background: line.lineType === type ? 'var(--accent-soft, color-mix(in srgb, var(--accent) 12%, transparent))' : 'transparent',
                    border: 'none', borderRadius: 'var(--r-xs)', cursor: 'pointer',
                    color: 'var(--ink-0)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 删除 */}
        <button
          onClick={onDelete}
          title="删除此行"
          style={{
            width: 24, height: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', borderRadius: 'var(--r-xs)',
            cursor: 'pointer', color: 'var(--ink-3)', flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-soft)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <Trash2 size={12} strokeWidth={1.6} />
        </button>
      </div>

      {/* 时间戳（非精简模式） */}
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 28 }}>
          <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>⏱</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={line.timestamp ?? ''}
            onChange={e => onChange({ ...line, timestamp: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="时间 (秒)"
            className="input-paper mono"
            style={{ width: 60, fontSize: 10, padding: '1px 6px', textAlign: 'center' }}
          />
          <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>s</span>
        </div>
      )}
    </div>
  );
}
