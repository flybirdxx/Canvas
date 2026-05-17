/**
 * InfiniteCanvas — the main Stage orchestration component.
 *
 * All rendering and interaction logic is delegated to sub-components and hooks:
 *
 *   Hooks (src/hooks/canvas/):
 *     useKeyboardShortcuts — space/alt/shift modifiers
 *     useCanvasPanZoom     — scroll-zoom + middle-click pan
 *     useCanvasSelection   — rubber-band + marquee
 *     useCanvasConnections — port hit-testing + quick-add menu state
 *     useSnapCallbacks     — drag/resize snap to guides
 *     useCanvasDrop        — file & asset library drag-and-drop
 *
 *   Konva sub-components:
 *     ConnectionLines / DrawingConnectionLine — bezier connection rendering
 *     CanvasElements   — node tree (shapes, images, text, etc.)
 *     SelectionBoxRect / MarqueeRect — rubber-band & export region overlays
 *
 *   HTML overlays:
 *     NodeInputBarOverlay  — prompt bar beneath selected nodes
 *     InpaintOverlayLayer  — inpainting mask overlay
 *     NodeNoteOverlay      — note indicator badges
 *     NodeVersionOverlay   — version switcher badges
 *
 *   Floating UI:
 *     QuickAddMenu      — context menu for creating new nodes
 *     BatchGenerateBar  — multi-select batch generation toolbar
 *     MarqueeToolbar    — export-marquee confirm / cancel toolbar
 */
import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { useCanvasStore } from '@/store/useCanvasStore';
import { setStage } from '@/utils/stageRegistry';
import { exportCanvasRect } from '@/utils/exportPng';

// Hooks
import { useKeyboardShortcuts } from '@/hooks/canvas/useKeyboardShortcuts';
import { useCanvasPanZoom } from '@/hooks/canvas/useCanvasPanZoom';
import { useCanvasSelection } from '@/hooks/canvas/useCanvasSelection';
import { useCanvasConnections } from '@/hooks/canvas/useCanvasConnections';
import { useSnapCallbacks } from '@/hooks/canvas/useSnapCallbacks';
import { useCanvasDrop } from '@/hooks/canvas/useCanvasDrop';

// Konva sub-components
import { CanvasElements } from './CanvasElements';
import { ConnectionLines, DrawingConnectionLine } from './ConnectionLines';
import { SelectionBoxRect, MarqueeRect } from './SelectionRects';

// HTML overlays
import { NodeInputBarOverlay } from './overlays/NodeInputBarOverlay';
import { NodeToolbarOverlay } from './overlays/NodeToolbarOverlay';
import { InpaintOverlayLayer } from './overlays/InpaintOverlayLayer';
import { NodeNoteOverlay } from './overlays/NodeNoteOverlay';
import { NodeVersionOverlay } from './overlays/NodeVersionOverlay';

// Floating UI
import { QuickAddMenu } from './QuickAddMenu';
import { BatchGenerateBar } from './BatchGenerateBar';
import { MarqueeToolbar } from './MarqueeToolbar';

const INPUT_BAR_VISIBLE_SCALE = 0.5;

export function InfiniteCanvas() {
  const {
    stageConfig, setStageConfig,
    activeTool,
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

  // ── Hooks ────────────────────────────────────────────────────────────
  const { isSpacePressed, isAltRef, isShiftRef } = useKeyboardShortcuts();
  const { handleWheel, startPan, updatePan, endPan, isPanningRef } = useCanvasPanZoom();
  const { selectionBox, marquee, setMarquee, startSelectionBox, updateSelectionBox, endSelectionBox, startMarquee, updateMarquee, endMarquee, clearSelectionBox } = useCanvasSelection(isShiftRef);
  const { quickAddMenu, setQuickAddMenu, findPortUnderMouse, handleQuickAdd, handleQuickAddUpload } = useCanvasConnections();
  const { guideLines, snapCallbacks } = useSnapCallbacks(isAltRef);
  const { handleDrop } = useCanvasDrop(containerRef);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Resize ───────────────────────────────────────────────────────────
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

  // ── Pointer event handlers ───────────────────────────────────────────
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

  const handleDblClick = (e: KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      clearSelectionBox();
      const pointer = e.target.getStage()?.getPointerPosition();
      if (!pointer) return;
      const scale = stageConfig.scale;
      const currentX = (pointer.x - stageConfig.x) / scale;
      const currentY = (pointer.y - stageConfig.y) / scale;
      setQuickAddMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        canvasX: currentX,
        canvasY: currentY,
      });
    }
  };

  // ── Render ───────────────────────────────────────────────────────────
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
        onDblClick={handleDblClick}
        className={
          marquee.active ? 'cursor-crosshair' :
          isSpacePressed ? (isPanningRef.current ? 'cursor-grabbing' : 'cursor-grab') :
          activeTool === 'hand' ? 'cursor-grab active:cursor-grabbing' :
          activeTool === 'select' ? 'cursor-default active:cursor-grab' : 'cursor-crosshair'
        }
      >
        <Layer>
          <ConnectionLines elements={elements} connections={connections} />
          {drawingConnection && <DrawingConnectionLine drawingConnection={drawingConnection} />}
          <CanvasElements guideLines={guideLines} snapCallbacks={snapCallbacks} />
          {selectionBox && <SelectionBoxRect box={selectionBox} scale={stageConfig.scale} />}
          {marquee.active && marquee.rect && <MarqueeRect rect={marquee.rect} scale={stageConfig.scale} />}
        </Layer>
      </Stage>

      {/* HTML overlay layers */}
      <NodeToolbarOverlay
        elements={elements}
        selectedIds={selectedIds}
        stageConfig={stageConfig}
      />
      {stageConfig.scale >= INPUT_BAR_VISIBLE_SCALE && (
        <NodeInputBarOverlay
          elements={elements}
          selectedIds={selectedIds}
          stageConfig={stageConfig}
        />
      )}
      {inpaintMask && (
        <InpaintOverlayLayer
          elements={elements}
          inpaintMask={inpaintMask}
          stageConfig={stageConfig}
        />
      )}
      <NodeNoteOverlay elements={elements} selectedIds={selectedIds} stageConfig={stageConfig} />
      <NodeVersionOverlay elements={elements} selectedIds={selectedIds} stageConfig={stageConfig} />

      {/* Hidden file input for quick-add upload */}
      <input ref={fileInputRef} type="file" accept="*/*" multiple style={{ display: 'none' }} onChange={handleQuickAddUpload} />

      {/* Floating UI */}
      {quickAddMenu && (
        <QuickAddMenu
          menu={quickAddMenu}
          onAdd={handleQuickAdd}
          onUpload={() => fileInputRef.current?.click()}
        />
      )}
      <BatchGenerateBar elements={elements} selectedIds={selectedIds} />
      {marquee.active && (
        <MarqueeToolbar
          drawing={marquee.drawing}
          rect={marquee.rect}
          stageConfig={stageConfig}
          onExport={(rect) => {
            exportCanvasRect(rect);
            setMarquee({ active: false, drawing: false, rect: null });
          }}
          onReset={() => setMarquee({ active: true, drawing: false, rect: null })}
          onCancel={() => setMarquee({ active: false, drawing: false, rect: null })}
        />
      )}
    </div>
  );
}
