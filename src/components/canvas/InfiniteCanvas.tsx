import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Stage, Layer, Rect, Line, Group } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { useCanvasStore } from '../../store/useCanvasStore';
import { CanvasElements } from './CanvasElements';
import { NodeInputBar } from '../NodeInputBar';
import { NodeVersionSwitcher } from '../NodeVersionSwitcher';
import { InpaintOverlay } from '../InpaintOverlay';
import { NodeNoteIndicator } from '../NodeNoteIndicator';
import { setStage } from '../../utils/stageRegistry';
import { exportCanvasRect } from '../../utils/exportPng';
import { useAssetLibraryStore } from '../../store/useAssetLibraryStore';
import { Type, ImageIcon, Video, Music, FileUp, Check, RotateCcw, X } from 'lucide-react';
import { buildFileElement } from '../../services/fileIngest';
import { runGeneration } from '../../services/imageGeneration';

// Import our new hooks
import { useKeyboardShortcuts } from '../../hooks/canvas/useKeyboardShortcuts';
import { useCanvasPanZoom } from '../../hooks/canvas/useCanvasPanZoom';
import { useCanvasSelection } from '../../hooks/canvas/useCanvasSelection';
import { useCanvasConnections } from '../../hooks/canvas/useCanvasConnections';
import { useSnapCallbacks } from '../../hooks/canvas/useSnapCallbacks';

const INPUT_BAR_MIN_WIDTH_BY_TYPE: Record<string, number> = {
  text: 260,
  image: 400,
  video: 460,
  aigenerating: 400,
};
const INPUT_BAR_MIN_WIDTH_FALLBACK = 260;
const INPUT_BAR_GAP_CANVAS = 6;
const INPUT_BAR_VISIBLE_SCALE = 0.5;

function getBezierPoints(startX: number, startY: number, endX: number, endY: number) {
  const dx = Math.abs(endX - startX);
  const curveFactor = Math.max(dx * 0.5, 50); 
  const cp1X = startX + curveFactor;
  const cp1Y = startY;
  const cp2X = endX - curveFactor;
  const cp2Y = endY;
  return [startX, startY, cp1X, cp1Y, cp2X, cp2Y, endX, endY];
}

function getPortColor(type: string) {
  switch (type) {
    case 'text':  return '#3F8FA6';
    case 'image': return '#C67654';
    case 'video': return '#8866B5';
    case 'audio': return '#6FA26A';
    default:      return '#8A7F74';
  }
}

const INK_LINE = '#5A4E42';

export function InfiniteCanvas() {
  const { 
    stageConfig, setStageConfig, 
    activeTool, setActiveTool, 
    setSelection, addElement, 
    elements, connections, addConnection,
    drawingConnection, setDrawingConnection,
    selectedIds,
  } = useCanvasStore();
  const inpaintMask = useCanvasStore(s => s.inpaintMask);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    return () => { setStage(null); };
  }, []);

  const { isSpacePressed, isAltRef, isShiftRef } = useKeyboardShortcuts();
  const { handleWheel, startPan, updatePan, endPan, isPanningRef } = useCanvasPanZoom();
  const { selectionBox, marquee, setMarquee, startSelectionBox, updateSelectionBox, endSelectionBox, startMarquee, updateMarquee, endMarquee } = useCanvasSelection(isShiftRef);
  const { quickAddMenu, setQuickAddMenu, findPortUnderMouse, handleQuickAdd, handleQuickAddUpload } = useCanvasConnections();
  const { guideLines, snapCallbacks, dragDeltasRef } = useSnapCallbacks(isAltRef);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handlePointerDown = (e: KonvaEventObject<PointerEvent>) => {
    setQuickAddMenu(null);
    if (marquee.active && e.evt.button === 0) {
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const scale = stage.scaleX();
      const cx = (pointer.x - stage.x()) / scale;
      const cy = (pointer.y - stage.y()) / scale;
      startMarquee(cx, cy);
      return;
    }
    if ((e.evt.button === 1 || (e.evt.button === 0 && isSpacePressed)) && !marquee.active) {
      e.evt.preventDefault();
      startPan(e.evt.clientX, e.evt.clientY);
      return;
    }
    if (activeTool === 'select' && e.target === e.target.getStage()) {
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const scale = stage.scaleX();
      const x = (pointer.x - stage.x()) / scale;
      const y = (pointer.y - stage.y()) / scale;
      startSelectionBox(x, y);
      return;
    }
  };

  const handlePointerMove = (e: KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    if (marquee.active && marquee.drawing) {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const scale = stage.scaleX();
      const cx = (pointer.x - stage.x()) / scale;
      const cy = (pointer.y - stage.y()) / scale;
      updateMarquee(cx, cy);
      return;
    }

    if (isPanningRef.current) {
      e.evt.preventDefault();
      updatePan(stage, e.evt.clientX, e.evt.clientY);
      return;
    }

    if (selectionBox) {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const scale = stage.scaleX();
      const currentX = (pointer.x - stage.x()) / scale;
      const currentY = (pointer.y - stage.y()) / scale;
      updateSelectionBox(currentX, currentY);
      return;
    }

    if (drawingConnection) {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const scale = stage.scaleX();
      const currentX = (pointer.x - stage.x()) / scale;
      const currentY = (pointer.y - stage.y()) / scale;
      if (drawingConnection.isDisconnecting) {
        setDrawingConnection({ ...drawingConnection, startX: currentX, startY: currentY });
      } else {
        setDrawingConnection({ ...drawingConnection, toX: currentX, toY: currentY });
      }
    }
  };

  const handlePointerUp = (e: KonvaEventObject<PointerEvent>) => {
    if (endMarquee()) return;
    if (endPan()) return;
    if (endSelectionBox()) return;

    if (drawingConnection) {
      const stage = e.target.getStage();
      if (stage) {
        const pointer = stage.getPointerPosition();
        if (pointer) {
          const scale = stage.scaleX();
          const currentX = (pointer.x - stage.x()) / scale;
          const currentY = (pointer.y - stage.y()) / scale;

          const target = findPortUnderMouse(elements, currentX, currentY, !drawingConnection.isDisconnecting, drawingConnection.fromPortType || 'any');

          if (target && target.element.id !== drawingConnection.fromElementId) {
            const compatible = drawingConnection.fromPortType === 'any' || target.port.type === 'any' || drawingConnection.fromPortType === target.port.type;
            if (compatible) {
              addConnection({
                id: uuidv4(),
                fromId: drawingConnection.isDisconnecting ? target.element.id : drawingConnection.fromElementId!,
                fromPortId: drawingConnection.isDisconnecting ? target.port.id : drawingConnection.fromPortId!,
                toId: drawingConnection.isDisconnecting ? drawingConnection.fromElementId! : target.element.id,
                toPortId: drawingConnection.isDisconnecting ? drawingConnection.fromPortId! : target.port.id,
              });
            }
          } else if (!target) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
               setQuickAddMenu({
                 x: pointer.x,
                 y: pointer.y,
                 canvasX: currentX,
                 canvasY: currentY,
                 fromElementId: drawingConnection.fromElementId,
                 fromPortId: drawingConnection.fromPortId,
                 fromPortType: drawingConnection.fromPortType
               });
            }
          }
        }
      }
      setDrawingConnection(null);
      return;
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const stage = containerRef.current?.querySelector('canvas');
    if (!stage) return;

    const assetId = e.dataTransfer.getData('application/x-canvas-asset');
    if (assetId) {
      const asset = useAssetLibraryStore.getState().findAsset(assetId);
      if (!asset) return;

      const defaults =
        asset.kind === 'image' ? { w: 560, h: 560 } :
        asset.kind === 'video' ? { w: 640, h: 360 } :
                                  { w: 360, h: 96 };
      const width = asset.width ?? defaults.w;
      const height = asset.height ?? defaults.h;

      const rect = containerRef.current!.getBoundingClientRect();
      const posX = e.clientX - rect.left;
      const posY = e.clientY - rect.top;
      const scale = stageConfig.scale;
      const x = (posX - stageConfig.x) / scale - width / 2;
      const y = (posY - stageConfig.y) / scale - height / 2;

      const id = uuidv4();
      addElement({
        id,
        type: asset.kind,
        x, y, width, height,
        src: asset.src,
        prompt: asset.prompt,
      } as any);
      setSelection([id]);
      setActiveTool('select');
      return;
    }

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');

    if (isVideo || isAudio) {
      const src = URL.createObjectURL(file);
      const width = isVideo ? 400 : 300;
      const height = isVideo ? 260 : 80;

      const rect = containerRef.current!.getBoundingClientRect();
      const posX = e.clientX - rect.left;
      const posY = e.clientY - rect.top;

      const scale = stageConfig.scale;
      const x = (posX - stageConfig.x) / scale - width / 2;
      const y = (posY - stageConfig.y) / scale - height / 2;

      const id = uuidv4();
      addElement({ id, type: isVideo ? 'video' : 'audio', x, y, width, height, src } as any);
      setSelection([id]);
      setActiveTool('select');
      return;
    }

    if (isImage) {
      const rect = containerRef.current!.getBoundingClientRect();
      const posX = e.clientX - rect.left;
      const posY = e.clientY - rect.top;
      const scale = stageConfig.scale;
      const originX = (posX - stageConfig.x) / scale;
      const originY = (posY - stageConfig.y) / scale;
      buildFileElement(file, { x: originX, y: originY }).then((fileEl) => {
        addElement(fileEl as any);
        setSelection([fileEl.id]);
        setActiveTool('select');

        useAssetLibraryStore.getState().addAsset({
          kind: 'image',
          src: fileEl.src,
          name: fileEl.name || '上传图像',
          width: fileEl.width,
          height: fileEl.height,
          source: 'uploaded',
        });
      }).catch(err => {
        console.warn('[canvas] drop image → file(image) failed', file.name, err);
      });
      return;
    }

    {
      const rect = containerRef.current!.getBoundingClientRect();
      const posX = e.clientX - rect.left;
      const posY = e.clientY - rect.top;
      const scale = stageConfig.scale;
      const originX = (posX - stageConfig.x) / scale;
      const originY = (posY - stageConfig.y) / scale;
      buildFileElement(file, { x: originX, y: originY }).then((fileEl) => {
        addElement(fileEl as any);
        setSelection([fileEl.id]);
        setActiveTool('select');
      }).catch((err) => {
        console.warn('[drop] failed to ingest file', file.name, err);
      });
    }
  };

  const batchTargets = useMemo(() => {
    if (selectedIds.length < 2) return [];
    return elements.filter(
      (el) =>
        selectedIds.includes(el.id) &&
        (el.type === 'image' || el.type === 'video') &&
        el.prompt?.trim() &&
        el.generation?.model,
    );
  }, [elements, selectedIds]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <Stage
        ref={(node) => {
          stageRef.current = node;
          setStage(node);
        }}
        width={size.width}
        height={size.height}
        scaleX={stageConfig.scale}
        scaleY={stageConfig.scale}
        x={stageConfig.x}
        y={stageConfig.y}
        onWheel={handleWheel}
        draggable={(activeTool === 'select' || activeTool === 'hand' || isSpacePressed) && !drawingConnection && !selectionBox && !marquee.active}
        onDragEnd={(e) => {
          if ((activeTool === 'select' || activeTool === 'hand' || isSpacePressed) && e.target === e.target.getStage()) {
            setStageConfig({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDblClick={(e) => {
          if (e.target === e.target.getStage()) {
            startSelectionBox(0, 0); // null out selection box hack
            const pointer = e.target.getStage()?.getPointerPosition();
            if (!pointer) return;
            const scale = stageConfig.scale;
            const currentX = (pointer.x - stageConfig.x) / scale;
            const currentY = (pointer.y - stageConfig.y) / scale;
            setQuickAddMenu({
              x: e.evt.clientX,
              y: e.evt.clientY,
              canvasX: currentX,
              canvasY: currentY
            });
          }
        }}
        className={
          marquee.active ? 'cursor-crosshair' :
          isSpacePressed ? (isPanningRef.current ? 'cursor-grabbing' : 'cursor-grab') :
          activeTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : 
          activeTool === 'select' ? 'cursor-default active:cursor-grab' : 'cursor-crosshair'
        }
      >
        <Layer>
          {connections.map(conn => {
            const fromEl = elements.find(el => el.id === conn.fromId);
            const toEl = elements.find(el => el.id === conn.toId);
            if (!fromEl || !toEl || !fromEl.outputs || !toEl.inputs) return null;
            
            const fromPortIdx = fromEl.outputs.findIndex(p => p.id === conn.fromPortId);
            const toPortIdx = toEl.inputs.findIndex(p => p.id === conn.toPortId);
            if (fromPortIdx === -1 || toPortIdx === -1) return null;

            const fromPortType = fromEl.outputs[fromPortIdx].type;

            const outputSpacing = fromEl.height / (fromEl.outputs.length + 1);
            const inputSpacing = toEl.height / (toEl.inputs.length + 1);

            const startX = fromEl.x + fromEl.width;
            const startY = fromEl.y + outputSpacing * (fromPortIdx + 1);
            const endX = toEl.x;
            const endY = toEl.y + inputSpacing * (toPortIdx + 1);
            
            return (
              <Group key={conn.id}>
                <Line
                  points={getBezierPoints(startX, startY, endX, endY)}
                  stroke={getPortColor(fromPortType)}
                  strokeWidth={5}
                  opacity={0.22}
                  bezier
                  listening={false}
                  lineCap="round"
                />
                <Line
                  points={getBezierPoints(startX, startY, endX, endY)}
                  stroke={getPortColor(fromPortType)}
                  strokeWidth={1.6}
                  bezier
                  listening={false}
                  lineCap="round"
                />
              </Group>
            );
          })}

          {drawingConnection && (
            <Line
              points={getBezierPoints(drawingConnection.startX, drawingConnection.startY, drawingConnection.toX, drawingConnection.toY)}
              stroke={getPortColor(drawingConnection.fromPortType)}
              strokeWidth={1.8}
              dash={[5, 4]}
              bezier
              lineCap="round"
            />
          )}

          <CanvasElements
            guideLines={guideLines}
            snapCallbacks={snapCallbacks}
          />
          
          {selectionBox && selectionBox.width > 0 && selectionBox.height > 0 && (
             <Rect
                x={selectionBox.x}
                y={selectionBox.y}
                width={selectionBox.width}
                height={selectionBox.height}
                fill="rgba(59,130,246,0.08)"
                stroke="#3B82F6"
                strokeWidth={1.2 / stageConfig.scale}
                dash={[6 / stageConfig.scale, 5 / stageConfig.scale]}
                cornerRadius={4 / stageConfig.scale}
             />
          )}

          {marquee.active && marquee.rect && marquee.rect.w > 0 && marquee.rect.h > 0 && (
            <Rect
              x={marquee.rect.x}
              y={marquee.rect.y}
              width={marquee.rect.w}
              height={marquee.rect.h}
              fill="rgba(198, 118, 84, 0.08)"
              stroke="#C67654"
              strokeWidth={1.2 / stageConfig.scale}
              dash={[6 / stageConfig.scale, 5 / stageConfig.scale]}
            />
          )}
        </Layer>
      </Stage>

      {stageConfig.scale >= INPUT_BAR_VISIBLE_SCALE && (
        <div className="absolute inset-0 pointer-events-none">
          {elements
            .filter(el =>
              selectedIds.includes(el.id) &&
              (el.type === 'image' || el.type === 'video' || el.type === 'text' ||
                (el.type === 'aigenerating' && !!(el as any).error))
            )
            .map(el => {
              const barMin = INPUT_BAR_MIN_WIDTH_BY_TYPE[el.type] ?? INPUT_BAR_MIN_WIDTH_FALLBACK;
              const canvasWidth = Math.max(el.width, barMin);
              const canvasX = el.x - (canvasWidth - el.width) / 2;
              const canvasY = el.y + el.height + INPUT_BAR_GAP_CANVAS;
              const delta = dragDeltasRef.current[el.id];
              const ddx = delta ? delta.dx : 0;
              const ddy = delta ? delta.dy : 0;
              const screenX = stageConfig.x + (canvasX + ddx) * stageConfig.scale;
              const screenY = stageConfig.y + (canvasY + ddy) * stageConfig.scale;
              return (
                <NodeInputBar
                  key={`input-${el.id}`}
                  element={el}
                  x={screenX}
                  y={screenY}
                  width={canvasWidth}
                  scale={stageConfig.scale}
                />
              );
            })}
        </div>
      )}

      {inpaintMask && (() => {
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
      })()}

      <div className="absolute inset-0 pointer-events-none">
        {elements
          .filter(el => {
            const hasNote =
              typeof (el as any).note === 'string' && (el as any).note.trim().length > 0;
            return hasNote || selectedIds.includes(el.id);
          })
          .map(el => {
            const canvasRightX = el.x + el.width;
            const canvasTopY = el.y - 28;
            const screenX = stageConfig.x + canvasRightX * stageConfig.scale;
            const screenY = stageConfig.y + canvasTopY * stageConfig.scale;
            return (
              <NodeNoteIndicator
                key={`note-${el.id}`}
                element={el}
                x={screenX}
                y={screenY}
                scale={stageConfig.scale}
              />
            );
          })}
      </div>

      <div className="absolute inset-0 pointer-events-none">
        {elements
          .filter(el =>
            selectedIds.includes(el.id) &&
            (el.type === 'image' || el.type === 'video') &&
            Array.isArray((el as any).versions) &&
            (el as any).versions.length >= 2
          )
          .map(el => {
            const canvasCx = el.x + el.width / 2;
            const canvasTop = el.y;
            const screenX = stageConfig.x + canvasCx * stageConfig.scale;
            const screenY = stageConfig.y + canvasTop * stageConfig.scale;
            return (
              <NodeVersionSwitcher
                key={`ver-${el.id}`}
                element={el}
                x={screenX}
                y={screenY}
                scale={stageConfig.scale}
              />
            );
          })}
      </div>

      <input ref={fileInputRef} type="file" accept="*/*" multiple style={{ display: 'none' }} onChange={handleQuickAddUpload} />
      
      {quickAddMenu && (
        <div
          className="chip-paper anim-pop absolute z-50 flex flex-col gap-0.5"
          style={{
            left: quickAddMenu.x + 10,
            top: quickAddMenu.y - 10,
            width: 'max-content',
            minWidth: 140,
            padding: 6,
            boxShadow: 'var(--shadow-ink-3)',
          }}
        >
          <div className="meta" style={{ padding: '4px 10px', fontSize: 9.5 }}>
            Quick Add Node
          </div>
          <QuickAddRow icon={<Type className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--port-text)' }} />} label="Text" onClick={() => handleQuickAdd('text')} />
          <QuickAddRow icon={<ImageIcon className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--port-image)' }} />} label="Image" onClick={() => handleQuickAdd('image')} />
          <QuickAddRow icon={<Video className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--port-video)' }} />} label="Video" onClick={() => handleQuickAdd('video')} />
          <QuickAddRow icon={<Music className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--port-audio)' }} />} label="Audio" onClick={() => handleQuickAdd('audio')} />
          <QuickAddRow icon={<FileUp className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />} label="Upload" onClick={() => fileInputRef.current?.click()} />
        </div>
      )}

      {batchTargets.length >= 2 && (
        <div
          className="chip-paper absolute z-35 flex items-center gap-1.5 anim-fade-in"
          style={{
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '4px 6px',
            borderRadius: 'var(--r-pill)',
            boxShadow: 'var(--shadow-ink-2)',
          }}
        >
          <span className="serif-it" style={{ fontSize: 11.5, paddingLeft: 4, color: 'var(--ink-0)' }}>
            已选 {batchTargets.length} 个生成节点
          </span>
          <button
            className="btn btn-primary"
            style={{ padding: '5px 14px', fontSize: 11, borderRadius: 'var(--r-pill)' }}
            onClick={async () => {
              for (const target of batchTargets) {
                const phId = uuidv4();
                const store = useCanvasStore.getState();
                store.replaceElement(target.id, {
                  id: phId,
                  type: 'aigenerating',
                  x: target.x,
                  y: target.y,
                  width: target.width,
                  height: target.height,
                  inheritedVersions: (target as any).versions,
                  inheritedPrompt: target.prompt,
                } as any, '批量生成');
                await runGeneration([phId], {
                  model: target.generation!.model!,
                  prompt: target.prompt!,
                  size: `${target.width}x${target.height}`,
                  aspect: target.generation?.aspect,
                  resolution: target.generation?.quality,
                  qualityLevel: target.generation?.qualityLevel,
                  n: 1,
                  w: target.width,
                  h: target.height,
                  references: target.generation?.references,
                });
              }
            }}
          >
            全部生成
          </button>
        </div>
      )}

      {marquee.active && (
        <>
          {!marquee.rect || marquee.drawing ? (
            <div
              className="absolute z-30 pointer-events-none anim-fade-in"
              style={{
                top: 120,
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '5px 12px',
                borderRadius: 'var(--r-pill)',
                background: 'var(--accent)',
                color: 'var(--accent-fg)',
                fontSize: 12,
                fontWeight: 500,
                boxShadow: 'var(--shadow-ink-2)',
              }}
            >
              {marquee.drawing ? '松开以确认范围' : '拖拽框选要导出的区域（Esc 取消）'}
            </div>
          ) : null}

          {!marquee.drawing && marquee.rect && marquee.rect.w > 0 && marquee.rect.h > 0 && (() => {
            const screenX = stageConfig.x + marquee.rect.x * stageConfig.scale;
            const screenY = stageConfig.y + marquee.rect.y * stageConfig.scale;
            const screenW = marquee.rect.w * stageConfig.scale;
            const toolbarTop = Math.max(8, screenY - 44);
            const toolbarLeft = screenX + screenW / 2;
            return (
              <div
                className="chip-paper absolute z-30 flex items-center gap-1"
                style={{
                  left: toolbarLeft,
                  top: toolbarTop,
                  transform: 'translateX(-50%)',
                  padding: '3px 4px',
                  borderRadius: 'var(--r-pill)',
                  boxShadow: 'var(--shadow-ink-3)',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (marquee.rect) exportCanvasRect(marquee.rect);
                    setMarquee({ active: false, drawing: false, rect: null });
                  }}
                  className="btn btn-primary"
                  style={{ padding: '5px 12px', fontSize: 11, borderRadius: 'var(--r-pill)' }}
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={1.8} />
                  导出此区域
                </button>
                <button
                  type="button"
                  onClick={() => setMarquee({ active: true, drawing: false, rect: null })}
                  className="btn btn-ghost"
                  style={{ padding: '5px 10px', fontSize: 11, borderRadius: 'var(--r-pill)' }}
                  title="重新框选"
                >
                  <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.6} />
                  重新框
                </button>
                <button
                  type="button"
                  onClick={() => setMarquee({ active: false, drawing: false, rect: null })}
                  className="btn btn-ghost btn-icon"
                  style={{ width: 26, height: 26, padding: 0, borderRadius: '50%' }}
                  title="取消 (Esc)"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.6} />
                </button>
              </div>
            );
          })()}
        </>
      )}

    </div>
  );
}

function QuickAddRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex items-center gap-2.5 text-left transition-colors"
      style={{
        padding: '7px 10px',
        borderRadius: 'var(--r-sm)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
      }}
      onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {icon}
      <span style={{ fontSize: 13, color: 'var(--ink-0)', fontWeight: 500 }}>{label}</span>
    </button>
  );
}