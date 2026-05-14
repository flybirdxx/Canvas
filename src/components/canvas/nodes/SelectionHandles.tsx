import React, { useRef } from 'react';
import { Circle } from 'react-konva';
import { useCanvasStore } from '@/store/useCanvasStore';
import { INK_1 } from './shared';

const HANDLE_SIZE = 10;
const HANDLE_HALF = HANDLE_SIZE / 2;

type Corner = 'tl' | 'tr' | 'bl' | 'br';

const MIN_W = 60;
const MIN_H = 40;

/** Per-member snapshot captured when a group resize begins. */
interface GroupMemberSnapshot {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DragStartState {
  mx: number;
  my: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** AC3.5: snapshots of all group members when this node belongs to a selected group. */
  groupMembers?: GroupMemberSnapshot[];
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

export function SelectionHandles({ 
  el, 
  snapCallbacks, 
  dragGuardRef 
}: { 
  el: any; 
  snapCallbacks?: SnapCallbacks; 
  dragGuardRef?: React.MutableRefObject<boolean> 
}) {
  const { x, y, width, height } = el;
  const lockRatio = shouldLockAspectRatio(el);
  const dragStartRef = useRef<DragStartState | null>(null);
  const liveResizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const corners: { corner: Corner; cx: number; cy: number }[] = [
    { corner: 'tl', cx: x,         cy: y },
    { corner: 'tr', cx: x + width, cy: y },
    { corner: 'bl', cx: x,         cy: y + height },
    { corner: 'br', cx: x + width, cy: y + height },
  ];

  return (
    <>
      {corners.map(({ corner, cx, cy }) => (
        <Circle
          key={corner}
          x={cx}
          y={cy}
          radius={HANDLE_HALF}
          fill="#FFFFFF"
          stroke={INK_1}
          strokeWidth={1}
          opacity={0.6}
          draggable
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

            // ── AC3.5: group proportional resize detection ──────────
            const store = useCanvasStore.getState();
            const group = store.groups.find(g => g.childIds.includes(el.id));
            if (group) {
              const allSelected = group.childIds.every(cid => store.selectedIds.includes(cid));
              if (allSelected && group.childIds.length > 1) {
                dragStartRef.current.groupMembers = store.elements
                  .filter(e => group.childIds.includes(e.id))
                  .map(m => ({ id: m.id, x: m.x, y: m.y, w: m.width, h: m.height }));
              }
            }

            e.target.x(cx);
            e.target.y(cy);
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
            const { x: ox, y: oy, w: ow, h: oh } = ds;

            let newX = ox, newY = oy, newW = ow, newH = oh;

            if (lockRatio && ow > 0 && oh > 0) {
              const aspect = ow / oh;
              let rawW = ow;
              let rawH = oh;
              if (corner === 'tl') { rawW = ow - dx; rawH = oh - dy; }
              if (corner === 'tr') { rawW = ow + dx; rawH = oh - dy; }
              if (corner === 'bl') { rawW = ow - dx; rawH = oh + dy; }
              if (corner === 'br') { rawW = ow + dx; rawH = oh + dy; }

              const absDW = Math.abs(rawW - ow);
              const absDH = Math.abs(rawH - oh);
              if (absDW >= absDH) {
                newW = Math.max(MIN_W, rawW);
                newH = newW / aspect;
              } else {
                newH = Math.max(MIN_H, rawH);
                newW = newH * aspect;
              }
              if (newW < MIN_W) { newW = MIN_W; newH = newW / aspect; }
              if (newH < MIN_H) { newH = MIN_H; newW = newH * aspect; }

              switch (corner) {
                case 'tl': newX = ox + ow - newW; newY = oy + oh - newH; break;
                case 'tr': newY = oy + oh - newH; break;
                case 'bl': newX = ox + ow - newW; break;
                case 'br': break;
              }
            } else {
              if (corner === 'tl') { newX = ox + dx; newY = oy + dy; newW = Math.max(MIN_W, ow - dx); newH = Math.max(MIN_H, oh - dy); }
              if (corner === 'tr') { newY = oy + dy; newW = Math.max(MIN_W, ow + dx); newH = Math.max(MIN_H, oh - dy); }
              if (corner === 'bl') { newX = ox + dx; newW = Math.max(MIN_W, ow - dx); newH = Math.max(MIN_H, oh + dy); }
              if (corner === 'br') { newW = Math.max(MIN_W, ow + dx); newH = Math.max(MIN_H, oh + dy); }
            }

            // ── AC3.5: propagate proportional scale to group members ──
            if (ds.groupMembers && ds.groupMembers.length > 1 && ow > 0 && oh > 0) {
              const scaleX = newW / ow;
              const scaleY = newH / oh;

              // Pivot = opposite corner of the primary node (anchor stays fixed)
              let pivotX: number, pivotY: number;
              switch (corner) {
                case 'tl': pivotX = ox + ow; pivotY = oy + oh; break;
                case 'tr': pivotX = ox;      pivotY = oy + oh; break;
                case 'bl': pivotX = ox + ow; pivotY = oy;      break;
                case 'br': pivotX = ox;      pivotY = oy;      break;
              }

              for (const member of ds.groupMembers) {
                if (member.id === el.id) continue;
                const mNewX = pivotX + (member.x - pivotX) * scaleX;
                const mNewY = pivotY + (member.y - pivotY) * scaleY;
                const mNewW = Math.max(MIN_W, member.w * scaleX);
                const mNewH = Math.max(MIN_H, member.h * scaleY);
                useCanvasStore.getState().updateElement(member.id, {
                  x: mNewX, y: mNewY, width: mNewW, height: mNewH,
                });
              }
            }

            e.target.x(cx);
            e.target.y(cy);

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
            e.target.x(cx);
            e.target.y(cy);

            // AC3.5: group member positions were already committed live during
            // onDragMove via individual updateElement calls. Undo coalescing
            // (same-key 500ms window) bundles them into one undo point.

            if (snapCallbacks && liveResizeRef.current) {
              const { x: fx, y: fy, w: fw, h: fh } = liveResizeRef.current;
              snapCallbacks.onResizeEnd(el.id, fx, fy, fw, fh);
            }
            dragStartRef.current = null;
            liveResizeRef.current = null;
          }}
        />
      ))}
    </>
  );
}
