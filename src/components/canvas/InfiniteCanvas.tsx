import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Line } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { v4 as uuidv4 } from 'uuid';
import { useCanvasStore } from '../../store/useCanvasStore';
import { CanvasElements } from './CanvasElements';
import { CanvasElement } from '../../types/canvas';
import { NodeInputBar } from '../NodeInputBar';
import { Type, ImageIcon, Video, Music } from 'lucide-react'; // For Quick Add Menu

// Bar 的宽度和间距用画布单位表达，由 CSS transform:scale 在渲染时等比缩放。
const INPUT_BAR_MIN_WIDTH_CANVAS = 340;
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

function getPortColor(type: string) {
  switch (type) {
    case 'text': return '#10b981'; // emerald
    case 'image': return '#8b5cf6'; // violet
    case 'video': return '#ef4444'; // red
    case 'audio': return '#f59e0b'; // amber
    default: return '#94a3b8'; // slate
  }
}

export function InfiniteCanvas() {
  const { 
    stageConfig, setStageConfig, 
    activeTool, setActiveTool, 
    setSelection, addElement, 
    elements, connections, addConnection,
    drawingConnection, setDrawingConnection,
    selectedIds,
  } = useCanvasStore();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

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
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQuickAdd = (type: 'text' | 'image' | 'video' | 'audio') => {
    if (!quickAddMenu) return;
    
    let defaultWidth = 400;
    let defaultHeight = 300;
    if (type === 'text') { defaultWidth = 360; defaultHeight = 240; }
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
        width={size.width}
        height={size.height}
        scaleX={stageConfig.scale}
        scaleY={stageConfig.scale}
        x={stageConfig.x}
        y={stageConfig.y}
        onWheel={handleWheel}
        draggable={(activeTool === 'select' || activeTool === 'hand' || isSpacePressed) && !drawingConnection && !selectionBox}
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
            
            return (
              <Line
                key={conn.id}
                points={getBezierPoints(startX, startY, endX, endY)}
                stroke={getPortColor(fromPortType)}
                strokeWidth={3}
                bezier={true}
              />
            );
          })}

          {/* Render Active Drawing Connection */}
          {drawingConnection && (
            <Line
              points={getBezierPoints(drawingConnection.startX, drawingConnection.startY, drawingConnection.toX, drawingConnection.toY)}
              stroke={getPortColor(drawingConnection.fromPortType)}
              strokeWidth={3}
              dash={[6, 6]}
              bezier={true}
            />
          )}

          <CanvasElements />
          
          {/* Render Selection Box */}
          {selectionBox && (
             <Rect 
                x={selectionBox.x} 
                y={selectionBox.y} 
                width={selectionBox.width} 
                height={selectionBox.height} 
                fill="rgba(59, 130, 246, 0.1)" 
                stroke="rgba(59, 130, 246, 0.5)" 
                strokeWidth={1} 
                cornerRadius={4}
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
              const canvasWidth = Math.max(el.width, INPUT_BAR_MIN_WIDTH_CANVAS);
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

      {/* Quick Add Menu Overlay */}
      {quickAddMenu && (
        <div 
          className="absolute z-50 bg-white/95 backdrop-blur-xl shadow-[0_20px_60px_rgb(0,0,0,0.15)] border border-gray-200/80 rounded-[16px] p-2 flex flex-col gap-1 w-[200px]"
          style={{ left: quickAddMenu.x + 10, top: quickAddMenu.y - 10 }}
        >
          <div className="text-[11px] font-semibold text-gray-400 px-3 py-1.5">Quick Add Node</div>
          <button className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded-lg text-left transition-colors" onClick={() => handleQuickAdd('text')}>
            <Type className="w-4 h-4 text-emerald-500" />
            <span className="text-sm text-gray-700 font-medium">Text</span>
          </button>
          <button className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded-lg text-left transition-colors" onClick={() => handleQuickAdd('image')}>
            <ImageIcon className="w-4 h-4 text-violet-500" />
            <span className="text-sm text-gray-700 font-medium">Image</span>
          </button>
          <button className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded-lg text-left transition-colors" onClick={() => handleQuickAdd('video')}>
            <Video className="w-4 h-4 text-red-500" />
            <span className="text-sm text-gray-700 font-medium">Video</span>
          </button>
          <button className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded-lg text-left transition-colors" onClick={() => handleQuickAdd('audio')}>
            <Music className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-gray-700 font-medium">Audio</span>
          </button>
        </div>
      )}

      {/* Mini Viewport Info */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-gray-200/50">
        <button className="p-1 hover:bg-gray-100/50 rounded-full text-gray-500" onClick={() => setStageConfig({ scale: Math.max(0.1, stageConfig.scale / 1.1) })}>-</button>
        <span className="text-[10px] font-bold min-w-[36px] text-center text-gray-700">{Math.round(stageConfig.scale * 100)}%</span>
        <button className="p-1 hover:bg-gray-100/50 rounded-full text-gray-500" onClick={() => setStageConfig({ scale: Math.min(5, stageConfig.scale * 1.1) })}>+</button>
      </div>
    </div>
  );
}
