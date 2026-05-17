/**
 * NodeInputBarOverlay — positions NodeInputBar beneath each selected
 * generative element, mapping canvas coordinates to screen pixels.
 *
 * Extracted from InfiniteCanvas L478-L508.
 */
import React from 'react';
import { NodeInputBar } from '@/components/NodeInputBar';
import type { CanvasElement } from '@/types/canvas';
import { getDragOffset } from '../dragOffsets';

const INPUT_BAR_MIN_WIDTH_BY_TYPE: Record<string, number> = {
  text: 260,
  image: 400,
  video: 460,
  audio: 360,
  aigenerating: 400,
};
const INPUT_BAR_MIN_WIDTH_FALLBACK = 260;
const INPUT_BAR_GAP_CANVAS = 6;

interface NodeInputBarOverlayProps {
  elements: CanvasElement[];
  selectedIds: string[];
  stageConfig: { x: number; y: number; scale: number };
}

export function NodeInputBarOverlay({ elements, selectedIds, stageConfig }: NodeInputBarOverlayProps) {
  const visible = elements.filter(el =>
    selectedIds.includes(el.id) &&
    (el.type === 'image' || el.type === 'video' || el.type === 'audio' || el.type === 'text' ||
      (el.type === 'aigenerating' && !!(el as any).error))
  );

  if (visible.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {visible.map(el => {
        const barMin = INPUT_BAR_MIN_WIDTH_BY_TYPE[el.type] ?? INPUT_BAR_MIN_WIDTH_FALLBACK;
        const canvasWidth = Math.max(el.width, barMin);
        const canvasX = el.x - (canvasWidth - el.width) / 2;
        const canvasY = el.y + el.height + INPUT_BAR_GAP_CANVAS;
        const offset = getDragOffset(el.id);
        const ddx = offset ? offset.dx : 0;
        const ddy = offset ? offset.dy : 0;
        const screenX = stageConfig.x + (canvasX + ddx) * stageConfig.scale;
        const screenY = stageConfig.y + (canvasY + ddy) * stageConfig.scale;
        return (
          <NodeInputBar
            key={`input-${el.id}`}
            element={el}
            x={screenX}
            y={screenY}
            width={canvasWidth}
            scale={stageConfig.scale}
          />
        );
      })}
    </div>
  );
}
