/**
 * NodeNoteOverlay — renders NodeNoteIndicator badges for elements that
 * have a note or are currently selected.
 *
 * Extracted from InfiniteCanvas L530-L552.
 */
import React from 'react';
import { NodeNoteIndicator } from '@/components/NodeNoteIndicator';
import type { CanvasElement } from '@/types/canvas';
import { getDragOffset, useDragOffsetsVersion } from '../dragOffsets';

interface NodeNoteOverlayProps {
  elements: CanvasElement[];
  selectedIds: string[];
  stageConfig: { x: number; y: number; scale: number };
}

export function NodeNoteOverlay({ elements, selectedIds, stageConfig }: NodeNoteOverlayProps) {
  useDragOffsetsVersion();

  const visible = elements.filter(el => {
    const hasNote =
      typeof (el as any).note === 'string' && (el as any).note.trim().length > 0;
    return hasNote || selectedIds.includes(el.id);
  });

  if (visible.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {visible.map(el => {
        const offset = getDragOffset(el.id);
        const ddx = offset ? offset.dx : 0;
        const ddy = offset ? offset.dy : 0;
        const canvasRightX = el.x + el.width + ddx;
        const canvasTopY = el.y + ddy - 28;
        const screenX = stageConfig.x + canvasRightX * stageConfig.scale;
        const screenY = stageConfig.y + canvasTopY * stageConfig.scale;
        return (
          <NodeNoteIndicator
            key={`note-${el.id}`}
            element={el}
            x={screenX}
            y={screenY}
            scale={stageConfig.scale}
          />
        );
      })}
    </div>
  );
}
