import React, { useRef, useState } from 'react';
import { Group, Line, Rect, Text } from 'react-konva';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { GroupFrame } from '@/utils/groupFrame';
import {
  GROUP_FRAME_MIN_HEIGHT,
  GROUP_FRAME_MIN_WIDTH,
  resolveGroupFrame,
} from '@/utils/groupFrame';
import { clearGroupDragOffsets, setGroupDragOffsets } from './dragOffsets';
import { getFrameDragDelta, getGroupChildDragOffsets } from './dragController';

const FRAME_STROKE = '#C68A36';
const FRAME_FILL = 'rgba(198, 138, 54, 0.045)';
const HANDLE_HIT_SIZE = 28;
const HANDLE_VISUAL_SIZE = 16;

interface GroupFrameLayerProps {
  dragGuardRef?: React.MutableRefObject<boolean>;
}

export function GroupFrameLayer({ dragGuardRef }: GroupFrameLayerProps) {
  const {
    elements,
    groups,
    selectedIds,
    activeTool,
    drawingConnection,
    setSelection,
    moveGroupBy,
    setGroupFrame,
  } = useCanvasStore();
  const [liveFrames, setLiveFrames] = useState<Record<string, GroupFrame>>({});
  const dragStartRef = useRef<Record<string, GroupFrame>>({});

  if (groups.length === 0) return null;

  return (
    <Group>
      {groups.map(group => {
        const resolvedFrame = resolveGroupFrame(group, elements);
        if (!resolvedFrame) return null;
        const frame = liveFrames[group.id] ?? resolvedFrame;
        const isSelected = group.childIds.some(id => selectedIds.includes(id));
        const canInteract = activeTool === 'select' && !drawingConnection;

        return (
          <Group
            key={group.id}
            x={frame.x}
            y={frame.y}
            draggable={canInteract}
            onPointerDown={(event) => {
              event.cancelBubble = true;
              setSelection(group.childIds);
            }}
            onDragStart={(event) => {
              if (dragGuardRef) dragGuardRef.current = true;
              event.cancelBubble = true;
              dragStartRef.current[group.id] = frame;
            }}
            onDragMove={(event) => {
              event.cancelBubble = true;
              const start = dragStartRef.current[group.id];
              if (!start) return;
              const delta = getFrameDragDelta(start, {
                x: event.currentTarget.x(),
                y: event.currentTarget.y(),
              });
              const stage = event.currentTarget.getStage();
              if (!stage) return;
              const deltas = getGroupChildDragOffsets(group.childIds, elements, delta);
              for (const childId of group.childIds) {
                const child = elements.find(element => element.id === childId);
                const childNode = stage.findOne('#' + childId);
                if (child && childNode) {
                  childNode.position({ x: child.x + delta.x, y: child.y + delta.y });
                }
              }
              if (deltas.length > 0) setGroupDragOffsets(deltas);
            }}
            onDragEnd={(event) => {
              if (dragGuardRef) dragGuardRef.current = false;
              event.cancelBubble = true;
              const start = dragStartRef.current[group.id];
              if (!start) return;
              const delta = getFrameDragDelta(start, {
                x: event.currentTarget.x(),
                y: event.currentTarget.y(),
              });
              event.currentTarget.position({ x: start.x, y: start.y });
              clearGroupDragOffsets(group.childIds);
              delete dragStartRef.current[group.id];
              if (delta.x !== 0 || delta.y !== 0) moveGroupBy(group.id, delta.x, delta.y);
            }}
          >
            <Rect
              width={frame.width}
              height={frame.height}
              fill={FRAME_FILL}
              stroke={FRAME_STROKE}
              strokeWidth={isSelected ? 1.6 : 1.1}
              dash={[8, 5]}
              cornerRadius={12}
              opacity={isSelected ? 1 : 0.58}
            />
            {group.label && (
              <Text
                x={12}
                y={-21}
                text={group.label}
                fontSize={11}
                fill={FRAME_STROKE}
                listening={false}
              />
            )}
            <Group
              x={frame.width}
              y={frame.height}
              draggable={canInteract}
              onPointerDown={(event) => {
                event.cancelBubble = true;
                setSelection(group.childIds);
              }}
              onDragStart={(event) => {
                if (dragGuardRef) dragGuardRef.current = true;
                event.cancelBubble = true;
              }}
              onDragMove={(event) => {
                event.cancelBubble = true;
                const newWidth = Math.max(GROUP_FRAME_MIN_WIDTH, event.target.x());
                const newHeight = Math.max(GROUP_FRAME_MIN_HEIGHT, event.target.y());
                event.target.position({ x: newWidth, y: newHeight });
                setLiveFrames(current => ({
                  ...current,
                  [group.id]: { ...frame, width: newWidth, height: newHeight },
                }));
              }}
              onDragEnd={(event) => {
                if (dragGuardRef) dragGuardRef.current = false;
                event.cancelBubble = true;
                const finalFrame = {
                  ...frame,
                  width: Math.max(GROUP_FRAME_MIN_WIDTH, event.target.x()),
                  height: Math.max(GROUP_FRAME_MIN_HEIGHT, event.target.y()),
                };
                event.target.position({ x: finalFrame.width, y: finalFrame.height });
                setLiveFrames(current => {
                  const { [group.id]: _removed, ...rest } = current;
                  return rest;
                });
                setGroupFrame(group.id, finalFrame);
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
                stroke={FRAME_STROKE}
                strokeWidth={2}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
            </Group>
          </Group>
        );
      })}
    </Group>
  );
}
