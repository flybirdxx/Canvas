/**
 * SelectionRects — Konva rendering of selection box and marquee rect.
 *
 * Extracted from InfiniteCanvas to isolate pure-visual selection feedback.
 */
import React from 'react';
import { Rect } from 'react-konva';

// ── Selection box (drag-select) ──────────────────────────────────────

interface SelectionBoxProps {
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scale: number;
}

export const SelectionBoxRect = React.memo(function SelectionBoxRect({ box, scale }: SelectionBoxProps) {
  if (box.width <= 0 || box.height <= 0) return null;
  return (
    <Rect
      x={box.x}
      y={box.y}
      width={box.width}
      height={box.height}
      fill="rgba(59,130,246,0.08)"
      stroke="#3B82F6"
      strokeWidth={1.2 / scale}
      dash={[6 / scale, 5 / scale]}
      cornerRadius={4 / scale}
    />
  );
});

// ── Marquee rect (export region) ─────────────────────────────────────

interface MarqueeRectProps {
  rect: { x: number; y: number; w: number; h: number };
  scale: number;
}

export const MarqueeRect = React.memo(function MarqueeRect({ rect, scale }: MarqueeRectProps) {
  if (rect.w <= 0 || rect.h <= 0) return null;
  return (
    <Rect
      x={rect.x}
      y={rect.y}
      width={rect.w}
      height={rect.h}
      fill="rgba(198, 118, 84, 0.08)"
      stroke="#C67654"
      strokeWidth={1.2 / scale}
      dash={[6 / scale, 5 / scale]}
    />
  );
});
