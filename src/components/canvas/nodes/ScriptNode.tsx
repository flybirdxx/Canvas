import React, { useState, useRef, useEffect } from 'react';
import { Group, Rect } from 'react-konva';
import { Html } from 'react-konva-utils';
import { useCanvasStore } from '@/store/useCanvasStore';
import { parseScriptMarkdown } from '@/utils/parseScript';
import type { ScriptElement } from '@/types/canvas';
import { POLAROID_STYLE, useExecutionBorder } from './shared';
import { MarkdownRenderer } from './sceneNodeRenderer';

export function ScriptNode({
  el, width, height, isSelected, autoEdit,
}: {
  el: ScriptElement;
  width: number;
  height: number;
  isSelected: boolean;
  autoEdit?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(el.markdown || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEditingRef = useRef(false);
  const didAutoEdit = useRef(false);
  
  const executionBorder = useExecutionBorder(el.id);
  const updateElement = useCanvasStore(s => s.updateElement);

  useEffect(() => {
    isEditingRef.current = editing;
  }, [editing]);

  useEffect(() => {
    if (el.isNew && !didAutoEdit.current) {
      didAutoEdit.current = true;
      setDraft(el.markdown || '');
      setEditing(true);
      updateElement(el.id, { isNew: undefined });
    }
  }, [el.id, el.isNew, el.markdown, updateElement]);

  useEffect(() => {
    if (!isEditingRef.current && el.markdown !== draft) {
      setDraft(el.markdown || '');
    }
  }, [el.id, el.markdown, draft]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);

  function handleSave() {
    const scenes = parseScriptMarkdown(draft);
    updateElement(el.id, { markdown: draft, scenes });
    setEditing(false);
  }

  function handleBlur() {
    handleSave();
  }

  const MAX_DRAFT_LENGTH = 200000;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    e.stopPropagation();
  }

  const PREVIEW_SCENE_COUNT = 3;
  const previewScenes = el.scenes.slice(0, PREVIEW_SCENE_COUNT);
  const hasMore = el.scenes.length > PREVIEW_SCENE_COUNT;

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
              padding: 0,
              position: 'relative',
            }}
          >
            <textarea
              ref={textareaRef}
              className="paper-scroll"
              style={{
                width: '100%',
                height: '100%',
                padding: '12px',
                boxSizing: 'border-box',
                border: 'none',
                outline: 'none',
                resize: 'none',
                background: 'var(--bg-2)',
                color: 'var(--ink-0)',
                fontSize: 13,
                lineHeight: 1.6,
                fontFamily: 'ui-monospace, Menlo, monospace',
                pointerEvents: 'auto',
              }}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_DRAFT_LENGTH))}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="粘贴或输入 Markdown 剧本内容，使用 ### 场 N 标识分镜锚点…"
            />
          </div>
        </Html>
      </Group>
    );
  }

  return (
    <Group
      onDblClick={() => {
        setDraft(el.markdown || '');
        setEditing(true);
      }}
    >
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
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.08em',
            color: 'var(--accent)',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            剧本
          </div>
          {el.scenes.length === 0 && !el.markdown ? (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
              点击添加剧本内容…
            </div>
          ) : el.scenes.length === 0 ? (
            /* 有 markdown 但无分镜锚点：渲染 Markdown 预览 */
            <div className="paper-scroll" style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              minHeight: 0,
            }}>
              <MarkdownRenderer source={el.markdown!} />
            </div>
          ) : (
            <div className="paper-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
              {previewScenes.map((s) => (
                <div key={s.sceneNum} style={{
                  lineHeight: 1.4,
                  paddingLeft: 8,
                  borderLeft: '2px solid var(--accent)',
                  marginBottom: 6,
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-0)' }}>
                    {s.title || `场 ${s.sceneNum}`}
                  </div>
                  {s.content && (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 1 }}>
                      <MarkdownRenderer source={s.content} />
                    </div>
                  )}
                </div>
              ))}
              {hasMore && (
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                  +{el.scenes.length - PREVIEW_SCENE_COUNT} 更多场次
                </div>
              )}
            </div>
          )}
        </div>
      </Html>
    </Group>
  );
}
