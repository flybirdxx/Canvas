import React, { useRef } from 'react';
import { Group, Line, Rect } from 'react-konva';
import { useCanvasStore } from '@/store/useCanvasStore';
import { resolveNodeResize, shouldLockNodeAspectRatio } from '../interactions/resizeGeometry';

const HANDLE_HIT_SIZE = 28;
const HANDLE_VISUAL_SIZE = 16;
const HANDLE_COLOR = '#B96545';

interface DragStartState {
  mx: number;
  my: number;
  x: number;
  y: number;
  w: number;
  h: number;
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
  const lockRatio = shouldLockNodeAspectRatio(el);
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
        const resized = resolveNodeResize({
          start: { x: ds.x, y: ds.y, width: ds.w, height: ds.h },
          delta: { x: dx, y: dy },
          lockAspectRatio: lockRatio,
        });

        e.target.position({ x: width, y: height });

        if (snapCallbacks) {
          snapCallbacks.onResizeMove(el.id, resized.x, resized.y, resized.width, resized.height);
          liveResizeRef.current = { x: resized.x, y: resized.y, w: resized.width, h: resized.height };
        } else {
          useCanvasStore.getState().updateElement(el.id, {
            x: resized.x,
            y: resized.y,
            width: resized.width,
            height: resized.height,
          });
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
