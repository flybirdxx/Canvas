import React, { useState, useRef, useEffect } from 'react';
import { Group, Rect } from 'react-konva';
import { Html } from 'react-konva-utils';
import { useCanvasStore } from '@/store/useCanvasStore';
import { parseScriptMarkdown } from '@/utils/parseScript';
import { Trash2 } from 'lucide-react';
import type { ScriptElement } from '@/types/canvas';
import { POLAROID_STYLE, useExecutionBorder } from './shared';
import { MarkdownRenderer } from './sceneNodeRenderer';

export function ScriptNode({
  el, width, height, isSelected,
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
  const deleteElements = useCanvasStore(s => s.deleteElements);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    isEditingRef.current = editing;
  }, [editing]);

  // CR-7: merged auto-edit + draft-sync into a single effect with clear precedence.
  useEffect(() => {
    // Priority 1: auto-edit for newly created nodes
    if (el.isNew && !didAutoEdit.current) {
      didAutoEdit.current = true;
      setDraft(el.markdown || '');
      setEditing(true);
      updateElement(el.id, { isNew: undefined });
      return;
    }
    // Priority 2: sync draft from store when the user is not editing
    if (!isEditingRef.current && el.markdown !== draft) {
      setDraft(el.markdown || '');
    }
  // draft is intentionally excluded — we only sync when markdown changes externally.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el.id, el.markdown, el.isNew]);

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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements([el.id]);
  };

  const PREVIEW_SCENE_COUNT = 3;
  const previewScenes = el.scenes.slice(0, PREVIEW_SCENE_COUNT);
  const hasMore = el.scenes.length > PREVIEW_SCENE_COUNT;
  const showDelete = (isSelected || hovered) && !editing;

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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
            pointerEvents: 'auto',
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

      {/* Delete button — visible on hover or selection (FIX: divProps pointerEvents:none 防止 Konva 拦截事件) */}
      {showDelete && (
        <Html divProps={{ style: { pointerEvents: 'none' } }}>
          <div
            onClick={handleDelete}
            title="删除剧本节点 (Delete)"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-3)',
              border: '1px solid var(--line-1)',
              borderRadius: 'var(--r-xs)',
              cursor: 'pointer',
              color: 'var(--danger)',
              pointerEvents: 'auto',
              userSelect: 'none',
              zIndex: 10,
            }}
          >
            <Trash2 size={11} strokeWidth={1.6} />
          </div>
        </Html>
      )}
    </Group>
  );
}
