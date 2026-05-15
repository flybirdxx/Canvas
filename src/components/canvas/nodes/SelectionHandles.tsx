import React, { useRef } from 'react';
import { Group, Line, Rect } from 'react-konva';
import { useCanvasStore } from '@/store/useCanvasStore';

const HANDLE_HIT_SIZE = 28;
const HANDLE_VISUAL_SIZE = 16;
const HANDLE_COLOR = '#B96545';

const MIN_W = 60;
const MIN_H = 40;

interface DragStartState {
  mx: number;
  my: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

function shouldLockAspectRatio(el: any): boolean {
  if (el.type === 'image' || el.type === 'aigenerating') return true;
  if (el.type === 'file') {
    const mt = String(el.mimeType || '').toLowerCase();
    if (mt.startsWith('image/')) return true;
    if ((mt.startsWith('video/') || mt.startsWith('audio/')) && el.thumbnailDataUrl) return true;
  }
  return false;
}

export interface SnapCallbacks {
  onDragMove: (id: string, dx: number, dy: number, newX: number, newY: number, width: number, height: number) => void;
  onDragEnd: (id: string, newX: number, newY: number) => void;
  onResizeMove: (id: string, newX: number, newY: number, newW: number, newH: number) => void;
  onResizeEnd: (id: string, newX: number, newY: number, newW: number, newH: number) => void;
  computeDragSnap: (id: string, proposedX: number, proposedY: number, originX: number, originY: number, width: number, height: number) => { x: number; y: number };
}

interface SelectionHandlesProps {
  el: any;
  isSelected: boolean;
  isHovered: boolean;
  selectedCount: number;
  snapCallbacks?: SnapCallbacks;
  dragGuardRef?: React.MutableRefObject<boolean>;
}

export function SelectionHandles({
  el,
  isSelected,
  isHovered,
  selectedCount,
  snapCallbacks,
  dragGuardRef,
}: SelectionHandlesProps) {
  const { width, height } = el;
  const lockRatio = shouldLockAspectRatio(el);
  const dragStartRef = useRef<DragStartState | null>(null);
  const liveResizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const shouldShow = !el.isLocked && selectedCount <= 1 && (isSelected || isHovered);
  if (!shouldShow) return null;

  return (
    <Group
      x={width}
      y={height}
      draggable
      onMouseEnter={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'nwse-resize';
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'default';
      }}
      onPointerDown={(e) => {
        e.cancelBubble = true;
      }}
      onDragStart={(e) => {
        if (dragGuardRef) dragGuardRef.current = true;
        e.cancelBubble = true;
        const stage = e.target.getStage();
        if (!stage) return;
        const ptr = stage.getPointerPosition();
        if (!ptr) return;
        const scale = stage.scaleX();
        const stageX = stage.x();
        const stageY = stage.y();
        dragStartRef.current = {
          mx: (ptr.x - stageX) / scale,
          my: (ptr.y - stageY) / scale,
          x: el.x,
          y: el.y,
          w: el.width,
          h: el.height,
        };
        e.target.position({ x: width, y: height });
      }}
      onDragMove={(e) => {
        e.cancelBubble = true;
        const ds = dragStartRef.current;
        if (!ds) return;
        const stage = e.target.getStage();
        if (!stage) return;
        const ptr = stage.getPointerPosition();
        if (!ptr) return;
        const scale = stage.scaleX();
        const stageX = stage.x();
        const stageY = stage.y();
        const mx = (ptr.x - stageX) / scale;
        const my = (ptr.y - stageY) / scale;
        const dx = mx - ds.mx;
        const dy = my - ds.my;
        const { x: newX, y: newY, w: ow, h: oh } = ds;

        let newW = Math.max(MIN_W, ow + dx);
        let newH = Math.max(MIN_H, oh + dy);

        if (lockRatio && ow > 0 && oh > 0) {
          const aspect = ow / oh;
          const rawW = ow + dx;
          const rawH = oh + dy;
          const absDW = Math.abs(newW - ow);
          const absDH = Math.abs(newH - oh);
          if (absDW >= absDH) {
            newW = Math.max(MIN_W, rawW);
            newH = newW / aspect;
          } else {
            newH = Math.max(MIN_H, rawH);
            newW = newH * aspect;
          }
          if (newW < MIN_W) { newW = MIN_W; newH = newW / aspect; }
          if (newH < MIN_H) { newH = MIN_H; newW = newH * aspect; }
        }

        e.target.position({ x: width, y: height });

        if (snapCallbacks) {
          snapCallbacks.onResizeMove(el.id, newX, newY, newW, newH);
          liveResizeRef.current = { x: newX, y: newY, w: newW, h: newH };
        } else {
          useCanvasStore.getState().updateElement(el.id, { x: newX, y: newY, width: newW, height: newH });
        }
      }}
      onDragEnd={(e) => {
        if (dragGuardRef) dragGuardRef.current = false;
        e.cancelBubble = true;
        e.target.position({ x: width, y: height });

        if (snapCallbacks && liveResizeRef.current) {
          const { x: fx, y: fy, w: fw, h: fh } = liveResizeRef.current;
          snapCallbacks.onResizeEnd(el.id, fx, fy, fw, fh);
        }
        dragStartRef.current = null;
        liveResizeRef.current = null;
      }}
    >
      <Rect
        x={-HANDLE_HIT_SIZE}
        y={-HANDLE_HIT_SIZE}
        width={HANDLE_HIT_SIZE}
        height={HANDLE_HIT_SIZE}
        fill="rgba(0,0,0,0)"
      />
      <Line
        points={[-HANDLE_VISUAL_SIZE, -1, -1, -1, -1, -HANDLE_VISUAL_SIZE]}
        stroke={HANDLE_COLOR}
        strokeWidth={2}
        lineCap="round"
        lineJoin="round"
        opacity={isHovered ? 0.68 : 0}
        listening={false}
      />
    </Group>
  );
}
