import React, { useRef, useState } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { CanvasElement } from '../types/canvas';

export interface InpaintOverlayProps {
  element: CanvasElement;
  /** Top-left of the target node's rendered box, in SCREEN coords (px). */
  x: number;
  y: number;
  /** Rendered width/height in SCREEN pixels (already multiplied by stage scale). */
  width: number;
  height: number;
}

/**
 * F15: DOM overlay that sits exactly on top of the target image node and
 * captures a single rectangular selection via mouse drag. Rectangle is
 * stored in NORMALIZED [0..1] coords on the canvas store so the eventual
 * mask-PNG generation is resolution-independent.
 *
 * Visual model:
 *   - A full-coverage darkening rectangle outside the selection.
 *   - The selection area reads through (transparent, bright border).
 *   - Live preview while dragging; committed on mouse-up.
 *
 * Click-anywhere restarts the drag, which overwrites the previous rect —
 * simpler than editable handles for an MVP that only supports one region.
 */
export function InpaintOverlay({ element, x, y, width, height }: InpaintOverlayProps) {
  const inpaintMask = useCanvasStore(s => s.inpaintMask);
  const setInpaintMask = useCanvasStore(s => s.setInpaintMask);

  // Local drag state in SCREEN pixels relative to the overlay origin.
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragNow, setDragNow] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // If this overlay's element isn't the active inpaint target, don't render.
  if (!inpaintMask || inpaintMask.elementId !== element.id) return null;

  // Screen-pixel rect for rendering: live drag rect takes precedence, then
  // the committed rect converted from normalized to screen coords.
  const liveRect =
    dragStart && dragNow
      ? {
          x: Math.min(dragStart.x, dragNow.x),
          y: Math.min(dragStart.y, dragNow.y),
          w: Math.abs(dragNow.x - dragStart.x),
          h: Math.abs(dragNow.y - dragStart.y),
        }
      : inpaintMask.rect
        ? {
            x: inpaintMask.rect.x * width,
            y: inpaintMask.rect.y * height,
            w: inpaintMask.rect.w * width,
            h: inpaintMask.rect.h * height,
          }
        : null;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setDragStart({ x: px, y: py });
    setDragNow({ x: px, y: py });
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = Math.max(0, Math.min(width, e.clientX - rect.left));
    const py = Math.max(0, Math.min(height, e.clientY - rect.top));
    setDragNow({ x: px, y: py });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart || !dragNow) {
      setDragStart(null);
      setDragNow(null);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const px = Math.min(dragStart.x, dragNow.x);
    const py = Math.min(dragStart.y, dragNow.y);
    const pw = Math.abs(dragNow.x - dragStart.x);
    const ph = Math.abs(dragNow.y - dragStart.y);
    // Ignore tiny rectangles (accidental clicks) — require at least 4% of
    // each side so the user can't submit with a zero-area mask.
    if (pw / width < 0.04 || ph / height < 0.04) {
      setDragStart(null);
      setDragNow(null);
      return;
    }
    setInpaintMask({
      elementId: element.id,
      rect: {
        x: px / width,
        y: py / height,
        w: pw / width,
        h: ph / height,
      },
    });
    setDragStart(null);
    setDragNow(null);
  };

  return (
    <div
      ref={containerRef}
      className="absolute pointer-events-auto select-none"
      style={{
        left: x,
        top: y,
        width,
        height,
        cursor: 'crosshair',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onMouseDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      {/* Without a rect: full-coverage darken + hint badge */}
      {!liveRect && (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'color-mix(in oklch, var(--ink-0) 42%, transparent)' }}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="chip-paper mono"
              style={{
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 500,
                borderRadius: 'var(--r-pill)',
                background: 'var(--accent)',
                color: 'var(--accent-fg)',
                border: 'none',
                boxShadow: 'var(--shadow-ink-2)',
              }}
            >
              拖拽框选要重绘的区域
            </div>
          </div>
        </>
      )}

      {/* With a rect: four darken strips around the selection */}
      {liveRect && (
        <>
          {(() => {
            const darkBg = 'color-mix(in oklch, var(--ink-0) 40%, transparent)';
            return (
              <>
                <div
                  className="absolute pointer-events-none"
                  style={{ left: 0, top: 0, width: '100%', height: liveRect.y, background: darkBg }}
                />
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: 0,
                    top: liveRect.y,
                    width: liveRect.x,
                    height: liveRect.h,
                    background: darkBg,
                  }}
                />
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: liveRect.x + liveRect.w,
                    top: liveRect.y,
                    width: Math.max(0, width - (liveRect.x + liveRect.w)),
                    height: liveRect.h,
                    background: darkBg,
                  }}
                />
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: 0,
                    top: liveRect.y + liveRect.h,
                    width: '100%',
                    height: Math.max(0, height - (liveRect.y + liveRect.h)),
                    background: darkBg,
                  }}
                />
              </>
            );
          })()}
          <div
            className="absolute pointer-events-none"
            style={{
              left: liveRect.x,
              top: liveRect.y,
              width: liveRect.w,
              height: liveRect.h,
              border: '2px dashed var(--accent)',
              filter: 'url(#ink-wobble)',
            }}
          />
          <div
            className="absolute pointer-events-none mono"
            style={{
              left: liveRect.x + 4,
              top: Math.max(4, liveRect.y - 22),
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 'var(--r-sm)',
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
              boxShadow: 'var(--shadow-ink-1)',
            }}
          >
            {Math.round(liveRect.w)}×{Math.round(liveRect.h)}
            {' · '}
            {Math.round(((liveRect.w * liveRect.h) / (width * height)) * 100)}%
          </div>
        </>
      )}
    </div>
  );
}
