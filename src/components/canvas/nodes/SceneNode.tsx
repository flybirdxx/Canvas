import React, { useState, useRef, useEffect } from 'react';
import { Group, Rect } from 'react-konva';
import { Html } from 'react-konva-utils';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { SceneElement } from '@/types/canvas';
import { POLAROID_STYLE, useExecutionBorder } from './shared';

export function SceneNode({
  el, width, height, isSelected,
}: {
  el: SceneElement;
  width: number;
  height: number;
  isSelected: boolean;
}) {
  const executionBorder = useExecutionBorder(el.id);
  const updateElement = useCanvasStore(s => s.updateElement);
  
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(el.title || '');
  const [draftContent, setDraftContent] = useState(el.content || '');
  
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && titleRef.current) {
      titleRef.current.focus();
    }
  }, [editing]);

  function handleSave() {
    updateElement(el.id, { title: draftTitle, content: draftContent });
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(false);
    }
    e.stopPropagation();
  }

  if (editing) {
    return (
      <Group>
        <Rect width={width} height={height} fill="transparent" />
        <Rect
          x={-1} y={-1}
          width={width + 2} height={height + 2}
          stroke={executionBorder}
          strokeWidth={2}
          fill="transparent"
          listening={false}
        />
        <Html divProps={{ style: { pointerEvents: 'none' } }}>
          <div
            style={{
              ...POLAROID_STYLE,
              width,
              height,
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              pointerEvents: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                background: 'var(--accent)', color: 'var(--accent-fg)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: '99px',
              }}>
                场 {el.sceneNum}
              </div>
            </div>
            <input
              ref={titleRef}
              style={{
                fontSize: 13, fontWeight: 600, color: 'var(--ink-0)', lineHeight: 1.4, border: 'none', outline: 'none', background: 'transparent', borderBottom: '1px dashed var(--ink-3)'
              }}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="无标题"
            />
            <textarea
              className="paper-scroll"
              style={{
                flex: 1, fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.5, resize: 'none', border: 'none', outline: 'none', background: 'transparent', width: '100%'
              }}
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              onKeyDown={handleKeyDown}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="分镜内容..."
            />
            <div style={{ fontSize: 9, color: 'var(--ink-3)', textAlign: 'right' }}>
              Cmd+Enter 保存 | Esc 取消
            </div>
          </div>
        </Html>
      </Group>
    );
  }

  return (
    <Group onDblClick={() => {
      setDraftTitle(el.title || '');
      setDraftContent(el.content || '');
      setEditing(true);
    }}>
      <Rect width={width} height={height} fill="transparent" />
      <Rect
        x={-1} y={-1}
        width={width + 2} height={height + 2}
        stroke={isSelected ? 'var(--accent)' : executionBorder}
        strokeWidth={2}
        fill="transparent"
        listening={false}
      />
      <Html divProps={{ style: { pointerEvents: 'none' } }}>
        <div
          style={{
            ...POLAROID_STYLE,
            width,
            height,
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: 'var(--accent)', color: 'var(--accent-fg)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: '99px' }}>
              场 {el.sceneNum}
            </div>
            {el.scriptId && (
              <div style={{ fontSize: 10, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                来自剧本
              </div>
            )}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-0)', lineHeight: 1.4 }}>
            {el.title || '(无标题)'}
          </div>
          {el.content && (
            <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
              {el.content}
            </div>
          )}
        </div>
      </Html>
    </Group>
  );
}
