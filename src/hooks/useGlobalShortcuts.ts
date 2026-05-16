import { useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CanvasElement, ElementType } from '@/types/canvas';
import { useCanvasStore } from '@/store/useCanvasStore';
import { exportSelection } from '@/utils/exportPng';

const DEFAULT_PLANNING_BODY = [
  '一句想法：',
  '',
  '题材 / 基调：',
  '',
  '短剧方向：',
].join('\n');

export function useGlobalShortcuts() {
  const addElement = useCanvasStore(s => s.addElement);
  const setSelection = useCanvasStore(s => s.setSelection);
  const setActiveTool = useCanvasStore(s => s.setActiveTool);

  const handleCreateNode = useCallback((type: ElementType) => {
    const { stageConfig } = useCanvasStore.getState();
    const centerX = (window.innerWidth / 2 - stageConfig.x) / stageConfig.scale;
    const centerY = (window.innerHeight / 2 - stageConfig.y) / stageConfig.scale;

    const { width, height } = getDefaultSize(type);
    const id = uuidv4();
    const isMedia = type === 'image' || type === 'video' || type === 'audio';

    const element = {
      id,
      type,
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
      text: type === 'sticky' ? '点击编辑便签内容...' : type === 'text' ? '' : undefined,
      fontSize: type === 'text' ? 14 : undefined,
      fontFamily: type === 'text' ? 'var(--font-serif)' : undefined,
      fill:
        type === 'rectangle' ? '#E1D7CB' :
        type === 'circle' ? '#DDD1C2' :
        type === 'sticky' ? '#F3E3A0' :
        type === 'text' ? '#26211c' :
        undefined,
      src: isMedia ? '' : undefined,
      cornerRadius: type === 'rectangle' ? 12 : undefined,
      title:
        type === 'omniscript' ? 'OmniScript' :
        type === 'planning' ? '项目种子' :
        undefined,
      videoUrl: type === 'omniscript' ? '' : undefined,
      notes: type === 'omniscript' ? '' : undefined,
      analysisStatus: type === 'omniscript' ? 'idle' : undefined,
      result: type === 'omniscript'
        ? { segments: [], structuredScript: [], highlights: [] }
        : undefined,
      kind: type === 'planning' ? 'projectSeed' : undefined,
      body: type === 'planning' ? DEFAULT_PLANNING_BODY : undefined,
      template: type === 'planning' ? 'shortDrama' : undefined,
    } as CanvasElement;

    addElement(element);
    setSelection([id]);
    setActiveTool('select');
  }, [addElement, setSelection, setActiveTool]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) return;

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

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
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
        elements
          .filter(el => selectedIds.includes(el.id))
          .forEach(el => ae({ ...el, id: uuidv4(), x: el.x + 24, y: el.y + 24 } as CanvasElement));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        const { groupSelected, ungroupSelected } = useCanvasStore.getState();
        if (e.shiftKey) ungroupSelected(); else groupSelected();
        return;
      }

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
          const { selectedIds, deleteElements } = useCanvasStore.getState();
          if (selectedIds.length > 0) {
            e.preventDefault();
            deleteElements(selectedIds);
          }
          return;
        }

        if (k === 'v') { e.preventDefault(); useCanvasStore.getState().setActiveTool('select'); return; }
        if (k === 'h') { e.preventDefault(); useCanvasStore.getState().setActiveTool('hand'); return; }
        if (k === 't') { e.preventDefault(); handleCreateNode('text'); return; }
        if (k === 'r') { e.preventDefault(); handleCreateNode('rectangle'); return; }
        if (k === 'i') { e.preventDefault(); handleCreateNode('image'); return; }
        if (k === 's') { e.preventDefault(); handleCreateNode('sticky'); return; }
        if (k === 'o') { e.preventDefault(); handleCreateNode('omniscript'); return; }
        if (k === 'p') { e.preventDefault(); handleCreateNode('planning'); return; }

        if (e.key === 'Home') {
          e.preventDefault();
          useCanvasStore.getState().setStageConfig({ scale: 1, x: 0, y: 0 });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCreateNode]);

  return { handleCreateNode };
}

function getDefaultSize(type: ElementType): { width: number; height: number } {
  if (type === 'sticky') return { width: 220, height: 220 };
  if (type === 'text') return { width: 420, height: 280 };
  if (type === 'image') return { width: 560, height: 560 };
  if (type === 'video') return { width: 640, height: 360 };
  if (type === 'audio') return { width: 360, height: 96 };
  if (type === 'omniscript') return { width: 640, height: 440 };
  if (type === 'planning') return { width: 340, height: 260 };
  return { width: 100, height: 100 };
}
