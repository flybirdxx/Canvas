import React, { useRef, useState } from 'react';
import { Group, Line } from 'react-konva';
import { Html } from 'react-konva-utils';
import type { GuideLine } from '@/utils/alignmentUtils';
import { useCanvasStore } from '@/store/useCanvasStore';
import {
  ImageNode, TextNode, ShapeNode, StickyNode, MediaNode,
  AIGeneratingNode, FileNode, OmniScriptNode, PlanningNode,
  PortOverlay, SelectionHandles, SnapCallbacks, RunningPulse
} from './nodes';
import { GroupFrameLayer } from './GroupFrameLayer';
import { setDragOffset, clearDragOffset } from './dragOffsets';
import { resolveGroupFrame } from '@/utils/groupFrame';
import {
  getNodeDragDelta,
  resolveNodeDragBound,
  resolveNodeVisualPosition,
} from './dragController';


export interface CanvasElementsProps {
  guideLines: GuideLine[];
  snapCallbacks: SnapCallbacks;
}

export function CanvasElements({ guideLines, snapCallbacks }: CanvasElementsProps) {
  const {
    elements, selectedIds, setSelection, activeTool, drawingConnection,
  } = useCanvasStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const isDraggingOrResizingRef = useRef(false);
  const dragStartPosRef = useRef<Record<string, { x: number; y: number }>>({});

  return (
    <>
      <GroupFrameLayer dragGuardRef={isDraggingOrResizingRef} />
      {elements.map((el) => {
        const isSelected = selectedIds.includes(el.id);
        const { id, x, y, rotation, width, height } = el;

        const outerGroupProps = {
          id,
          x,
          y,
          width,
          height,
          rotation: rotation || 0,
          draggable: activeTool === 'select' && !el.isLocked && !drawingConnection,
          dragBoundFunc: (pos: { x: number; y: number }) => {
            const state = useCanvasStore.getState();
            const currentElement = state.elements.find(item => item.id === id) ?? el;
            const origin = dragStartPosRef.current[id];
            return resolveNodeDragBound({
              element: currentElement,
              proposed: pos,
              origin,
              drawingConnection: !!state.drawingConnection,
              computeSnap: snapCallbacks?.computeDragSnap,
            });
          },
          onPointerDown: (e: any) => {
            if (activeTool === 'select') {
              e.cancelBubble = true;
              const isShiftPressed = e.evt.shiftKey;
              if (isShiftPressed) {
                if (isSelected) setSelection(selectedIds.filter(selId => selId !== id));
                else setSelection([...selectedIds, id]);
              } else {
                setSelection([id]);
              }
            }
          },
          onDragStart: () => {
            isDraggingOrResizingRef.current = true;
            dragStartPosRef.current[id] = { x: el.x, y: el.y };
          },
          onDragMove: (e: any) => {
            if (e.target.id() === id) {
              // 使用 Konva 节点的当前视觉位置计算 delta —— 与 dragBoundFunc 一致。
              const visualX = e.target.x();
              const visualY = e.target.y();
              const currentEl = useCanvasStore.getState().elements.find(n => n.id === id);
              if (!currentEl) return;
              const state = useCanvasStore.getState();
              const group = state.groups.find(item => item.childIds.includes(id));
              const groupFrame = group ? resolveGroupFrame(group, state.elements) : null;
              const visualPosition = resolveNodeVisualPosition({
                element: currentEl,
                visualPosition: { x: visualX, y: visualY },
                groupFrame,
              });
              if (visualPosition.x !== visualX || visualPosition.y !== visualY) {
                e.target.position(visualPosition);
              }
              const delta = getNodeDragDelta(currentEl, visualPosition);

              // snapCallbacks.onDragMove handles snapping + updates + guideLines
              //   store 位置仅通过 onDragEnd 的 batchUpdatePositions 一次性同步
              snapCallbacks.onDragMove(id, delta.x, delta.y, currentEl.x, currentEl.y, currentEl.width, currentEl.height);

              // 实时写入拖拽偏移量 → ConnectionLines 可读取以实时跟随
              setDragOffset(id, delta.x, delta.y);

            }
          },
          onDragEnd: (e: any) => {
            isDraggingOrResizingRef.current = false;
            if (e.target.id() === id) {
              // 从 Konva 节点直接读取最终位置（含 dragBoundFunc 的 snap 偏移），
              // 避免从 store 重新计算导致的 snap 偏移丢失。
              const currentEl = useCanvasStore.getState().elements.find(n => n.id === id);
              let finalPosition = { x: e.target.x(), y: e.target.y() };
              if (currentEl) {
                const state = useCanvasStore.getState();
                const group = state.groups.find(item => item.childIds.includes(id));
                const groupFrame = group ? resolveGroupFrame(group, state.elements) : null;
                finalPosition = resolveNodeVisualPosition({
                  element: currentEl,
                  visualPosition: finalPosition,
                  groupFrame,
                });
                if (finalPosition.x !== e.target.x() || finalPosition.y !== e.target.y()) {
                  e.target.position(finalPosition);
                }
              }
              snapCallbacks.onDragEnd(id, finalPosition.x, finalPosition.y);
              // Clean up ref
              delete dragStartPosRef.current[id];
              // 清除拖拽偏移量 — store 已更新，连线回退到纯 store 位置
              clearDragOffset(id);
            }
          },
          onMouseEnter: () => { setHoveredId(id); },
          onMouseLeave: () => { setHoveredId(null); },
          onDblClick: () => {
            if (el.type === 'text') {
              window.dispatchEvent(new CustomEvent('text:edit', { detail: { id: el.id } }));
            }
          },
        };

        let nodeContent: React.JSX.Element | null = null;
        if (el.type === 'rectangle' || el.type === 'circle') {
          nodeContent = <ShapeNode el={el} />;
        } else if (el.type === 'text') {
          nodeContent = <TextNode el={el} />;
        } else if (el.type === 'image') {
          nodeContent = <ImageNode el={el} />;
        } else if (el.type === 'sticky') {
          nodeContent = <StickyNode el={el} />;
        } else if (el.type === 'aigenerating') {
          nodeContent = <AIGeneratingNode el={el} />;
        } else if (el.type === 'video' || el.type === 'audio') {
          nodeContent = <MediaNode el={el} />;
        } else if (el.type === 'file') {
          nodeContent = <FileNode el={el} />;
        } else if (el.type === 'omniscript') {
          nodeContent = <OmniScriptNode el={el} width={width} height={height} />;
        } else if (el.type === 'planning') {
          nodeContent = <PlanningNode el={el} />;
        }

        const rotOverride = rotation || 0;

        return (
          <Group key={id} {...outerGroupProps} rotation={rotOverride}>
            <PortOverlay el={el} isSelected={isSelected} hoveredId={hoveredId} />
            {nodeContent}
            <RunningPulse el={el} />
            {activeTool === 'select' && !drawingConnection && (
              <SelectionHandles
                el={el}
                isSelected={isSelected}
                isHovered={hoveredId === id}
                selectedCount={selectedIds.length}
                snapCallbacks={snapCallbacks}
                dragGuardRef={isDraggingOrResizingRef}
              />
            )}
          </Group>
        );
      })}

      <Group listening={false}>
        {guideLines.map((gl, i) => {
          if (gl.orientation === 'vertical') {
            const midY = (gl.from + gl.to) / 2;
            return (
              <Group key={`gl-${i}`} listening={false}>
                {/* AC1: dashed guide line (1px, dashed) */}
                <Line
                  points={[gl.coord, gl.from, gl.coord, gl.to]}
                  stroke="#8B5CF6"
                  strokeWidth={1}
                  dash={[5, 4]}
                  listening={false}
                />
                {/* AC3: spacing label for equal-spacing guide lines */}
                {gl.label && (
                  <Html divProps={{ style: { position: 'absolute', pointerEvents: 'none' } }}>
                    <div style={{
                      position: 'absolute',
                      left: gl.coord - 14,
                      top: midY + 4,
                      background: '#8B5CF6',
                      color: '#fff',
                      fontSize: 10,
                      fontFamily: 'monospace',
                      padding: '1px 5px',
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                      lineHeight: 1.4,
                      userSelect: 'none',
                    }}>
                      {gl.label}
                    </div>
                  </Html>
                )}
              </Group>
            );
          } else {
            const midX = (gl.from + gl.to) / 2;
            return (
              <Group key={`gl-${i}`} listening={false}>
                {/* AC1: dashed guide line (1px, dashed) */}
                <Line
                  points={[gl.from, gl.coord, gl.to, gl.coord]}
                  stroke="#8B5CF6"
                  strokeWidth={1}
                  dash={[5, 4]}
                  listening={false}
                />
                {/* AC3: spacing label for equal-spacing guide lines */}
                {gl.label && (
                  <Html divProps={{ style: { position: 'absolute', pointerEvents: 'none' } }}>
                    <div style={{
                      position: 'absolute',
                      left: midX + 4,
                      top: gl.coord - 14,
                      background: '#8B5CF6',
                      color: '#fff',
                      fontSize: 10,
                      fontFamily: 'monospace',
                      padding: '1px 5px',
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                      lineHeight: 1.4,
                      userSelect: 'none',
                    }}>
                      {gl.label}
                    </div>
                  </Html>
                )}
              </Group>
            );
          }
        })}
      </Group>
    </>
  );
}
