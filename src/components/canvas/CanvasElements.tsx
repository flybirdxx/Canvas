import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Group, Rect, Line } from 'react-konva';
import { Html } from 'react-konva-utils';
import type { GuideLine } from '@/utils/alignmentUtils';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { CanvasElement, ScriptElement, SceneElement } from '@/types/canvas';
import {
  ImageNode, TextNode, ShapeNode, StickyNode, MediaNode,
  AIGeneratingNode, FileNode, ScriptNode, SceneNode,
  PortOverlay, SelectionHandles, SnapCallbacks, RunningPulse
} from './nodes';
import { INK_1 } from './nodes/shared';
import { useStoryboardSync } from '@/hooks/canvas/useStoryboardSync';
import { setDragOffset, clearDragOffset, setGroupDragOffsets, clearGroupDragOffsets } from './dragOffsets';


export interface CanvasElementsProps {
  guideLines: GuideLine[];
  snapCallbacks: SnapCallbacks;
}

export function CanvasElements({ guideLines, snapCallbacks }: CanvasElementsProps) {
  const {
    elements, selectedIds, setSelection, deleteElements, activeTool, drawingConnection, groups,
  } = useCanvasStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const isDraggingOrResizingRef = useRef(false);
  const dragStartPosRef = useRef<Record<string, { x: number; y: number }>>({});

  const { flushSync } = useStoryboardSync(isDraggingOrResizingRef);

  // 预计算选中编组成员 ID 集合，避免渲染循环中 O(N*G) 的嵌套查找
  const selectedGroupMemberIds = useMemo(() => {
    const selectedGroups = groups.filter(g => g.childIds.some(id => selectedIds.includes(id)));
    return new Set(selectedGroups.flatMap(g => g.childIds));
  }, [groups, selectedIds]);

  return (
    <>
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
            if (useCanvasStore.getState().drawingConnection) return { x, y };
            // FR1 吸附：Konva 层 snap，不更新 store → 消除 React props 覆盖拖拽态的闪烁
            const origin = dragStartPosRef.current[id];
            if (snapCallbacks?.computeDragSnap && origin) {
              return snapCallbacks.computeDragSnap(
                id, pos.x, pos.y, origin.x, origin.y, width, height,
              );
            }
            return pos;
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
            // FR1 编组节点：同时捕获所有兄弟节点的起始位置。
            const group = useCanvasStore.getState().groups.find(g => g.childIds.includes(id));
            if (group && group.childIds.length <= 50) {
              for (const sid of group.childIds) {
                if (sid === id) continue;
                const sibling = useCanvasStore.getState().elements.find(e => e.id === sid);
                if (sibling) dragStartPosRef.current[sid] = { x: sibling.x, y: sibling.y };
              }
            }
          },
          onDragMove: (e: any) => {
            if (e.target.id() === id) {
              // 使用 Konva 节点的当前视觉位置计算 delta —— 与 dragBoundFunc 一致。
              const visualX = e.target.x();
              const visualY = e.target.y();
              const currentEl = useCanvasStore.getState().elements.find(n => n.id === id);
              if (!currentEl) return;
              const dx = visualX - currentEl.x;
              const dy = visualY - currentEl.y;

              // snapCallbacks.onDragMove handles snapping + updates + guideLines
              //   store 位置仅通过 onDragEnd 的 batchUpdatePositions 一次性同步
              snapCallbacks.onDragMove(id, dx, dy, currentEl.x, currentEl.y, currentEl.width, currentEl.height);

              // 实时写入拖拽偏移量 → ConnectionLines 可读取以实时跟随
              setDragOffset(id, dx, dy);

              const stage = e.target.getStage();
              if (stage) {
                // FR1 编组节点：兄弟节点通过 Konva API 直接移动，不经过 store。
                const group = useCanvasStore.getState().groups.find(g => g.childIds.includes(id));
                // 防御：编组超过 50 个成员时不移动兄弟节点（防止误操作把全画布分组后
                // 拖任意节点都带着全部元素跑）。
                if (group && group.childIds.length <= 50) {
                  const groupDeltas: { id: string; dx: number; dy: number }[] = [];
                  for (const sid of group.childIds) {
                    if (sid === id) continue;
                    const siblingNode = stage.findOne('#' + sid);
                    if (siblingNode) {
                      const sibOrigin = dragStartPosRef.current[sid];
                      if (sibOrigin) {
                        siblingNode.position({ x: sibOrigin.x + dx, y: sibOrigin.y + dy });
                        groupDeltas.push({ id: sid, dx, dy });
                      }
                    }
                  }
                  // 批量写入编组兄弟偏移量
                  if (groupDeltas.length > 0) setGroupDragOffsets(groupDeltas);
                }
              }
            }
          },
          onDragEnd: (e: any) => {
            isDraggingOrResizingRef.current = false;
            flushSync();
            if (e.target.id() === id) {
              // 从 Konva 节点直接读取最终位置（含 dragBoundFunc 的 snap 偏移），
              // 避免从 store 重新计算导致的 snap 偏移丢失。
              const finalX = e.target.x();
              const finalY = e.target.y();
              snapCallbacks.onDragEnd(id, finalX, finalY);
              // Clean up ref
              delete dragStartPosRef.current[id];
              // 清除拖拽偏移量 — store 已更新，连线回退到纯 store 位置
              clearDragOffset(id);
              // FR1: 清理编组兄弟节点在 dragStartPosRef 中的条目。
              const cleanupGroup = useCanvasStore.getState().groups.find(g => g.childIds.includes(id));
              if (cleanupGroup) {
                clearGroupDragOffsets(cleanupGroup.childIds);
                for (const sid of cleanupGroup.childIds) delete dragStartPosRef.current[sid];
              }
            }
          },
          onMouseEnter: () => {
            if (el.type !== 'video' && el.type !== 'audio') setHoveredId(id);
          },
          onMouseLeave: () => { setHoveredId(null); },
          onDblClick: (e: any) => {
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
        } else if (el.type === 'script') {
          nodeContent = <ScriptNode el={el as ScriptElement} width={width} height={height} isSelected={isSelected} autoEdit={!!(el as ScriptElement).isNew} />;
        } else if (el.type === 'scene') {
          nodeContent = <SceneNode el={el as SceneElement} width={width} height={height} isSelected={isSelected} />;
        }

        // FR1 grouping: if node belongs to a selected group, render a dashed border overlay
        const inSelectedGroup = selectedGroupMemberIds.has(id);
        const groupBorder = inSelectedGroup ? (
          <Rect
            x={-3} y={-3}
            width={width + 6} height={height + 6}
            stroke={isSelected ? 'var(--accent)' : INK_1}
            strokeWidth={1.5}
            dash={[6, 4]}
            cornerRadius={12}
            fill="transparent"
            listening={false}
          />
        ) : null;

        const rotOverride = rotation || 0;

        return (
          <Group key={id} {...outerGroupProps} rotation={rotOverride}>
            {isSelected && activeTool === 'select' && (
              <SelectionHandles
                el={el}
                snapCallbacks={snapCallbacks}
                dragGuardRef={isDraggingOrResizingRef}
              />
            )}
            <PortOverlay el={el} isSelected={isSelected} hoveredId={hoveredId} />
            {groupBorder}
            {nodeContent}
            <RunningPulse el={el} />
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