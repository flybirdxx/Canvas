import React, { useRef, useEffect, useState } from 'react';
import { Rect, Text, Group, Image as KonvaImage, Circle, Line } from 'react-konva';
import { Html } from 'react-konva-utils';
import useImage from 'use-image';
import { Loader2, Sparkles, AlignLeft } from 'lucide-react';
import { useCanvasStore } from '../../store/useCanvasStore';

function getPortColor(type: string) {
  switch (type) {
    case 'text': return '#10b981'; // emerald
    case 'image': return '#8b5cf6'; // violet
    case 'video': return '#ef4444'; // red
    case 'audio': return '#f59e0b'; // amber
    default: return '#94a3b8'; // slate
  }
}

// Helper component for loading image references
function URLImage({ el, width, height }: { el: any, width: number, height: number }) {
  const [img] = useImage(el.src || '');
  if (!el.src) {
    return (
      <Group>
        <Rect width={width} height={height} fill="transparent" />
        <Html divProps={{ style: { pointerEvents: 'none' } }}>
          <div 
            className="flex items-center justify-center bg-white/60 dark:bg-gray-800/60 backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-colors border border-white/50 dark:border-gray-700/50"
            style={{ width, height }}
          >
            <span className="text-[14px] font-medium text-gray-500 dark:text-gray-400">🖼️ 空白图片</span>
          </div>
        </Html>
      </Group>
    );
  }
  return <KonvaImage image={img} width={width} height={height} cornerRadius={16} shadowColor="rgba(0,0,0,0.15)" shadowBlur={30} shadowOffsetY={10} />;
}

const HANDLE_SIZE = 8;
const HANDLE_HALF = HANDLE_SIZE / 2;

type Corner = 'tl' | 'tr' | 'bl' | 'br';

function SelectionHandles({ el, updateElement }: { el: any; updateElement: any }) {
  const { x, y, width, height, id } = el;
  const dragStartRef = useRef<{ mx: number; my: number; x: number; y: number; w: number; h: number } | null>(null);

  const corners: { corner: Corner; cx: number; cy: number }[] = [
    { corner: 'tl', cx: x,         cy: y },
    { corner: 'tr', cx: x + width, cy: y },
    { corner: 'bl', cx: x,         cy: y + height },
    { corner: 'br', cx: x + width, cy: y + height },
  ];

  return (
    <>
      {/* Selection border */}
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        stroke="#3b82f6"
        strokeWidth={1.5}
        fill="transparent"
        listening={false}
      />
      {/* Corner handles */}
      {corners.map(({ corner, cx, cy }) => (
        <Rect
          key={corner}
          x={cx - HANDLE_HALF}
          y={cy - HANDLE_HALF}
          width={HANDLE_SIZE}
          height={HANDLE_SIZE}
          fill="white"
          stroke="#3b82f6"
          strokeWidth={1.5}
          cornerRadius={2}
          draggable
          onDragStart={(e) => {
            e.cancelBubble = true;
            const stage = e.target.getStage();
            const scale = stage!.scaleX();
            const stageX = stage!.x();
            const stageY = stage!.y();
            const ptr = stage!.getPointerPosition()!;
            dragStartRef.current = {
              mx: (ptr.x - stageX) / scale,
              my: (ptr.y - stageY) / scale,
              x: el.x,
              y: el.y,
              w: el.width,
              h: el.height,
            };
            // Keep handle visually in place during drag
            e.target.x(cx - HANDLE_HALF);
            e.target.y(cy - HANDLE_HALF);
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            if (!dragStartRef.current) return;
            const stage = e.target.getStage();
            const scale = stage!.scaleX();
            const stageX = stage!.x();
            const stageY = stage!.y();
            const ptr = stage!.getPointerPosition()!;
            const mx = (ptr.x - stageX) / scale;
            const my = (ptr.y - stageY) / scale;
            const dx = mx - dragStartRef.current.mx;
            const dy = my - dragStartRef.current.my;
            const { x: ox, y: oy, w: ow, h: oh } = dragStartRef.current;

            let newX = ox, newY = oy, newW = ow, newH = oh;
            if (corner === 'tl') { newX = ox + dx; newY = oy + dy; newW = Math.max(60, ow - dx); newH = Math.max(40, oh - dy); }
            if (corner === 'tr') { newY = oy + dy; newW = Math.max(60, ow + dx); newH = Math.max(40, oh - dy); }
            if (corner === 'bl') { newX = ox + dx; newW = Math.max(60, ow - dx); newH = Math.max(40, oh + dy); }
            if (corner === 'br') { newW = Math.max(60, ow + dx); newH = Math.max(40, oh + dy); }

            // Snap handle back to its computed position
            e.target.x(cx - HANDLE_HALF);
            e.target.y(cy - HANDLE_HALF);

            useCanvasStore.getState().updateElement(id, { x: newX, y: newY, width: newW, height: newH });
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            e.target.x(cx - HANDLE_HALF);
            e.target.y(cy - HANDLE_HALF);
            dragStartRef.current = null;
          }}
        />
      ))}
    </>
  );
}

export function CanvasElements() {
  const { elements, selectedIds, setSelection, updateElement, updateElementPosition, activeTool, setDrawingConnection, drawingConnection } = useCanvasStore();

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
          dragBoundFunc: function (this: any, pos: any) {
            if (useCanvasStore.getState().drawingConnection) {
              return this.absolutePosition();
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
          onDragMove: (e: any) => {
            if (e.target.id() === id) {
              updateElementPosition(id, e.target.x(), e.target.y());
            }
          },
          onDragEnd: (e: any) => {
            if (e.target.id() === id) {
              updateElement(id, { x: e.target.x(), y: e.target.y() });
            }
          },
        };

        let nodeContent: JSX.Element | null = null;

        if (el.type === 'rectangle') {
          nodeContent = (
            <Group>
              <Rect width={width} height={height} fill="transparent" />
              <Html divProps={{ style: { pointerEvents: 'none' } }}>
                <div 
                  className="bg-white/40 dark:bg-gray-800/40 backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-colors border border-white/40 dark:border-gray-700/50"
                  style={{ width, height }}
                />
              </Html>
            </Group>
          );
        }
        else if (el.type === 'circle') {
          nodeContent = (
            <Group>
              <Rect width={width} height={height} fill="transparent" />
              <Html divProps={{ style: { pointerEvents: 'none' } }}>
                <div 
                  className="bg-white/40 dark:bg-gray-800/40 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-colors border border-white/40 dark:border-gray-700/50"
                  style={{ width, height, borderRadius: '50%' }}
                />
              </Html>
            </Group>
          );
        }
        else if (el.type === 'text') {
          const textEl = el as any;
          nodeContent = (
            <Group>
              <Rect width={width} height={height} fill="transparent" />
              <Html divProps={{ style: { pointerEvents: 'none' } }}>
                <div 
                  className="flex flex-col bg-white/60 dark:bg-gray-800/60 backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-colors overflow-hidden border border-white/50 dark:border-gray-700/50"
                  style={{ width, height, fontFamily: textEl.fontFamily || 'sans-serif' }}
                >
                  <div className="flex items-center justify-between px-4 py-3 bg-white/30 dark:bg-gray-900/30 border-b border-white/30 dark:border-gray-700/50">
                    <div className="flex items-center gap-2">
                      <AlignLeft size={16} className="text-gray-500 dark:text-gray-400" />
                      <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">Text</span>
                    </div>
                  </div>
                  <div className="flex-1 p-4">
                    <textarea
                      className="w-full h-full bg-transparent border-none outline-none resize-none custom-scrollbar text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 pointer-events-auto"
                      style={{
                        color: textEl.fill && textEl.fill !== '#D4D4D4' ? textEl.fill : undefined,
                        fontSize: `${textEl.fontSize || 14}px`,
                        lineHeight: textEl.lineHeight || 1.4,
                        textAlign: textEl.align || 'left',
                      }}
                      value={textEl.text}
                      placeholder='Try "A poetic excerpt about the passage of time" [tab]'
                      onChange={(e) => updateElement(id, { text: e.target.value })}
                      onPointerDown={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </Html>
            </Group>
          );
        }
        else if (el.type === 'image') {
          nodeContent = <URLImage el={el} width={width} height={height} />;
        }
        else if (el.type === 'sticky') {
          const sticky = el as any;
          nodeContent = (
            <Group>
              <Rect width={width} height={height} fill="transparent" />
              <Html divProps={{ style: { pointerEvents: 'none' } }}>
                <div 
                  className="bg-yellow-200/60 dark:bg-yellow-600/40 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-colors p-4 flex border border-yellow-300/50 dark:border-yellow-500/30"
                  style={{ width, height }}
                >
                  <textarea
                    className="w-full h-full bg-transparent border-none outline-none resize-none custom-scrollbar text-gray-800 dark:text-gray-100 pointer-events-auto text-[15px] font-medium leading-relaxed"
                    value={sticky.text || ''}
                    placeholder="📝 点击编辑便签内容..."
                    onChange={(e) => updateElement(id, { text: e.target.value })}
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </Html>
            </Group>
          );
        }
        else if (el.type === 'aigenerating') {
          nodeContent = (
            <Group>
              <Rect width={width} height={height} fill="transparent" />
              <Html divProps={{ style: { pointerEvents: 'none' } }}>
                <div className="flex items-center justify-center bg-white/60 dark:bg-gray-800/60 backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(168,85,247,0.15)] dark:shadow-[0_8px_32px_rgba(168,85,247,0.3)] transition-colors overflow-hidden relative border border-purple-300/50 dark:border-purple-500/30" style={{ width, height }}>
                   <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-purple-400/20 to-purple-500/10 bg-[length:200%_100%] animate-[shimmer_2s_infinite]"></div>
                   <div className="relative flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md rounded-full shadow-sm border border-purple-200/50 dark:border-purple-700/50">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span className="text-purple-800 dark:text-purple-300 font-bold text-xs">正在施展魔法...</span>
                      </div>
                   </div>
                </div>
              </Html>
            </Group>
          );
        }
        else if (el.type === 'video' || el.type === 'audio') {
          const media = el as any;
          nodeContent = (
            <Group>
              <Rect width={width} height={height} fill="transparent" />
              <Html divProps={{ style: { pointerEvents: 'none' } }}>
                <div 
                  className="flex flex-col bg-white/60 dark:bg-gray-800/60 backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-colors overflow-hidden border border-white/50 dark:border-gray-700/50"
                  style={{ width, height }}
                >
                  <div className="h-8 bg-white/30 dark:bg-gray-900/30 flex items-center px-4 border-b border-white/30 dark:border-gray-700/50">
                     <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider">
                       {el.type === 'video' ? 'VIDEO' : 'AUDIO'}
                     </span>
                  </div>
                  <div className="flex-1 pointer-events-auto flex items-center justify-center overflow-hidden bg-black/5 dark:bg-black/20">
                    {el.type === 'video' ? (
                       media.src ? <video controls src={media.src} className="w-full h-full object-contain" onPointerDown={(e) => e.stopPropagation()} />
                       : <div className="text-gray-400 dark:text-gray-500 text-xs flex items-center gap-2">🎥 空白视频节点</div>
                    ) : (
                       media.src ? <audio controls src={media.src} className="w-[90%]" onPointerDown={(e) => e.stopPropagation()} />
                       : <div className="text-gray-400 dark:text-gray-500 text-xs flex items-center gap-2">🎵 空白音频节点</div>
                    )}
                  </div>
                </div>
              </Html>
            </Group>
          );
        }

        const portRadius = 6;
        const renderPorts = () => {
          if (!el.inputs && !el.outputs) return null;
          
          const inputSpacing = height / ((el.inputs?.length || 0) + 1);
          const outputSpacing = height / ((el.outputs?.length || 0) + 1);

          return (
            <>
              {el.inputs?.map((port, i) => {
                const portY = inputSpacing * (i + 1);
                return (
                  <Group key={`in-${port.id}`} x={0} y={portY}>
                    <Circle
                      x={0}
                      y={0}
                      radius={portRadius}
                      fill={getPortColor(port.type)}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'crosshair';
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }}
                      onPointerDown={(e) => {
                        e.cancelBubble = true;
                        const existingConn = useCanvasStore.getState().connections.find(c => c.toPortId === port.id);
                        if (existingConn) {
                          useCanvasStore.getState().deleteConnections([existingConn.id]);
                          const fromEl = useCanvasStore.getState().elements.find(e => e.id === existingConn.fromId);
                          if (fromEl) {
                            setDrawingConnection({
                              fromElementId: fromEl.id,
                              fromPortId: existingConn.fromPortId,
                              fromPortType: port.type, 
                              startX: x, 
                              startY: y + portY,
                              toX: x,
                              toY: y + portY,
                              isDisconnecting: true,
                              existingConnectionId: existingConn.id
                            });
                          }
                        }
                      }}
                    />
                    <Text text={port.label} x={10} y={-5} fontSize={10} fill="#64748b" />
                  </Group>
                );
              })}

              {el.outputs?.map((port, i) => {
                const portY = outputSpacing * (i + 1);
                return (
                  <Group key={`out-${port.id}`} x={width} y={portY}>
                    <Circle
                      x={0}
                      y={0}
                      radius={portRadius}
                      fill={getPortColor(port.type)}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'crosshair';
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }}
                      onPointerDown={(e) => {
                        e.cancelBubble = true;
                        setDrawingConnection({
                          fromElementId: el.id,
                          fromPortId: port.id,
                          fromPortType: port.type,
                          startX: x + width,
                          startY: y + portY,
                          toX: x + width,
                          toY: y + portY,
                          isDisconnecting: false
                        });
                      }}
                    />
                    <Text text={port.label} x={-10 - (port.label?.length || 0) * 6} y={-5} fontSize={10} fill="#64748b" align="right" />
                  </Group>
                );
              })}
            </>
          );
        };

        return (
          <Group key={id} {...outerGroupProps}>
            {nodeContent}
            {renderPorts()}
          </Group>
        );
      })}

      {/* Custom selection handles rendered above all nodes */}
      {activeTool === 'select' && selectedIds.map((selId) => {
        const el = elements.find(e => e.id === selId);
        if (!el) return null;
        return <SelectionHandles key={`sel-${selId}`} el={el} updateElement={updateElement} />;
      })}
    </>
  );
}
