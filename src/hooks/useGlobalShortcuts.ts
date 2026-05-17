import { useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CanvasElement, ElementType } from '@/types/canvas';
import { useCanvasStore } from '@/store/useCanvasStore';
import { exportSelection } from '@/utils/exportPng';
import { createCanvasElement } from '@/registry/createCanvasElement';
import { getDefaultNodeSize } from '@/registry/nodeRegistry';

export function useGlobalShortcuts() {
  const addElement = useCanvasStore(s => s.addElement);
  const setSelection = useCanvasStore(s => s.setSelection);
  const setActiveTool = useCanvasStore(s => s.setActiveTool);

  const handleCreateNode = useCallback((type: ElementType) => {
    const { stageConfig } = useCanvasStore.getState();
    const centerX = (window.innerWidth / 2 - stageConfig.x) / stageConfig.scale;
    const centerY = (window.innerHeight / 2 - stageConfig.y) / stageConfig.scale;

    const { width, height } = getDefaultNodeSize(type);
    const element = createCanvasElement(type, {
      x: centerX - width / 2,
      y: centerY - height / 2,
    });

    addElement(element);
    setSelection([element.id]);
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
