import { useState, useEffect, useRef } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';

export function useCanvasSelection(isShiftRef: React.MutableRefObject<boolean>) {
  const { elements, selectedIds, setSelection } = useCanvasStore();
  
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const [marquee, setMarquee] = useState<{
    active: boolean;
    drawing: boolean;
    rect: { x: number; y: number; w: number; h: number } | null;
  }>({ active: false, drawing: false, rect: null });
  
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const enter = () => setMarquee({ active: true, drawing: false, rect: null });
    window.addEventListener('canvas:start-marquee-export', enter);
    return () => window.removeEventListener('canvas:start-marquee-export', enter);
  }, []);

  useEffect(() => {
    if (!marquee.active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMarquee({ active: false, drawing: false, rect: null });
        marqueeStartRef.current = null;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [marquee.active]);

  const startSelectionBox = (x: number, y: number) => {
    setSelectionBox({ startX: x, startY: y, x, y, width: 0, height: 0 });
  };

  const updateSelectionBox = (currentX: number, currentY: number) => {
    if (!selectionBox) return false;
    const newX = Math.min(selectionBox.startX, currentX);
    const newY = Math.min(selectionBox.startY, currentY);
    const newWidth = Math.abs(currentX - selectionBox.startX);
    const newHeight = Math.abs(currentY - selectionBox.startY);
    setSelectionBox({ ...selectionBox, x: newX, y: newY, width: newWidth, height: newHeight });
    return true;
  };

  const endSelectionBox = () => {
    if (!selectionBox) return false;
    
    if (selectionBox.width > 5 && selectionBox.height > 5) {
      const candidateIds = elements
        .filter(el =>
          el.x < selectionBox.x + selectionBox.width &&
          el.x + el.width > selectionBox.x &&
          el.y < selectionBox.y + selectionBox.height &&
          el.y + el.height > selectionBox.y &&
          !(el as any).isLocked
        )
        .map(el => el.id);

      if (isShiftRef.current) {
        const merged = Array.from(new Set([...selectedIds, ...candidateIds]));
        setSelection(merged);
      } else {
        setSelection(candidateIds);
      }
    } else {
      setSelection([]);
    }
    setSelectionBox(null);
    return true;
  };

  const startMarquee = (cx: number, cy: number) => {
    marqueeStartRef.current = { x: cx, y: cy };
    setMarquee({
      active: true,
      drawing: true,
      rect: { x: cx, y: cy, w: 0, h: 0 },
    });
  };

  const updateMarquee = (cx: number, cy: number) => {
    if (!marquee.active || !marquee.drawing || !marqueeStartRef.current) return false;
    const s = marqueeStartRef.current;
    setMarquee({
      active: true,
      drawing: true,
      rect: {
        x: Math.min(s.x, cx),
        y: Math.min(s.y, cy),
        w: Math.abs(cx - s.x),
        h: Math.abs(cy - s.y),
      },
    });
    return true;
  };

  const clearSelectionBox = () => { setSelectionBox(null); };

  const endMarquee = () => {
    if (marquee.active && marquee.drawing) {
      marqueeStartRef.current = null;
      if (!marquee.rect || marquee.rect.w < 4 || marquee.rect.h < 4) {
        setMarquee({ active: true, drawing: false, rect: null });
        return true;
      }
      setMarquee(m => ({ ...m, drawing: false }));
      return true;
    }
    return false;
  };

  return {
    selectionBox,
    marquee,
    setMarquee,
    startSelectionBox,
    updateSelectionBox,
    endSelectionBox,
    clearSelectionBox,
    startMarquee,
    updateMarquee,
    endMarquee,
  };
}