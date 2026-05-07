import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCanvasStore } from '../../store/useCanvasStore';
import type { CanvasElement } from '../../types/canvas';
import { buildFileElement } from '../../services/fileIngest';

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
  const { elements, addElement, setSelection, setActiveTool, addConnection } = useCanvasStore();
  const [quickAddMenu, setQuickAddMenu] = useState<QuickAddMenuState | null>(null);

  function findPortUnderMouse(els: CanvasElement[], x: number, y: number, isDrawingFromOutput: boolean, fromPortType: string) {
    const portThreshold = 20;
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i];
      const isInsideNode = x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height;

      if (isDrawingFromOutput && el.inputs) {
        const spacing = el.height / (el.inputs.length + 1);
        for (let j = 0; j < el.inputs.length; j++) {
          const portX = el.x;
          const portY = el.y + spacing * (j + 1);
          if (Math.hypot(portX - x, portY - y) < portThreshold) {
            return { element: el, port: el.inputs[j], isInput: true };
          }
        }
        
        if (isInsideNode) {
          const compatiblePort = el.inputs.find(p => p.type === 'any' || fromPortType === 'any' || p.type === fromPortType);
          if (compatiblePort) {
            return { element: el, port: compatiblePort, isInput: true };
          }
        }
      } else if (!isDrawingFromOutput && el.outputs) {
        const spacing = el.height / (el.outputs.length + 1);
        for (let j = 0; j < el.outputs.length; j++) {
          const portX = el.x + el.width;
          const portY = el.y + spacing * (j + 1);
          if (Math.hypot(portX - x, portY - y) < portThreshold) {
            return { element: el, port: el.outputs[j], isInput: false };
          }
        }

        if (isInsideNode) {
          const compatiblePort = el.outputs.find(p => p.type === 'any' || fromPortType === 'any' || p.type === fromPortType);
          if (compatiblePort) {
            return { element: el, port: compatiblePort, isInput: false };
          }
        }
      }
    }
    return null;
  }

  const handleQuickAdd = (type: 'text' | 'image' | 'video' | 'audio') => {
    if (!quickAddMenu) return;

    let defaultWidth = 560;
    let defaultHeight = 560;
    if (type === 'text') { defaultWidth = 420; defaultHeight = 280; }
    else if (type === 'video') { defaultWidth = 640; defaultHeight = 360; }
    else if (type === 'audio') { defaultWidth = 360; defaultHeight = 96; }

    const id = uuidv4();
    const newEl: any = { 
      id, 
      type, 
      x: quickAddMenu.canvasX, 
      y: quickAddMenu.canvasY - defaultHeight / 2,
      width: defaultWidth, 
      height: defaultHeight, 
      text: type === 'text' ? '' : undefined,
      fontSize: type === 'text' ? 14 : undefined,
      fontFamily: type === 'text' ? 'sans-serif' : undefined,
      fill: type === 'text' ? '#1f2937' : undefined, 
      src: type !== 'text' ? '' : undefined,
    };
    
    addElement(newEl);
    setSelection([id]);
    setActiveTool('select');

    setTimeout(() => {
      const state = useCanvasStore.getState();
      const addedEl = state.elements.find(e => e.id === id);
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
