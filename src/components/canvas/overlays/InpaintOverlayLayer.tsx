/**
 * InpaintOverlayLayer — positions the InpaintOverlay over the target element
 * when inpaint mode is active.
 *
 * Extracted from InfiniteCanvas L510-L528.
 */
import React from 'react';
import { InpaintOverlay } from '@/components/InpaintOverlay';
import type { CanvasElement } from '@/types/canvas';
import type { InpaintMaskState } from '@/store/types';

interface InpaintOverlayLayerProps {
  elements: CanvasElement[];
  inpaintMask: InpaintMaskState;
  stageConfig: { x: number; y: number; scale: number };
}

export function InpaintOverlayLayer({ elements, inpaintMask, stageConfig }: InpaintOverlayLayerProps) {
  const target = elements.find(el => el.id === inpaintMask.elementId);
  if (!target) return null;

  const screenX = stageConfig.x + target.x * stageConfig.scale;
  const screenY = stageConfig.y + target.y * stageConfig.scale;
  const screenW = target.width * stageConfig.scale;
  const screenH = target.height * stageConfig.scale;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <InpaintOverlay
        element={target}
        x={screenX}
        y={screenY}
        width={screenW}
        height={screenH}
      />
    </div>
  );
}
