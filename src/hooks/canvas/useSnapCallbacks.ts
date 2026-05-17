import { useState, useCallback } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { findSnapTargets, type GuideLine } from '@/utils/alignmentUtils';
import type { SnapCallbacks } from '@/components/canvas/nodes/SelectionHandles';

export function useSnapCallbacks(isAltRef: React.MutableRefObject<boolean>) {
  const [guideLines, setGuideLines] = useState<GuideLine[]>([]);

  const snapOnDragMove = useCallback((id: string, dx: number, dy: number, originX: number, originY: number, width: number, height: number) => {
    const allElements = useCanvasStore.getState().elements;
    const result = findSnapTargets(id, allElements, dx, dy, width, height, originX, originY);
    setGuideLines(result.guideLines);
  }, []);

  const computeDragSnap = useCallback((
    id: string, proposedX: number, proposedY: number,
    originX: number, originY: number, width: number, height: number,
  ): { x: number; y: number } => {
    if (isAltRef.current) {
      return { x: proposedX, y: proposedY };
    }
    const allElements = useCanvasStore.getState().elements;
    const dx = proposedX - originX;
    const dy = proposedY - originY;
    const result = findSnapTargets(id, allElements, dx, dy, width, height, originX, originY);
    setGuideLines(result.guideLines);
    return { x: proposedX + result.snapDx, y: proposedY + result.snapDy };
  }, [isAltRef]);

  const snapOnDragEnd = useCallback((id: string, finalX: number, finalY: number) => {
    const allElements = useCanvasStore.getState().elements;
    const el = allElements.find(n => n.id === id);

    if (el) {
      useCanvasStore.getState().batchUpdatePositions([{ id, x: finalX, y: finalY }]);
    }

    setGuideLines([]);
  }, []);

  const snapOnResizeMove = useCallback((id: string, newX: number, newY: number, newW: number, newH: number) => {
    if (isAltRef.current) {
      useCanvasStore.getState().updateElement(id, { x: newX, y: newY, width: newW, height: newH });
      setGuideLines([]);
      return;
    }

    const allElements = useCanvasStore.getState().elements;
    const el = allElements.find(n => n.id === id);
    if (!el) return;

    const result = findSnapTargets(id, allElements, newX - el.x, newY - el.y, newW, newH, el.x, el.y);
    useCanvasStore.getState().updateElement(id, {
      x: el.x + result.snapDx,
      y: el.y + result.snapDy,
      width: newW,
      height: newH,
    });
    setGuideLines(result.guideLines);
  }, [isAltRef]);

  const snapOnResizeEnd = useCallback((id: string, finalX: number, finalY: number, finalW: number, finalH: number) => {
    useCanvasStore.getState().updateElement(id, { x: finalX, y: finalY, width: finalW, height: finalH });
    setGuideLines([]);
  }, []);

  const snapCallbacks: SnapCallbacks = {
    onDragMove: snapOnDragMove,
    onDragEnd: snapOnDragEnd,
    onResizeMove: snapOnResizeMove,
    onResizeEnd: snapOnResizeEnd,
    computeDragSnap,
  };

  return { guideLines, snapCallbacks };
}
