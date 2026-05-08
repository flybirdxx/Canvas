import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Group, Rect } from 'react-konva';
import { Html } from 'react-konva-utils';
import { useCanvasStore } from '@/store/useCanvasStore';
import { POLAROID_STYLE, useExecutionBorder } from './shared';
import { renderMarkdown } from '@/utils/markdownRenderer';

export function TextNode({ el }: { el: any }) {
  const { id, width, height } = el;
  const executionBorder = useExecutionBorder(id);
  const updateElement = useCanvasStore((s) => s.updateElement);
  const textEl = el;
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.id === id) {
        setEditing(true);
      }
    };
    window.addEventListener('text:edit', handler);
    return () => window.removeEventListener('text:edit', handler);
  }, [id]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editing]);

  const exitEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const renderedHtml = renderMarkdown(textEl.text ?? '');

  const textStyle = {
    color: (textEl.fill && textEl.fill.startsWith('#')) ? textEl.fill : 'var(--ink-0)',
    fontSize: textEl.fontSize || 14,
    lineHeight: textEl.lineHeight || 1.6,
    textAlign: textEl.align || 'left',
    fontFamily: textEl.fontFamily || 'var(--font-serif)',
  };

  return (
    <Group>
      <Rect width={width} height={height} fill="transparent" />
      <Rect x={-1} y={-1} width={width + 2} height={height + 2} cornerRadius={12} stroke={executionBorder} strokeWidth={2} fill="transparent" listening={false} />
      <Html divProps={{ style: { pointerEvents: 'none' } }}>
        <div className="flex flex-col" style={{ ...POLAROID_STYLE, width, height, fontFamily: textEl.fontFamily || 'var(--font-serif)' }}>
          {editing ? (
            <div className="flex-1" style={{ padding: 14 }}>
              <textarea ref={textareaRef} className="w-full h-full bg-transparent border-none outline-none resize-none pointer-events-auto paper-scroll" style={textStyle} value={textEl.text} placeholder="Type your text here..." onChange={(e: any) => updateElement(id, { text: e.target.value })} onPointerDown={(e: any) => e.stopPropagation()} onKeyDown={(e: any) => { if (e.key === 'Escape') { e.stopPropagation(); exitEdit(); } else { e.stopPropagation(); } }} onBlur={exitEdit} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto paper-scroll" style={{ padding: 14 }}>
              <div className="markdown-body" style={textStyle} dangerouslySetInnerHTML={{ __html: renderedHtml || '' }} />
            </div>
          )}
          {!editing && (
            <div className="pointer-events-auto" style={{ position: 'absolute', bottom: 4, right: 8, zIndex: 2 }}>
              <button type="button" onClick={(e: any) => { e.stopPropagation(); setEditing(true); }} onPointerDown={(e: any) => e.stopPropagation()} style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)', padding: '2px 8px', fontSize: 10, color: 'var(--ink-2)', cursor: 'pointer' }} title="Double-click to edit">
                Edit</button>
            </div>
          )}
        </div>
      </Html>
    </Group>
  );
}