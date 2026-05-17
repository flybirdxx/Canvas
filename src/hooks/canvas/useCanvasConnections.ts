import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { CanvasElement, ElementType } from '@/types/canvas';
import { buildFileElement } from '@/services/fileIngest';
import { createCanvasElement } from '@/registry/createCanvasElement';
import { getDefaultNodeSize } from '@/registry/nodeRegistry';
import { findPortLayoutHit } from '@/components/canvas/interactions/portLayout';

export interface QuickAddMenuState {
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
  fromElementId?: string;
  fromPortId?: string;
  fromPortType?: string;
  isDisconnecting?: boolean;
}

export function useCanvasConnections() {
  const { addElement, setSelection, setActiveTool } = useCanvasStore();
  const [quickAddMenu, setQuickAddMenu] = useState<QuickAddMenuState | null>(null);

  function findPortUnderMouse(els: CanvasElement[], x: number, y: number, isDrawingFromOutput: boolean, fromPortType: string) {
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i];
      const hit = findPortLayoutHit({ element: el, x, y, isDrawingFromOutput, fromPortType });
      if (hit) return { element: el, port: hit.port, isInput: hit.isInput };
    }
    return null;
  }

  const handleQuickAdd = (type: Extract<ElementType, 'text' | 'image' | 'video' | 'audio'>) => {
    if (!quickAddMenu) return;

    const { height } = getDefaultNodeSize(type);
    const newEl = createCanvasElement(type, {
      x: quickAddMenu.canvasX,
      y: quickAddMenu.canvasY - height / 2,
    });
    
    addElement(newEl);
    setSelection([newEl.id]);
    setActiveTool('select');

    setTimeout(() => {
      const state = useCanvasStore.getState();
      const addedEl = state.elements.find(e => e.id === newEl.id);
      if (addedEl && quickAddMenu.fromElementId && quickAddMenu.fromPortId) {
        const targetPort = addedEl.inputs?.find(p => p.type === quickAddMenu.fromPortType || p.type === 'any' || quickAddMenu.fromPortType === 'any');
        if (targetPort) {
          state.addConnection({
            id: uuidv4(),
            fromId: quickAddMenu.fromElementId,
            fromPortId: quickAddMenu.fromPortId,
            toId: addedEl.id,
            toPortId: targetPort.id,
          });
        }
      }
    }, 50);

    setQuickAddMenu(null);
  };

  const handleQuickAddUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0 || !quickAddMenu) return;
    const canvasX = quickAddMenu.canvasX, canvasY = quickAddMenu.canvasY;
    const createdIds: string[] = [];
    for (let i = 0; i < files.length; i++) {
      try { 
        const fileEl = await buildFileElement(files[i], { x: canvasX, y: canvasY }, { dx: i * 24, dy: i * 24 }); 
        addElement(fileEl as any); 
        createdIds.push(fileEl.id); 
      }
      catch (err) { console.warn('[quickadd] file ingest failed', files[i].name, err); }
    }
    if (createdIds.length > 0) { setSelection(createdIds); setActiveTool('select'); }
    setQuickAddMenu(null);
  };

  return {
    quickAddMenu,
    setQuickAddMenu,
    findPortUnderMouse,
    handleQuickAdd,
    handleQuickAddUpload,
  };
}
