import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Line, Group } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { useCanvasStore } from '../../store/useCanvasStore';
import { CanvasElements } from './CanvasElements';
import { CanvasElement } from '../../types/canvas';
import { NodeInputBar } from '../NodeInputBar';
import { NodeVersionSwitcher } from '../NodeVersionSwitcher';
import { InpaintOverlay } from '../InpaintOverlay';
import { NodeNoteIndicator } from '../NodeNoteIndicator';
import { setStage } from '../../utils/stageRegistry';
import { exportCanvasRect } from '../../utils/exportPng';
import { useAssetLibraryStore } from '../../store/useAssetLibraryStore';
import { Type, ImageIcon, Video, Music, Check, RotateCcw, X } from 'lucide-react'; // For Quick Add Menu

// Bar 的宽度和间距用画布单位表达，由 CSS transform:scale 在渲染时等比缩放。
// 按节点类型设置最小宽度：视频模式底栏最密（model/aspect/quality/duration/more/count/credits/submit），
// 图像模式稍少（无 duration），文本模式最简（仅 model/more/credits/submit）。
const INPUT_BAR_MIN_WIDTH_BY_TYPE: Record<string, number> = {
  text: 360,
  image: 480,
  video: 520,
};
const INPUT_BAR_MIN_WIDTH_FALLBACK = 360;
const INPUT_BAR_GAP_CANVAS = 10;
const INPUT_BAR_VISIBLE_SCALE = 0.5;

function getBezierPoints(startX: number, startY: number, endX: number, endY: number) {
  const dx = Math.abs(endX - startX);
  // Add a minimum curve factor to make it look good even when nodes are close horizontally
  const curveFactor = Math.max(dx * 0.5, 50); 
  const cp1X = startX + curveFactor;
  const cp1Y = startY;
  const cp2X = endX - curveFactor;
  const cp2Y = endY;
  return [startX, startY, cp1X, cp1Y, cp2X, cp2Y, endX, endY];
}

/**
 * Paper-palette port colors — mirrors the --port-* tokens in tokens.css
 * (Konva can't read CSS vars, so sRGB approximations of the oklch source).
 * Kept in sync with the copy in CanvasElements.tsx.
 */
function getPortColor(type: string) {
  switch (type) {
    case 'text':  return '#3F8FA6';   // teal
    case 'image': return '#C67654';   // terracotta
    case 'video': return '#8866B5';   // plum
    case 'audio': return '#6FA26A';   // green
    default:      return '#8A7F74';   // neutral ink
  }
}

/** Ink-1 mirror for selection marquees. */
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
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Register the Konva Stage in the module-level registry so export utilities
  // can grab it without prop drilling. Clean up on unmount.
  useEffect(() => {
    return () => {
      setStage(null);
    };
  }, []);

  // Quick Add Menu state
  const [quickAddMenu, setQuickAddMenu] = useState<{
    x: number;
    y: number;
    canvasX: number;
    canvasY: number;
    fromElementId?: string;
    fromPortId?: string;
    fromPortType?: string;
  } | null>(null);

  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Marquee-export tool mode. `active` means we're in the mode (awaiting draw or
  // confirmation); `drawing` is true while the user is dragging out the rect;
  // once the user releases, we stay active with a confirmation toolbar shown.
  const [marquee, setMarquee] = useState<{
    active: boolean;
    drawing: boolean;
    rect: { x: number; y: number; w: number; h: number } | null;
  }>({ active: false, drawing: false, rect: null });
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Enter marquee mode on external request (menu / hotkey).
  useEffect(() => {
    const enter = () => setMarquee({ active: true, drawing: false, rect: null });
    window.addEventListener('canvas:start-marquee-export', enter);
    return () => window.removeEventListener('canvas:start-marquee-export', enter);
  }, []);

  // Esc cancels marquee mode globally.
  useEffect(() => {
    if (!marquee.active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMarquee({ active: false, drawing: false, rect: null });
        marqueeStartRef.current = null;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [marquee.active]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Refs for tracking manual middle-mouse panning
  const isPanningRef = useRef(false);
  const lastPanPositionRef = useRef({ x: 0, y: 0 });

  // Handle Resize
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

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    
    const scaleBy = 1.05;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    if (newScale < 0.1 || newScale > 5) return;

    setStageConfig({
      scale: newScale,
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handlePointerDown = (e: KonvaEventObject<PointerEvent>) => {
    // Hide Quick Add menu if clicking elsewhere
    setQuickAddMenu(null);

    // Marquee export tool: start drawing a new rect (allowed only on primary
    // button and only when we're not already showing a confirmation rect).
    if (marquee.active && e.evt.button === 0) {
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const scale = stage.scaleX();
      const cx = (pointer.x - stage.x()) / scale;
      const cy = (pointer.y - stage.y()) / scale;
      marqueeStartRef.current = { x: cx, y: cy };
      setMarquee({
        active: true,
        drawing: true,
        rect: { x: cx, y: cy, w: 0, h: 0 },
      });
      return;
    }

    if (e.evt.button === 1 || (e.evt.button === 0 && isSpacePressed)) {
      e.evt.preventDefault();
      isPanningRef.current = true;
      lastPanPositionRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      return;
    }

    if (activeTool === 'select' && e.target === e.target.getStage()) {
      setSelection([]);
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const scale = stage.scaleX();
      const x = (pointer.x - stage.x()) / scale;
      const y = (pointer.y - stage.y()) / scale;
      setSelectionBox({ startX: x, startY: y, x, y, width: 0, height: 0 });
      return;
    }
  };

  const handlePointerMove = (e: KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    if (marquee.active && marquee.drawing && marqueeStartRef.current) {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const scale = stage.scaleX();
      const cx = (pointer.x - stage.x()) / scale;
      const cy = (pointer.y - stage.y()) / scale;
      const s = marqueeStartRef.current;
      setMarquee({
        active: true,
        drawing: true,
        rect: {
          x: Math.min(s.x, cx),
          y: Math.min(s.y, cy),
          w: Math.abs(cx - s.x),
          h: Math.abs(cy - s.y),
        },
      });
      return;
    }

    if (isPanningRef.current) {
      e.evt.preventDefault();
      const dx = e.evt.clientX - lastPanPositionRef.current.x;
      const dy = e.evt.clientY - lastPanPositionRef.current.y;
      setStageConfig({ x: stage.x() + dx, y: stage.y() + dy });
      lastPanPositionRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      return;
    }

    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    const scale = stage.scaleX();
    const currentX = (pointer.x - stage.x()) / scale;
    const currentY = (pointer.y - stage.y()) / scale;

    if (drawingConnection) {
      setDrawingConnection({ ...drawingConnection, toX: currentX, toY: currentY });
      return;
    }

    if (selectionBox) {
      const newX = Math.min(selectionBox.startX, currentX);
      const newY = Math.min(selectionBox.startY, currentY);
      const newWidth = Math.abs(currentX - selectionBox.startX);
      const newHeight = Math.abs(currentY - selectionBox.startY);
      setSelectionBox({ ...selectionBox, x: newX, y: newY, width: newWidth, height: newHeight });
      return;
    }
  };

  function findPortUnderMouse(els: CanvasElement[], x: number, y: number, isDrawingFromOutput: boolean, fromPortType: string) {
    const portThreshold = 20;
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i];
      const isInsideNode = x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height;

      if (isDrawingFromOutput && el.inputs) {
        const spacing = el.height / (el.inputs.length + 1);
        for (let j = 0; j < el.inputs.length; j++) {
          const portX = el.x;
          const portY = el.y + spacing * (j + 1);
          if (Math.hypot(portX - x, portY - y) < portThreshold) {
            return { element: el, port: el.inputs[j], isInput: true };
          }
        }
        
        if (isInsideNode) {
          const compatiblePort = el.inputs.find(p => p.type === 'any' || fromPortType === 'any' || p.type === fromPortType);
          if (compatiblePort) {
            return { element: el, port: compatiblePort, isInput: true };
          }
        }
      } else if (!isDrawingFromOutput && el.outputs) {
        const spacing = el.height / (el.outputs.length + 1);
        for (let j = 0; j < el.outputs.length; j++) {
          const portX = el.x + el.width;
          const portY = el.y + spacing * (j + 1);
          if (Math.hypot(portX - x, portY - y) < portThreshold) {
            return { element: el, port: el.outputs[j], isInput: false };
          }
        }

        if (isInsideNode) {
          const compatiblePort = el.outputs.find(p => p.type === 'any' || fromPortType === 'any' || p.type === fromPortType);
          if (compatiblePort) {
            return { element: el, port: compatiblePort, isInput: false };
          }
        }
      }
    }
    return null;
  }

  const handlePointerUp = (e: KonvaEventObject<PointerEvent>) => {
    if (marquee.active && marquee.drawing) {
      marqueeStartRef.current = null;
      // Too-small drags collapse back to 'waiting for new drag' instead of
      // opening a degenerate confirmation toolbar.
      if (!marquee.rect || marquee.rect.w < 4 || marquee.rect.h < 4) {
        setMarquee({ active: true, drawing: false, rect: null });
        return;
      }
      setMarquee(m => ({ ...m, drawing: false }));
      return;
    }

    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }

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
            // Show Quick Add Menu
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
               setQuickAddMenu({
                 x: pointer.x, // Use Konva's local pointer relative to container
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

    if (selectionBox) {
      if (selectionBox.width > 5 && selectionBox.height > 5) {
        // Find all nodes inside the box
        const selectedIds = elements.filter(el => {
           // AABB collision detection
           return el.x < selectionBox.x + selectionBox.width &&
                  el.x + el.width > selectionBox.x &&
                  el.y < selectionBox.y + selectionBox.height &&
                  el.y + el.height > selectionBox.y;
        }).map(el => el.id);
        setSelection(selectedIds);
      }
      setSelectionBox(null);
      return;
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const stage = containerRef.current?.querySelector('canvas');
    if (!stage) return;

    // Drop from the asset library panel — resolve asset by id and drop at cursor.
    const assetId = e.dataTransfer.getData('application/x-canvas-asset');
    if (assetId) {
      const asset = useAssetLibraryStore.getState().findAsset(assetId);
      if (!asset) return;

      const defaults =
        asset.kind === 'image' ? { w: 400, h: 300 } :
        asset.kind === 'video' ? { w: 400, h: 300 } :
                                  { w: 300, h: 80 };
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
      // Note: asset library refuses blob: URLs (session-local), so video/audio
      // uploads aren't archived by the sync path. They can be re-added later via
      // the panel's upload button, which converts to data URL.
      return;
    }

    if (isImage) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const maxWidth = 500;
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
             height = (maxWidth / width) * height;
             width = maxWidth;
          }

          const rect = containerRef.current!.getBoundingClientRect();
          const posX = e.clientX - rect.left;
          const posY = e.clientY - rect.top;

          const scale = stageConfig.scale;
          const x = (posX - stageConfig.x) / scale - width / 2;
          const y = (posY - stageConfig.y) / scale - height / 2;

          const id = uuidv4();
          addElement({ id, type: 'image', x, y, width, height, src });
          setSelection([id]);
          setActiveTool('select');

          // Auto-archive uploaded images (data URLs survive reload).
          useAssetLibraryStore.getState().addAsset({
            kind: 'image',
            src,
            name: file.name || '上传图像',
            width,
            height,
            source: 'uploaded',
          });
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQuickAdd = (type: 'text' | 'image' | 'video' | 'audio') => {
    if (!quickAddMenu) return;
    
    let defaultWidth = 480;
    let defaultHeight = 360;
    if (type === 'text') { defaultWidth = 360; defaultHeight = 240; }
    else if (type === 'video') { defaultWidth = 520; defaultHeight = 360; }
    else if (type === 'audio') { defaultWidth = 300; defaultHeight = 80; }

    const id = uuidv4();
    const newEl: any = { 
      id, 
      type, 
      x: quickAddMenu.canvasX, 
      y: quickAddMenu.canvasY - defaultHeight / 2, // Center vertically
      width: defaultWidth, 
      height: defaultHeight, 
      text: type === 'text' ? '' : undefined,
      fontSize: type === 'text' ? 14 : undefined,
      fontFamily: type === 'text' ? 'sans-serif' : undefined,
      fill: type === 'text' ? '#1f2937' : undefined, 
      src: type !== 'text' ? '' : undefined,
    };
    
    // Auto-generate input/output ports based on useCanvasStore logic by calling addElement
    addElement(newEl);
    setSelection([id]);
    setActiveTool('select');

    // Small timeout to allow store to update and assign port IDs
    setTimeout(() => {
      const state = useCanvasStore.getState();
      const addedEl = state.elements.find(e => e.id === id);
      if (addedEl && quickAddMenu.fromElementId && quickAddMenu.fromPortId) {
        // Find compatible port
        const targetPort = addedEl.inputs?.find(p => p.type === quickAddMenu.fromPortType || p.type === 'any' || quickAddMenu.fromPortType === 'any');
        if (targetPort) {
          state.addConnection({
            id: uuidv4(),
            fromId: quickAddMenu.fromElementId,
            fromPortId: quickAddMenu.fromPortId,
            toId: addedEl.id,
            toPortId: targetPort.id,
          });
        }
      }
    }, 50);

    setQuickAddMenu(null);
  };

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
          {/* Render Connections */}
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
            
            // Two-pass ink line: a soft, wider wash underneath + a crisp
            // stroke on top. Approximates the "brush bleed" of ink on
            // paper without needing an SVG turbulence filter in Konva.
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

          {/* Active drawing connection — thinner ink stroke, tight dash */}
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

          <CanvasElements />
          
          {/* Selection box — hand-drawn ink dashed rect */}
          {selectionBox && (
             <Rect
                x={selectionBox.x}
                y={selectionBox.y}
                width={selectionBox.width}
                height={selectionBox.height}
                fill="rgba(40, 30, 20, 0.04)"
                stroke={INK_LINE}
                strokeWidth={1.2}
                dash={[6, 4]}
                cornerRadius={4}
                opacity={0.75}
             />
          )}

          {/* Marquee export rectangle — terracotta ink dashed border */}
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

      {/* Per-node input bars — only show for currently selected image/video/text nodes */}
      {stageConfig.scale >= INPUT_BAR_VISIBLE_SCALE && (
        <div className="absolute inset-0 pointer-events-none">
          {elements
            .filter(el =>
              selectedIds.includes(el.id) &&
              (el.type === 'image' || el.type === 'video' || el.type === 'text')
            )
            .map(el => {
              const canvasX = el.x;
              const canvasY = el.y + el.height + INPUT_BAR_GAP_CANVAS;
              const barMin = INPUT_BAR_MIN_WIDTH_BY_TYPE[el.type] ?? INPUT_BAR_MIN_WIDTH_FALLBACK;
              const canvasWidth = Math.max(el.width, barMin);
              const screenX = stageConfig.x + canvasX * stageConfig.scale;
              const screenY = stageConfig.y + canvasY * stageConfig.scale;
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

      {/* F15: Inpaint overlay — rendered only when an inpaint session is
          active. Sits directly over the target image node in screen coords,
          catching pointer events to draw the rewrite rectangle. */}
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

      {/* F24: Node note indicator — shown on node top-right. Visible
          whenever the node has a stored note OR is currently selected
          (so it also serves as the "add note" entry point). Scales with
          the stage zoom to stay readable. */}
      <div className="absolute inset-0 pointer-events-none">
        {elements
          .filter(el => {
            const hasNote =
              typeof (el as any).note === 'string' && (el as any).note.trim().length > 0;
            return hasNote || selectedIds.includes(el.id);
          })
          .map(el => {
            const canvasRightX = el.x + el.width;
            const canvasTopY = el.y;
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

      {/* F2: Version switcher — shown above selected image/video nodes that
          have 2+ archived versions. Doesn't participate in the INPUT_BAR
          visibility gate because it's useful even at small scales (single
          row, non-interactive when zoomed out). */}
      <div className="absolute inset-0 pointer-events-none">
        {elements
          .filter(el =>
            selectedIds.includes(el.id) &&
            (el.type === 'image' || el.type === 'video') &&
            Array.isArray((el as any).versions) &&
            (el as any).versions.length >= 2
          )
          .map(el => {
            // Top-center of the node, in screen coords.
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

      {/* Quick Add Menu Overlay */}
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
        </div>
      )}

      {/* Marquee-export UI overlays */}
      {marquee.active && (
        <>
          {/* Top hint banner, visible while awaiting / drawing. */}
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

          {/* Confirmation toolbar, placed above the drawn rect. */}
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

      {/* Mini Zoom Control — sits bottom-left under the ToolDock */}
      <div
        className="chip-paper chip-paper--flat absolute flex items-center mono"
        style={{
          bottom: 16,
          left: 16,
          padding: '2px 4px',
          fontSize: 10.5,
          color: 'var(--ink-1)',
          zIndex: 30,
        }}
      >
        <button
          className="btn btn-ghost btn-icon"
          style={{ width: 22, height: 22, padding: 0 }}
          onClick={() => setStageConfig({ scale: Math.max(0.1, stageConfig.scale / 1.1) })}
        >
          −
        </button>
        <span
          style={{
            minWidth: 40,
            textAlign: 'center',
            color: 'var(--ink-0)',
            fontWeight: 500,
          }}
        >
          {Math.round(stageConfig.scale * 100)}%
        </span>
        <button
          className="btn btn-ghost btn-icon"
          style={{ width: 22, height: 22, padding: 0 }}
          onClick={() => setStageConfig({ scale: Math.min(5, stageConfig.scale * 1.1) })}
        >
          +
        </button>
      </div>
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
