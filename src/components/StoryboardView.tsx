/**
 * StoryboardView — 纯 DOM 分镜卡片网格视图。
 *
 * 联动（OmniStoryboard）:
 *   - 选中状态与画布 store.selectedIds 同步
 *   - 卡片「在画布中查看」按钮 — 跳转并定位
 *   - 图片拖拽到卡片建立显式素材关联（linkedImageId）
 *   - 缩略图优先使用 linkedImageId，其次邻近搜索
 *   - E7 Story 7: Ctrl+点击多选，Shift+点击范围选择
 *   - E7 Story 8: 执行控件已移至 TopBar（方案一单行合并）
 */
import { useCanvasStore } from '@/store/useCanvasStore';
import { useState, useCallback, useRef, useEffect } from 'react';
import { BookOpen, GripVertical, Eye, ImageUp } from 'lucide-react';
import type { SceneElement, ScriptElement, ImageElement } from '@/types/canvas';
import { SceneDetailOverlay } from '@/components/canvas/SceneDetailOverlay';

interface SceneCardProps {
  scene: SceneElement;
  isSelected: boolean;
  scriptTitle: string;
  thumbnailSrc?: string;
  groupColor?: string;
  onSelect: (id: string, e?: React.MouseEvent) => void;
  onViewOnCanvas: (scene: SceneElement) => void;
  onDragStart: (e: React.DragEvent, scene: SceneElement) => void;
  onDragOver: (e: React.DragEvent, sceneId: string) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragOver: boolean;
  isDragging: boolean;
}

function SceneCard({
  scene, isSelected, scriptTitle, thumbnailSrc, groupColor,
  onSelect, onViewOnCanvas,
  onDragStart, onDragOver, onDrop, onDragEnd,
  isDragOver, isDragging,
}: SceneCardProps) {
  const title = scene.title || `场 ${scene.sceneNum}`;

  const emotionPreview = scene.lines
    ? scene.lines.filter(l => l.emotionEmoji).slice(0, 3).map(l => l.emotionEmoji!)
    : [];

  const contentPreview = (() => {
    if (scene.lines && scene.lines.length > 0) {
      const fl = scene.lines[0];
      const text = fl.role ? `${fl.role}：${fl.content}` : fl.content;
      return text.length > 80 ? text.slice(0, 80) + '…' : text;
    }
    if (scene.content) return scene.content.length > 80 ? scene.content.slice(0, 80) + '…' : scene.content;
    return '';
  })();

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, scene)}
      onDragOver={e => { e.preventDefault(); onDragOver(e, scene.id); }}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={(e) => onSelect(scene.id, e)}
      className="chip-paper"
      style={{
        padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px',
        cursor: 'pointer', transition: 'box-shadow 150ms ease, border-color 150ms ease, opacity 150ms ease',
        border: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
        background: isSelected ? 'color-mix(in srgb, var(--accent) 8%, var(--bg-1))' : 'var(--chip-bg, var(--bg-2))',
        opacity: isDragging ? 0.4 : 1,
        outline: isDragOver ? '2px dashed var(--accent)' : 'none',
        outlineOffset: '2px', userSelect: 'none', position: 'relative',
      }}
    >
      {/* Group dot */}
      {groupColor && <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', background: groupColor }} title="属于分组" />}

      {/* Action buttons */}
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
        <button
          onClick={e => { e.stopPropagation(); onViewOnCanvas(scene); }}
          title="在画布中查看"
          style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-3)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-xs)', cursor: 'pointer', color: 'var(--ink-2)' }}
        >
          <Eye size={12} strokeWidth={1.6} />
        </button>
      </div>

      {/* Drag handle */}
      <div style={{ position: 'absolute', top: 8, left: 8, color: 'var(--ink-2)', opacity: 0.5, cursor: 'grab' }} onMouseDown={e => e.stopPropagation()}>
        <GripVertical size={14} strokeWidth={1.6} />
      </div>

      {/* Thumbnail */}
      {thumbnailSrc && (
        <div style={{ width: '100%', height: 120, borderRadius: 'var(--r-sm)', overflow: 'hidden', background: 'var(--bg-3)' }}>
          <img src={thumbnailSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}

      {/* Image drop zone indicator */}
      <div
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={e => {
          e.stopPropagation();
          const imageId = e.dataTransfer.getData('text/plain');
          if (imageId) onDrop(e);
        }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          padding: thumbnailSrc ? '0' : '8px',
          fontSize: 10, color: 'var(--ink-3)', fontStyle: 'italic',
          border: '1px dashed transparent',
          borderRadius: 'var(--r-xs)',
        }}
        title="拖拽图片到此处建立素材关联"
      >
        <ImageUp size={11} strokeWidth={1.4} />
        {scene.linkedImageId ? '已关联素材' : '拖入图片关联'}
      </div>

      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', color: 'var(--accent-fg)', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{scene.sceneNum}</span>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 600, color: 'var(--ink-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{title}</span>
        {emotionPreview.length > 0 && (
          <span style={{ display: 'flex', gap: 1, fontSize: 14, flexShrink: 0, opacity: 0.85 }} title={scene.lines?.filter(l => l.emotion).map(l => `${l.role}: ${l.emotion}`).join(', ') || ''}>
            {emotionPreview.map((emoji, i) => <span key={i}>{emoji}</span>)}
          </span>
        )}
      </div>

      {contentPreview && (
        <p style={{ fontSize: 12, color: 'var(--ink-1)', lineHeight: 1.5, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', paddingLeft: 16 }}>{contentPreview}</p>
      )}
      {scriptTitle && (
        <span style={{ fontSize: 11, color: 'var(--ink-2)', fontFamily: 'var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 16 }}>来自：{scriptTitle}</span>
      )}
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function findThumbnailForScene(scene: SceneElement, images: ImageElement[]): string | undefined {
  if (scene.linkedImageId) {
    const linked = images.find(img => img.id === scene.linkedImageId);
    if (linked?.src) return linked.src;
  }
  const nearby = images.filter(img => {
    if (!img.src) return false;
    return Math.abs(img.x - scene.x) + Math.abs(img.y - scene.y) <= 300;
  });
  if (nearby.length === 0) return undefined;
  nearby.sort((a, b) => (Math.abs(a.x - scene.x) + Math.abs(a.y - scene.y)) - (Math.abs(b.x - scene.x) + Math.abs(b.y - scene.y)));
  return nearby[0].src;
}

function computeCenterOnNode(el: SceneElement, viewW: number, viewH: number) {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return { x: viewW / 2 - cx, y: viewH / 2 - cy, scale: 1 };
}

/* ── Empty State ────────────────────────────────────────────────────── */

function EmptyState({ onCreateScript, onSwitchToCanvas }: { onCreateScript: () => void; onSwitchToCanvas: () => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--ink-2)' }}>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ opacity: 0.4 }}>
        <rect x="8" y="12" width="48" height="40" rx="6" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="16" y1="24" x2="48" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="32" x2="40" y2="32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="40" x2="44" y2="40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <p style={{ fontFamily: 'var(--font-serif)', fontSize: 16, textAlign: 'center', maxWidth: 360, lineHeight: 1.6, margin: 0 }}>尚无分镜卡片。<br />在画布上创建剧本节点并解析场次。</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onSwitchToCanvas} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--bg-2)', border: 'none', borderRadius: '99px', color: 'var(--ink-0)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--shadow-ink-1)' }}>切换到画布</button>
        <button onClick={onCreateScript} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--accent)', border: 'none', borderRadius: '99px', color: 'var(--accent-fg)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--shadow-ink-2)' }}><BookOpen size={15} strokeWidth={1.6} />创建剧本节点</button>
      </div>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────── */

interface StoryboardViewProps {
  onCreateScript: () => void;
  onSwitchToCanvas?: () => void;
  /** Notify App of selected IDs so TopBar can show "生成选中" and call execute */
  onSceneSelectionIdsChange: (ids: string[]) => void;
  onExecuteAll: () => void;
  onExecuteSelected: (sceneIds: string[]) => void;
  /** Execution progress from useSceneExecution (for future inline indicators) */
  executionProgress: { done: number; total: number; current: string | null; isRunning: boolean };
}

export function StoryboardView({
  onCreateScript,
  onSwitchToCanvas,
  onSceneSelectionIdsChange,
}: StoryboardViewProps) {
  const elements = useCanvasStore(s => s.elements);
  const setSelection = useCanvasStore(s => s.setSelection);
  const updateElement = useCanvasStore(s => s.updateElement);
  const setViewMode = useCanvasStore(s => s.setViewMode);
  const setStageConfig = useCanvasStore(s => s.setStageConfig);

  // E7 Story 7: multi-select scene IDs (local state, separate from canvas store selectedIds)
  const [sceneSelectedIds, setSceneSelectedIds] = useState<string[]>([]);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragItemRef = useRef<SceneElement | null>(null);

  // Derived collections
  const scenes = elements.filter((el): el is SceneElement => el.type === 'scene');
  const scripts = elements.filter((el): el is ScriptElement => el.type === 'script');
  const images = elements.filter((el): el is ImageElement => el.type === 'image');
  const sceneIds = new Set(scenes.map(s => s.id));

  // Single-selection for detail overlay
  const selectedSceneId = sceneSelectedIds.length === 1 ? sceneSelectedIds[0] : null;
  const selectedScene = selectedSceneId ? scenes.find(s => s.id === selectedSceneId) ?? null : null;

  // Sync selection IDs to App (for TopBar "生成选中" and execute)
  useEffect(() => {
    onSceneSelectionIdsChange(sceneSelectedIds);
  }, [sceneSelectedIds, onSceneSelectionIdsChange]);

  const getScriptTitle = useCallback((scriptId?: string) => {
    if (!scriptId) return '';
    const script = scripts.find(s => s.id === scriptId);
    return script?.markdown ? script.markdown.split('\n')[0].replace(/^#+\s*/, '').slice(0, 30) || '未命名剧本' : '';
  }, [scripts]);

  const sortedScenes = [...scenes].sort((a, b) => a.sceneNum - b.sceneNum);

  const handleSwitchToCanvas = useCallback(() => {
    setViewMode('canvas');
  }, [setViewMode]);

  // ── Selection (E7 Story 7: multi-select) ────────────────────────────
  const handleSelect = useCallback((id: string, e?: React.MouseEvent) => {
    if (e?.ctrlKey || e?.metaKey) {
      if (sceneSelectedIds.includes(id)) {
        setSceneSelectedIds(sceneSelectedIds.filter(sid => sid !== id));
      } else {
        setSceneSelectedIds([...sceneSelectedIds, id]);
      }
    } else if (e?.shiftKey && sceneSelectedIds.length > 0) {
      const sorted = [...scenes].sort((a, b) => a.sceneNum - b.sceneNum);
      const lastId = sceneSelectedIds[sceneSelectedIds.length - 1];
      const lastScene = scenes.find(s => s.id === lastId);
      const currentScene = scenes.find(s => s.id === id);
      if (lastScene && currentScene) {
        const inRange = sorted.filter(
          s => s.sceneNum >= Math.min(lastScene.sceneNum, currentScene.sceneNum) &&
               s.sceneNum <= Math.max(lastScene.sceneNum, currentScene.sceneNum)
        );
        setSceneSelectedIds([...new Set([...sceneSelectedIds, ...inRange.map(s => s.id)])]);
      }
    } else {
      setSceneSelectedIds([id]);
    }
  }, [sceneSelectedIds, scenes]);

  const handleCloseOverlay = useCallback(() => {
    setSceneSelectedIds([]);
  }, []);

  // ── Drag reorder ───────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, scene: SceneElement) => {
    dragItemRef.current = scene;
    setDraggingId(scene.id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, sceneId: string) => {
    e.preventDefault();
    if (sceneId !== draggingId) setDragOverId(sceneId);
  }, [draggingId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dragged = dragItemRef.current;
    const targetId = dragOverId;
    if (!dragged || !targetId || dragged.id === targetId) { setDragOverId(null); setDraggingId(null); dragItemRef.current = null; return; }
    const target = scenes.find(s => s.id === targetId);
    if (!target) return;

    // B4: 插入式重排 — 将 dragged 移到 target 位置，中间元素顺移
    const fromNum = dragged.sceneNum;
    const toNum = target.sceneNum;

    if (fromNum < toNum) {
      // 下移：在 (fromNum, toNum] 范围内的元素 sceneNum 减 1
      for (const s of scenes) {
        if (s.id === dragged.id) continue;
        if (s.sceneNum > fromNum && s.sceneNum <= toNum) {
          updateElement(s.id, { sceneNum: s.sceneNum - 1 }, '重排分镜顺序');
        }
      }
    } else {
      // 上移：在 [toNum, fromNum) 范围内的元素 sceneNum 加 1
      for (const s of scenes) {
        if (s.id === dragged.id) continue;
        if (s.sceneNum >= toNum && s.sceneNum < fromNum) {
          updateElement(s.id, { sceneNum: s.sceneNum + 1 }, '重排分镜顺序');
        }
      }
    }
    updateElement(dragged.id, { sceneNum: toNum }, '重排分镜顺序');

    setDragOverId(null);
    setDraggingId(null);
    dragItemRef.current = null;
  }, [dragOverId, scenes, updateElement]);

  const handleDragEnd = useCallback(() => {
    setDragOverId(null);
    setDraggingId(null);
    dragItemRef.current = null;
  }, []);

  // ── View on canvas ─────────────────────────────────────────────────
  const handleViewOnCanvas = useCallback((scene: SceneElement) => {
    setSelection([scene.id]);
    const cfg = computeCenterOnNode(scene, window.innerWidth, window.innerHeight);
    setStageConfig(cfg);
    setViewMode('canvas');
  }, [setSelection, setStageConfig, setViewMode]);

  // ── Image drop to link ─────────────────────────────────────────────
  const handleImageDropOnCard = useCallback((sceneId: string, e: React.DragEvent) => {
    e.preventDefault();
    const imageId = e.dataTransfer.getData('text/plain');
    if (!imageId) return;
    const img = images.find(i => i.id === imageId);
    if (!img) return;
    updateElement(sceneId, { linkedImageId: imageId });
  }, [images, updateElement]);

  // ── Escape key — deselect ─────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedSceneId) setSceneSelectedIds([]);
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [selectedSceneId]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-1)', overflowY: 'auto' }}>
      {/* Grid: paddingTop 80px = single unified TopBar height (top:16 + ~48px bar + 16px gap) */}
      {sortedScenes.length === 0 ? (
        <EmptyState onCreateScript={onCreateScript} onSwitchToCanvas={onSwitchToCanvas || handleSwitchToCanvas} />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
          alignContent: 'start',
          padding: '80px 40px 56px',
        }}>
          {sortedScenes.map(scene => (
            <SceneCard
              key={scene.id}
              scene={scene}
              isSelected={sceneSelectedIds.includes(scene.id)}
              scriptTitle={getScriptTitle(scene.scriptId)}
              thumbnailSrc={findThumbnailForScene(scene, images)}
              onSelect={handleSelect}
              onViewOnCanvas={handleViewOnCanvas}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={(e) => handleImageDropOnCard(scene.id, e)}
              onDragEnd={handleDragEnd}
              isDragOver={dragOverId === scene.id}
              isDragging={draggingId === scene.id}
            />
          ))}
        </div>
      )}

      {selectedScene && (
        <SceneDetailOverlay
          scene={selectedScene}
          scriptTitle={getScriptTitle(selectedScene.scriptId)}
          onClose={handleCloseOverlay}
        />
      )}
    </div>
  );
}
