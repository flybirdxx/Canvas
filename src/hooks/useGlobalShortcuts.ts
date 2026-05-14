import { useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CanvasElement } from '@/types/canvas';
import { useCanvasStore } from '@/store/useCanvasStore';
import { exportSelection } from '@/utils/exportPng';

/**
 * 全局快捷键 hook。
 *
 * 从 App.tsx 提取，集中管理所有画布级键盘快捷键：
 *   - Ctrl+Z / Ctrl+Shift+Z → undo / redo
 *   - Ctrl+Y → redo
 *   - Ctrl+Shift+V → 切换 canvas/storyboard 视图
 *   - Ctrl+Shift+E → 导出选区 PNG
 *   - E（无修饰键）→ 启动框选导出
 *   - Escape → 取消选择
 *   - Ctrl+A → 全选
 *   - Ctrl+D → 复制选中
 *   - Ctrl+G / Ctrl+Shift+G → 成组 / 解组
 *   - Delete / Backspace → 删除选中
 *   - V / H / T / R / I / S → 工具切换 / 创建节点
 *   - Home → 重置视图
 *
 * 返回 `handleCreateNode` 供 chrome 组件（TopBar、ToolDock 等）复用，
 * 保证快捷键创建节点和 UI 按钮创建节点走同一逻辑。
 */
export function useGlobalShortcuts() {
  const addElement = useCanvasStore(s => s.addElement);
  const setSelection = useCanvasStore(s => s.setSelection);
  const setActiveTool = useCanvasStore(s => s.setActiveTool);

  /**
   * 在画布中心创建新节点。和原 App.tsx 中 handleCreateNode 语义一致：
   * 根据 type 计算默认尺寸、填充、文本等，在视口中心放置并自动选中。
   */
  const handleCreateNode = useCallback((type: string) => {
    const { stageConfig } = useCanvasStore.getState();
    const centerX =
      (window.innerWidth / 2 - stageConfig.x) / stageConfig.scale;
    const centerY =
      (window.innerHeight / 2 - stageConfig.y) / stageConfig.scale;

    let defaultWidth = 100;
    let defaultHeight = 100;
    if (type === 'sticky') { defaultWidth = 220; defaultHeight = 220; }
    else if (type === 'text') { defaultWidth = 420; defaultHeight = 280; }
    else if (type === 'image') { defaultWidth = 560; defaultHeight = 560; }
    else if (type === 'video') { defaultWidth = 640; defaultHeight = 360; }
    else if (type === 'audio') { defaultWidth = 360; defaultHeight = 96; }
    else if (type === 'script') { defaultWidth = 480; defaultHeight = 280; }
    else if (type === 'scene') { defaultWidth = 320; defaultHeight = 200; }

    const id = uuidv4();
    const isMedia = ['image', 'video', 'audio'].includes(type);

    addElement({
      id,
      type: type as any,
      x: centerX - defaultWidth / 2,
      y: centerY - defaultHeight / 2,
      width: defaultWidth,
      height: defaultHeight,
      text:
        type === 'sticky' ? '点击编辑便签内容…' :
        type === 'text' ? '' :
        undefined,
      fontSize: type === 'text' ? 14 : undefined,
      fontFamily: type === 'text' ? 'var(--font-serif)' : undefined,
      fill:
        type === 'rectangle' ? '#E1D7CB' :
        type === 'circle' ? '#DDD1C2' :
        type === 'sticky' ? '#F3E3A0' :
        type === 'text' ? undefined :
        undefined,
      src: isMedia ? '' : undefined,
      cornerRadius: type === 'rectangle' ? 12 : undefined,
      markdown: type === 'script' ? '' : undefined,
      scenes: type === 'script' ? [] : undefined,
      isNew: type === 'script' ? true : undefined,
      sceneNum: type === 'scene' ? 1 : undefined,
      title: type === 'scene' ? '' : undefined,
      content: type === 'scene' ? '' : undefined,
    });
    setSelection([id]);
    setActiveTool('select');
  }, [addElement, setSelection, setActiveTool]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 聚焦在输入框 / 文本域时跳过所有快捷键，让用户正常输入
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;

      // ── Ctrl/Meta 修饰复合键 ──
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const { undo, redo } = useCanvasStore.getState();
        if (e.shiftKey) redo(); else undo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        useCanvasStore.getState().redo();
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) && e.shiftKey &&
        e.key.toLowerCase() === 'v'
      ) {
        e.preventDefault();
        const { viewMode: vm, setViewMode: svm } = useCanvasStore.getState();
        svm(vm === 'canvas' ? 'storyboard' : 'canvas');
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) && e.shiftKey &&
        e.key.toLowerCase() === 'e'
      ) {
        e.preventDefault();
        exportSelection();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const { elements, setSelection: ss } = useCanvasStore.getState();
        ss(elements.map(el => el.id));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const { elements, selectedIds, addElement: ae } = useCanvasStore.getState();
        const sel = elements.filter(el => selectedIds.includes(el.id));
        sel.forEach(el => {
          const nid = uuidv4();
          ae({ ...el, id: nid, x: el.x + 24, y: el.y + 24 } as CanvasElement);
        });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        const { groupSelected, ungroupSelected } = useCanvasStore.getState();
        if (e.shiftKey) ungroupSelected(); else groupSelected();
        return;
      }

      // ── 无修饰单键 ──
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        const k = e.key.toLowerCase();

        if (k === 'e') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('canvas:start-marquee-export'));
          return;
        }

        if (e.key === 'Escape') {
          useCanvasStore.getState().setActiveTool('select');
          useCanvasStore.getState().setSelection([]);
          return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
          const { selectedIds: sids, deleteElements: de } = useCanvasStore.getState();
          if (sids.length > 0) {
            e.preventDefault();
            de(sids);
          }
          return;
        }

        if (k === 'v') { e.preventDefault(); useCanvasStore.getState().setActiveTool('select'); return; }
        if (k === 'h') { e.preventDefault(); useCanvasStore.getState().setActiveTool('hand'); return; }
        if (k === 't') { e.preventDefault(); handleCreateNode('text'); return; }
        if (k === 'r') { e.preventDefault(); handleCreateNode('rectangle'); return; }
        if (k === 'i') { e.preventDefault(); handleCreateNode('image'); return; }
        if (k === 's') { e.preventDefault(); handleCreateNode('sticky'); return; }

        if (e.key === 'Home') {
          e.preventDefault();
          useCanvasStore.getState().setStageConfig({ scale: 1, x: 0, y: 0 });
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCreateNode]);

  return { handleCreateNode };
}
