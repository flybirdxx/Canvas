/**
 * NodeVersionOverlay — renders NodeVersionSwitcher badges for selected
 * image/video elements that have ≥2 generation versions.
 *
 * Extracted from InfiniteCanvas L554-L577.
 */
import React from 'react';
import { NodeVersionSwitcher } from '@/components/NodeVersionSwitcher';
import type { CanvasElement } from '@/types/canvas';

interface NodeVersionOverlayProps {
  elements: CanvasElement[];
  selectedIds: string[];
  stageConfig: { x: number; y: number; scale: number };
}

export function NodeVersionOverlay({ elements, selectedIds, stageConfig }: NodeVersionOverlayProps) {
  const visible = elements.filter(el =>
    selectedIds.includes(el.id) &&
    (el.type === 'image' || el.type === 'video') &&
    Array.isArray((el as any).versions) &&
    (el as any).versions.length >= 2
  );

  if (visible.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {visible.map(el => {
        const canvasCx = el.x + el.width / 2;
        const canvasTop = el.y;
        const screenX = stageConfig.x + canvasCx * stageConfig.scale;
        const screenY = stageConfig.y + canvasTop * stageConfig.scale;
        return (
          <NodeVersionSwitcher
            key={`ver-${el.id}`}
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
