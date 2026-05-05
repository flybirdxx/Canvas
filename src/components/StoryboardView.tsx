/**
 * StoryboardView — 纯 DOM 分镜卡片网格视图。
 *
 * AD2: 与 InfiniteCanvas 同级组件。纯 DOM 渲染（非 Konva），
 * 用 chip-paper CSS 类。读 useCanvasStore 获取 scene 节点。
 *
 * 增强（Story 2.3）: 点击选中、详情面板、拖拽排序。
 * 增强（Story 2.4）: DetailPanel 内联编辑、删除、关联缩略图、分组角标。
 */
import { useCanvasStore } from '../store/useCanvasStore';
import { useState, useCallback, useRef, useEffect } from 'react';
import { BookOpen, GripVertical, X, Trash2, Edit3 } from 'lucide-react';
import type { SceneElement, ScriptElement, ImageElement } from '../types/canvas';

interface SceneCardProps {
  scene: SceneElement;
  isSelected: boolean;
  scriptTitle: string;
  thumbnailSrc?: string;
  groupColor?: string;
  onSelect: (id: string) => void;
  onDragStart: (e: React.DragEvent, scene: SceneElement) => void;
  onDragOver: (e: React.DragEvent, sceneId: string) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragOver: boolean;
  isDragging: boolean;
}

function SceneCard({
  scene,
  isSelected,
  scriptTitle,
  thumbnailSrc,
  groupColor,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver,
  isDragging,
}: SceneCardProps) {
  const title = scene.title || `场 ${scene.sceneNum}`;
  const contentPreview = scene.content
    ? scene.content.length > 80
      ? scene.content.slice(0, 80) + '…'
      : scene.content
    : '';

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, scene)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e, scene.id); }}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(scene.id)}
      className="chip-paper"
      style={{
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        cursor: 'pointer',
        transition: 'box-shadow 150ms ease, border-color 150ms ease, opacity 150ms ease',
        border: isSelected
          ? '2px solid var(--accent)'
          : '2px solid transparent',
        background: isSelected
          ? 'color-mix(in srgb, var(--accent) 8%, var(--bg-1))'
          : 'var(--chip-bg, var(--bg-2))',
        opacity: isDragging ? 0.4 : 1,
        outline: isDragOver
          ? '2px dashed var(--accent)'
          : 'none',
        outlineOffset: '2px',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      {/* 分组角标 */}
      {groupColor && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: groupColor,
          }}
          title="属于分组"
        />
      )}

      {/* 拖拽手柄 */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          color: 'var(--ink-2)',
          opacity: 0.5,
          cursor: 'grab',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} strokeWidth={1.6} />
      </div>

      {/* 缩略图 */}
      {thumbnailSrc && (
        <div
          style={{
            width: '100%',
            height: 120,
            borderRadius: 'var(--r-sm)',
            overflow: 'hidden',
            background: 'var(--bg-3)',
          }}
        >
          <img
            src={thumbnailSrc}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '16px' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {scene.sceneNum}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--ink-0)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {title}
        </span>
      </div>

      {contentPreview && (
        <p
          style={{
            fontSize: 12,
            color: 'var(--ink-1)',
            lineHeight: 1.5,
            margin: 0,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            paddingLeft: '16px',
          }}
        >
          {contentPreview}
        </p>
      )}

      {scriptTitle && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--ink-2)',
            fontFamily: 'var(--font-sans)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            paddingLeft: '16px',
          }}
        >
          来自：{scriptTitle}
        </span>
      )}
    </div>
  );
}

interface DetailPanelProps {
  scene: SceneElement;
  scriptTitle: string;
  onUpdate: (id: string, attrs: Partial<SceneElement>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function DetailPanel({ scene, scriptTitle, onUpdate, onDelete, onClose }: DetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(scene.title);
  const [content, setContent] = useState(scene.content);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setTitle(scene.title);
    setContent(scene.content);
    setIsEditing(false);
    setConfirmDelete(false);
  }, [scene.id]);

  const handleSave = useCallback(() => {
    onUpdate(scene.id, { title, content });
    setIsEditing(false);
  }, [scene.id, title, content, onUpdate]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--bg-2)',
        borderTop: '1px solid var(--line-1, rgba(0,0,0,0.08))',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
        padding: '20px 32px 28px',
        zIndex: 40,
        animation: 'slideUp 200ms ease-out',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {confirmDelete ? (
        /* 删除确认 */
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', maxWidth: 800, margin: '0 auto' }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--ink-0)' }}>
            删除「{scene.title || `场 ${scene.sceneNum}`}」？此操作可撤销。
          </p>
          <button
            onClick={() => { onDelete(scene.id); onClose(); }}
            style={{
              padding: '8px 16px',
              background: 'var(--danger)',
              border: 'none',
              borderRadius: '99px',
              color: '#FFF',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            确认删除
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            style={{
              padding: '8px 16px',
              background: 'var(--bg-3)',
              border: 'none',
              borderRadius: '99px',
              color: 'var(--ink-0)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            取消
          </button>
        </div>
      ) : (
        /* 详情/编辑面板 */
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', maxWidth: 900, margin: '0 auto' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  color: 'var(--accent-fg)',
                  fontSize: 14,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {scene.sceneNum}
              </span>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 600, color: 'var(--ink-0)' }}>
                {isEditing ? (
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="input-paper"
                    style={{ fontSize: 15, fontFamily: 'var(--font-serif)', fontWeight: 600, width: '100%' }}
                    autoFocus
                  />
                ) : (
                  scene.title || `场 ${scene.sceneNum}`
                )}
              </h3>
              {scriptTitle && (
                <span style={{ fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--font-sans)' }}>
                  — 来自「{scriptTitle}」
                </span>
              )}
            </div>

            <div style={{ marginBottom: '10px' }}>
              {isEditing ? (
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="input-paper"
                  style={{
                    width: '100%',
                    minHeight: 80,
                    fontSize: 13,
                    fontFamily: 'var(--font-sans)',
                    lineHeight: 1.7,
                    resize: 'vertical',
                    color: 'var(--ink-0)',
                  }}
                />
              ) : (
                scene.content ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-1)', lineHeight: 1.7, fontFamily: 'var(--font-sans)' }}>
                    {scene.content}
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>
                    暂无内容。点击编辑按钮添加。
                  </p>
                )
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    style={{
                      padding: '6px 14px',
                      background: 'var(--accent)',
                      border: 'none',
                      borderRadius: '99px',
                      color: 'var(--accent-fg)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    保存
                  </button>
                  <button
                    onClick={() => { setIsEditing(false); setTitle(scene.title); setContent(scene.content); }}
                    style={{
                      padding: '6px 14px',
                      background: 'var(--bg-3)',
                      border: 'none',
                      borderRadius: '99px',
                      color: 'var(--ink-0)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    取消
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 14px',
                    background: 'var(--bg-3)',
                    border: 'none',
                    borderRadius: '99px',
                    color: 'var(--ink-0)',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <Edit3 size={12} strokeWidth={1.6} />
                  编辑内容
                </button>
              )}
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 14px',
                  background: 'var(--danger-soft)',
                  border: 'none',
                  borderRadius: '99px',
                  color: 'var(--danger)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <Trash2 size={12} strokeWidth={1.6} />
                删除分镜
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ink-2)',
              padding: '4px',
              flexShrink: 0,
            }}
          >
            <X size={18} strokeWidth={1.6} />
          </button>
        </div>
      )}
    </div>
  );
}

interface EmptyStateProps {
  onCreateScript: () => void;
  onSwitchToCanvas: () => void;
}

function EmptyState({ onCreateScript, onSwitchToCanvas }: EmptyStateProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        color: 'var(--ink-2)',
      }}
    >
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.4 }}>
        <rect x="8" y="12" width="48" height="40" rx="6" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="16" y1="24" x2="48" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="32" x2="40" y2="32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="40" x2="44" y2="40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <p style={{ fontFamily: 'var(--font-serif)', fontSize: 16, textAlign: 'center', maxWidth: 360, lineHeight: 1.6, margin: 0 }}>
        尚无分镜卡片。
        <br />
        在画布上创建剧本节点并解析场次。
      </p>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={onSwitchToCanvas}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            background: 'var(--bg-2)',
            border: 'none',
            borderRadius: '99px',
            color: 'var(--ink-0)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: 'var(--shadow-ink-1)',
          }}
        >
          切换到画布
        </button>
        <button
          onClick={onCreateScript}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: '99px',
            color: 'var(--accent-fg)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: 'var(--shadow-ink-2)',
          }}
        >
          <BookOpen size={15} strokeWidth={1.6} />
          创建剧本节点
        </button>
      </div>
    </div>
  );
}

/** 通过 proximity heuristic 找到与 scene 关联的 image 节点缩略图 */
function findThumbnailForScene(
  scene: SceneElement,
  images: ImageElement[],
): string | undefined {
  const nearby = images.filter(img => {
    if (!img.src) return false;
    // 使用曼哈顿距离，允许 image 在 scene 的任意方向（上下左右）
    const dist = Math.abs(img.x - scene.x) + Math.abs(img.y - scene.y);
    return dist <= 300;
  });
  if (nearby.length === 0) return undefined;
  // 取最近的
  nearby.sort((a, b) => {
    const da = Math.abs(a.x - scene.x) + Math.abs(a.y - scene.y);
    const db = Math.abs(b.x - scene.x) + Math.abs(b.y - scene.y);
    return da - db;
  });
  return nearby[0].src;
}

interface StoryboardViewProps {
  onCreateScript: () => void;
  onSwitchToCanvas?: () => void;
}

export function StoryboardView({ onCreateScript, onSwitchToCanvas }: StoryboardViewProps) {
  const elements = useCanvasStore(s => s.elements);
  const updateElement = useCanvasStore(s => s.updateElement);
  const deleteElements = useCanvasStore(s => s.deleteElements);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragItemRef = useRef<SceneElement | null>(null);

  // Fix #12: Escape key deselects the active card.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedId) {
        setSelectedId(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedId]);

  const scenes = elements.filter((el): el is SceneElement => el.type === 'scene');
  const scripts = elements.filter((el): el is ScriptElement => el.type === 'script');
  const images = elements.filter((el): el is ImageElement => el.type === 'image');

  const getScriptTitle = useCallback((scriptId?: string) => {
    if (!scriptId) return '';
    const script = scripts.find(s => s.id === scriptId);
    return script?.markdown
      ? script.markdown.split('\n')[0].replace(/^#+\s*/, '').slice(0, 30) || '未命名剧本'
      : '';
  }, [scripts]);

  const sortedScenes = [...scenes].sort((a, b) => a.sceneNum - b.sceneNum);
  const selectedScene = selectedId ? scenes.find(s => s.id === selectedId) ?? null : null;

  const handleDragStart = useCallback((e: React.DragEvent, scene: SceneElement) => {
    dragItemRef.current = scene;
    setDraggingId(scene.id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, sceneId: string) => {
    e.preventDefault();
    if (sceneId !== draggingId) {
      setDragOverId(sceneId);
    }
  }, [draggingId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const draggedScene = dragItemRef.current;
    const targetSceneId = dragOverId;

    if (!draggedScene || !targetSceneId || draggedScene.id === targetSceneId) {
      setDragOverId(null);
      setDraggingId(null);
      dragItemRef.current = null;
      return;
    }

    const targetScene = scenes.find(s => s.id === targetSceneId);
    if (!targetScene) return;

    // Swap sceneNums: dragged goes to target position, displaced target gets dragged's old position.
    updateElement(draggedScene.id, { sceneNum: targetScene.sceneNum }, '重排分镜顺序');
    updateElement(targetScene.id, { sceneNum: draggedScene.sceneNum }, '重排分镜顺序');

    setDragOverId(null);
    setDraggingId(null);
    dragItemRef.current = null;
  }, [dragOverId, scenes, updateElement]);

  const handleDragEnd = useCallback(() => {
    setDragOverId(null);
    setDraggingId(null);
    dragItemRef.current = null;
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedId(null);
  }, []);

  const handleSwitchToCanvas = useCallback(() => {
    useCanvasStore.getState().setViewMode('canvas');
  }, []);

  const handleUpdate = useCallback((id: string, attrs: Partial<SceneElement>) => {
    updateElement(id, attrs);
  }, [updateElement]);

  const handleDelete = useCallback((id: string) => {
    deleteElements([id]);
  }, [deleteElements]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--bg-1)',
        overflowY: 'auto',
        paddingBottom: selectedScene ? '220px' : '40px',
      }}
    >
      {sortedScenes.length === 0 ? (
        <EmptyState
          onCreateScript={onCreateScript}
          onSwitchToCanvas={onSwitchToCanvas || handleSwitchToCanvas}
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
            alignContent: 'start',
            padding: '80px 40px 40px',
          }}
        >
          {sortedScenes.map(scene => (
            <SceneCard
              key={scene.id}
              scene={scene}
              isSelected={selectedId === scene.id}
              scriptTitle={getScriptTitle(scene.scriptId)}
              thumbnailSrc={findThumbnailForScene(scene, images)}
              onSelect={handleSelect}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              isDragOver={dragOverId === scene.id}
              isDragging={draggingId === scene.id}
            />
          ))}
        </div>
      )}

      {selectedScene && (
        <DetailPanel
          scene={selectedScene}
          scriptTitle={getScriptTitle(selectedScene.scriptId)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
