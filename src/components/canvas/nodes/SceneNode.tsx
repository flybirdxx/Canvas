/**
 * SceneNode — 结构化分镜节点 (OmniScript 风格)。
 *
 * 预览模式：渲染结构化 ScriptLine 列表（角色色彩、情绪 Emoji、Markdown）。
 * 双击或选中时唤起 SceneDetailOverlay 进行高级编辑。
 * 向后兼容：无 lines 时回退到 content 纯文本。
 *
 * 交互改进（FIX）：
 *   - 选中时显示内联操作按钮（删除入口），确保"固定"节点有删除途径
 *   - 双击打开画布上的 SceneDetailOverlay 编辑面板
 *   - 内容区恢复 pointerEvents，允许文本选择等交互
 */
import React, { useMemo, useState } from 'react';
import { Group, Rect } from 'react-konva';
import { Html } from 'react-konva-utils';
import { useCanvasStore } from '@/store/useCanvasStore';
import { LayoutGrid, Trash2 } from 'lucide-react';
import type { SceneElement } from '@/types/canvas';
import { POLAROID_STYLE, useExecutionBorder } from './shared';
import { renderSceneLine, MarkdownRenderer } from './sceneNodeRenderer';

const PREVIEW_MAX_LINES = 10;

export function SceneNode({
  el, width, height, isSelected,
}: {
  el: SceneElement;
  width: number;
  height: number;
  isSelected: boolean;
}) {
  const executionBorder = useExecutionBorder(el.id);
  const setSelection = useCanvasStore(s => s.setSelection);
  const setViewMode = useCanvasStore(s => s.setViewMode);
  const deleteElements = useCanvasStore(s => s.deleteElements);
  const [hovered, setHovered] = useState(false);

  const hasStructuredLines = el.lines && el.lines.length > 0;
  const previewLines = hasStructuredLines ? el.lines!.slice(0, PREVIEW_MAX_LINES) : null;
  const remainingCount = hasStructuredLines ? Math.max(0, el.lines!.length - PREVIEW_MAX_LINES) : 0;
  const hasLegacyContent = !hasStructuredLines && !!el.content;

  const renderedPreviewLines = useMemo(
    () => previewLines?.map(line => renderSceneLine(line)) ?? null,
    [previewLines],
  );

  const handleOpenStoryboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelection([el.id]);
    setViewMode('storyboard');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements([el.id]);
  };

  const showActions = isSelected || hovered;

  return (
    <Group
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDblClick={() => {
        setSelection([el.id]);
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
      {/* Main content — pointerEvents: none so Konva receives pointer events for selection/drag */}
      <Html divProps={{ style: { pointerEvents: 'none' } }}>
        <div
          style={{
            ...POLAROID_STYLE,
            width,
            height,
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            overflow: 'hidden',
            pointerEvents: 'auto',
          }}
        >
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--accent)', color: 'var(--accent-fg)',
              fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: '99px',
            }}>
              场 {el.sceneNum}
            </span>
            {el.scriptId && (
              <span style={{ fontSize: 9, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                来自剧本
              </span>
            )}
            {/* Emotion summary */}
            {hasStructuredLines && (() => {
              const emotions = el.lines!.filter(l => l.emotionEmoji).slice(0, 3).map(l => l.emotionEmoji);
              return emotions.length > 0 ? (
                <span style={{ fontSize: 12, marginLeft: 'auto', opacity: 0.8 }}>{emotions.join('')}</span>
              ) : null;
            })()}
          </div>

          {/* Title */}
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--ink-0)',
            lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {el.title || '(无标题)'}
          </div>

          {/* Structured lines */}
          {hasStructuredLines && renderedPreviewLines && (
            <div className="paper-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
              {renderedPreviewLines}
              {remainingCount > 0 && (
                <div style={{ fontSize: 10, color: 'var(--ink-3)', textAlign: 'center', padding: '2px 0', fontStyle: 'italic' }}>
                  +{remainingCount} 行 · 双击编辑
                </div>
              )}
            </div>
          )}

          {/* Legacy content */}
          {hasLegacyContent && (
            <div className="paper-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
              <MarkdownRenderer source={el.content!} />
            </div>
          )}

          {/* Empty */}
          {!hasStructuredLines && !hasLegacyContent && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>
              双击编辑分镜内容…
            </div>
          )}
        </div>
      </Html>

      {/* Action buttons — visible on hover or selection (FIX: divProps pointerEvents:none 防止 Konva 拦截事件) */}
      {showActions && (
        <>
          {/* Delete button */}
          <Html divProps={{ style: { pointerEvents: 'none' } }}>
            <div
              onClick={handleDelete}
              title="删除分镜 (Delete)"
              style={{
                position: 'absolute',
                top: 8,
                right: showActions ? 36 : 8,
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

          {/* Jump to storyboard / edit button */}
          <Html divProps={{ style: { pointerEvents: 'none' } }}>
            <div
              onClick={handleOpenStoryboard}
              title="在分镜视图中编辑"
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
                color: 'var(--ink-2)',
                pointerEvents: 'auto',
                userSelect: 'none',
                zIndex: 10,
              }}
            >
              <LayoutGrid size={11} strokeWidth={1.6} />
            </div>
          </Html>
        </>
      )}
    </Group>
  );
}
