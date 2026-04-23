import React, { useEffect, useRef, useState } from 'react';
import { StickyNote, X } from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';
import { CanvasElement } from '../types/canvas';

export interface NodeNoteIndicatorProps {
  element: CanvasElement;
  /** Top-right anchor of the node in SCREEN coords (px). */
  x: number;
  y: number;
  /** Canvas scale, applied via CSS transform so the chip scales with zoom. */
  scale: number;
}

/**
 * F24: floating annotation chip anchored to a node's top-right corner.
 *
 * States:
 *   - Collapsed chip: compact icon + optional first-line excerpt.
 *     Click to expand into an editor popup.
 *   - Editor popup: textarea + save/clear, closes on outside click or Esc.
 *
 * Behavior:
 *   - Note content lives on the element itself (`element.note`).
 *   - Trimmed-empty content clears the note entirely (not persisted as "").
 *   - Chip is ALSO rendered when selected and the note is empty, so users
 *     have an obvious entry point; in that case the chip shows a dimmed "+"
 *     style to indicate "add note".
 */
export function NodeNoteIndicator({ element, x, y, scale }: NodeNoteIndicatorProps) {
  const updateElement = useCanvasStore(s => s.updateElement);
  const initialNote = (element.note ?? '').trim();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialNote);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft when element.note changes externally (e.g., undo/redo).
  useEffect(() => {
    setDraft((element.note ?? '').trim());
  }, [element.note]);

  // Outside-click / Esc to close the editor without saving; save on Enter
  // with Shift (Shift+Enter) would conflict with textarea newline — keep
  // it explicit via the ✓ button.
  useEffect(() => {
    if (!editing) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) {
        commit();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditing(false);
      }
      e.stopPropagation();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey, true);
    textareaRef.current?.focus();
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    const current = (element.note ?? '').trim();
    if (trimmed !== current) {
      updateElement(element.id, { note: trimmed.length > 0 ? trimmed : undefined } as any);
    }
    setEditing(false);
  };

  const clear = () => {
    setDraft('');
    updateElement(element.id, { note: undefined } as any);
    setEditing(false);
  };

  const excerpt = initialNote
    ? initialNote.split(/\r?\n/)[0].slice(0, 18) + (initialNote.length > 18 ? '…' : '')
    : '';

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        left: x,
        top: y,
        transform: `scale(${scale})`,
        transformOrigin: 'top right',
      }}
      onMouseDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      {/* Collapsed chip — anchored top-right, offset outward so it doesn't
          overlap with port handles on the node. */}
      {!editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title={initialNote || '添加备注'}
          className="flex items-center gap-1 transition-colors"
          style={{
            transform: 'translate(-6px, -6px)',
            transformOrigin: 'top right',
            padding: '3px 8px',
            fontSize: 10.5,
            fontWeight: 500,
            borderRadius: 'var(--r-pill)',
            boxShadow: 'var(--shadow-ink-1)',
            background: initialNote
              ? 'color-mix(in oklch, var(--sticky-fg) 14%, var(--bg-0))'
              : 'var(--bg-0)',
            color: initialNote ? 'var(--sticky-fg)' : 'var(--ink-2)',
            border: `1px solid ${initialNote ? 'color-mix(in oklch, var(--sticky-fg) 42%, transparent)' : 'var(--line-1)'}`,
          }}
        >
          <StickyNote className="w-3 h-3 shrink-0" strokeWidth={1.6} />
          {initialNote ? (
            <span className="truncate" style={{ maxWidth: 140 }}>
              {excerpt}
            </span>
          ) : (
            <span>备注</span>
          )}
        </button>
      )}

      {editing && (
        <div
          ref={panelRef}
          className="chip-paper anim-pop"
          style={{
            transform: 'translate(-6px, -6px)',
            transformOrigin: 'top right',
            padding: 10,
            width: 264,
            borderColor: 'color-mix(in oklch, var(--sticky-fg) 48%, var(--line-1))',
            boxShadow: 'var(--shadow-ink-3)',
          }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <div
              className="flex items-center gap-1 serif"
              style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--sticky-fg)' }}
            >
              <StickyNote className="w-3 h-3" strokeWidth={1.6} />
              节点备注
            </div>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn btn-ghost btn-icon"
              style={{ width: 20, height: 20, padding: 0 }}
              title="取消（Esc）"
            >
              <X className="w-3 h-3" strokeWidth={1.6} />
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder="写点什么…连续性提示、评审意见、待办事项等"
            rows={4}
            className="w-full resize-none focus:outline-none"
            style={{
              background: 'color-mix(in oklch, var(--sticky-fg) 8%, var(--bg-0))',
              border: '1px solid color-mix(in oklch, var(--sticky-fg) 32%, var(--line-1))',
              borderRadius: 'var(--r-sm)',
              padding: '6px 8px',
              fontSize: 12,
              lineHeight: 1.5,
              color: 'var(--ink-0)',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={clear}
              disabled={!initialNote}
              style={{
                fontSize: 10.5,
                color: initialNote ? 'var(--danger)' : 'var(--line-2)',
                background: 'transparent',
                cursor: initialNote ? 'pointer' : 'not-allowed',
              }}
            >
              删除备注
            </button>
            <button
              type="button"
              onClick={commit}
              className="btn btn-primary"
              style={{
                padding: '5px 12px',
                fontSize: 11,
                background: 'var(--sticky-fg)',
                color: 'var(--accent-fg)',
              }}
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
