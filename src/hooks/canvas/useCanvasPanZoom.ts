import { useRef } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useCanvasStore } from '@/store/useCanvasStore';

export function useCanvasPanZoom() {
  const { setStageConfig } = useCanvasStore();
  const isPanningRef = useRef(false);
  const lastPanPositionRef = useRef({ x: 0, y: 0 });

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    
    const scaleBy = 1.05;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    if (newScale < 0.1 || newScale > 5) return;

    setStageConfig({
      scale: newScale,
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const startPan = (clientX: number, clientY: number) => {
    isPanningRef.current = true;
    lastPanPositionRef.current = { x: clientX, y: clientY };
  };

  const updatePan = (stage: any, clientX: number, clientY: number) => {
    if (!isPanningRef.current) return false;
    const dx = clientX - lastPanPositionRef.current.x;
    const dy = clientY - lastPanPositionRef.current.y;
    setStageConfig({ x: stage.x() + dx, y: stage.y() + dy });
    lastPanPositionRef.current = { x: clientX, y: clientY };
    return true;
  };

  const endPan = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return true;
    }
    return false;
  };

  return {
    handleWheel,
    startPan,
    updatePan,
    endPan,
    isPanningRef,
  };
}
