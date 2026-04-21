import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { v4 as uuidv4 } from 'uuid';
import { useCanvasStore } from '../../store/useCanvasStore';
import { CanvasElements } from './CanvasElements';

export function InfiniteCanvas() {
  const { stageConfig, setStageConfig, activeTool, setActiveTool, setSelection, addElement } = useCanvasStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Temporary state for drag-to-draw
  const [drawingShape, setDrawingShape] = useState<{
    type: 'rectangle' | 'circle' | 'sticky' | 'image' | 'video' | 'audio';
    startX: number;
    startY: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

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

  // Handle Zoom (Mouse Wheel)
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

    // Zoom in on scroll up, zoom out on scroll down
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    
    // Cap limits
    if (newScale < 0.1 || newScale > 5) return;

    setStageConfig({
      scale: newScale,
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  // Handle pointer down (initiate drawing, select, or text placement)
  const handlePointerDown = (e: KonvaEventObject<PointerEvent>) => {
    // Handle Middle Mouse Button Panning
    if (e.evt.button === 1) {
      e.evt.preventDefault();
      isPanningRef.current = true;
      lastPanPositionRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      document.body.style.cursor = 'grabbing';
      return;
    }

    // Deselect if clicking on empty stage and using select tool
    if (activeTool === 'select' && e.target === e.target.getStage()) {
      setSelection([]);
      return;
    }

    const stage = e.target.getStage();
    if (!stage) return;
    
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    const scale = stage.scaleX();
    // Calculate true coordinates in the infinite canvas
    const x = (pointer.x - stage.x()) / scale;
    const y = (pointer.y - stage.y()) / scale;

    // Handle drag-to-draw for shapes
    if (['rectangle', 'circle', 'sticky', 'text', 'image', 'video', 'audio'].includes(activeTool)) {
      setDrawingShape({
        type: activeTool as any,
        startX: x,
        startY: y,
        x: x,
        y: y,
        width: 0,
        height: 0
      });
      return;
    }
  };

  const handlePointerMove = (e: KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    
    // Middle Mouse Panning Logic
    if (isPanningRef.current) {
      e.evt.preventDefault();
      const dx = e.evt.clientX - lastPanPositionRef.current.x;
      const dy = e.evt.clientY - lastPanPositionRef.current.y;
      setStageConfig({
        x: stage.x() + dx,
        y: stage.y() + dy
      });
      lastPanPositionRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      return;
    }

    if (!drawingShape) return;
    
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    const scale = stage.scaleX();
    const currentX = (pointer.x - stage.x()) / scale;
    const currentY = (pointer.y - stage.y()) / scale;
    
    const newX = Math.min(drawingShape.startX, currentX);
    const newY = Math.min(drawingShape.startY, currentY);
    const newWidth = Math.abs(currentX - drawingShape.startX);
    const newHeight = Math.abs(currentY - drawingShape.startY);

    setDrawingShape(prev => prev ? {
      ...prev,
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight
    } : null);
  };

  const handlePointerUp = (e: KonvaEventObject<PointerEvent>) => {
    // Stop Middle Mouse Panning
    if (isPanningRef.current) {
      isPanningRef.current = false;
      document.body.style.cursor = '';
      return;
    }

    if (drawingShape) {
      const isMedia = ['image', 'video', 'audio'].includes(drawingShape.type);
      
      let defaultWidth = 100;
      let defaultHeight = 100;
      
      if (drawingShape.type === 'sticky') { defaultWidth = 200; defaultHeight = 200; }
      else if (drawingShape.type === 'text') { defaultWidth = 360; defaultHeight = 240; }
      else if (drawingShape.type === 'image' || drawingShape.type === 'video') { defaultWidth = 320; defaultHeight = 240; }
      else if (drawingShape.type === 'audio') { defaultWidth = 300; defaultHeight = 80; }

      // If the user actually dragged a reasonable size
      if (drawingShape.width > 5 || drawingShape.height > 5) {
        const id = uuidv4();
        addElement({ 
          id, 
          type: drawingShape.type, 
          x: drawingShape.x, 
          y: drawingShape.y, 
          width: drawingShape.width, 
          height: drawingShape.height, 
          text: drawingShape.type === 'sticky' ? '📝 点击编辑便签内容...' : drawingShape.type === 'text' ? '' : undefined,
          fontSize: drawingShape.type === 'text' ? 14 : undefined,
          fontFamily: drawingShape.type === 'text' ? 'sans-serif' : undefined,
          fill: drawingShape.type === 'rectangle' ? '#3b82f6' : drawingShape.type === 'circle' ? '#10b981' : drawingShape.type === 'sticky' ? '#fef08a' : drawingShape.type === 'text' ? '#1f2937' : undefined, 
          src: isMedia ? '' : undefined,
          cornerRadius: drawingShape.type === 'rectangle' ? 12 : undefined 
        } as any);
        setActiveTool('select');
        setSelection([id]);
      } else {
        // Fallback: simple click without dragging -> draw a default size
        const id = uuidv4();
        addElement({ 
          id, 
          type: drawingShape.type, 
          x: drawingShape.startX - defaultWidth / 2, 
          y: drawingShape.startY - defaultHeight / 2, 
          width: defaultWidth, 
          height: defaultHeight, 
          text: drawingShape.type === 'sticky' ? '📝 点击编辑便签内容...' : drawingShape.type === 'text' ? '' : undefined,
          fontSize: drawingShape.type === 'text' ? 14 : undefined,
          fontFamily: drawingShape.type === 'text' ? 'sans-serif' : undefined,
          fill: drawingShape.type === 'rectangle' ? '#3b82f6' : drawingShape.type === 'circle' ? '#10b981' : drawingShape.type === 'sticky' ? '#fef08a' : drawingShape.type === 'text' ? '#1f2937' : undefined, 
          src: isMedia ? '' : undefined,
          cornerRadius: drawingShape.type === 'rectangle' ? 12 : undefined 
        } as any);
        setActiveTool('select');
        setSelection([id]);
      }
      setDrawingShape(null);
    }
  };

  // Handle Desktop File Drag & Drop
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
        draggable={activeTool === 'select' || activeTool === 'hand'}
        onDragEnd={(e) => {
          if ((activeTool === 'select' || activeTool === 'hand') && e.target === e.target.getStage()) {
            setStageConfig({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={
          activeTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : 
          activeTool === 'select' ? 'cursor-default active:cursor-grab' : 'cursor-crosshair'
        }
      >
        <Layer>
          <CanvasElements />
          
          {/* Render ongoing drawing shape */}
          {drawingShape && drawingShape.type === 'rectangle' && (
             <Rect
               x={drawingShape.x}
               y={drawingShape.y}
               width={drawingShape.width}
               height={drawingShape.height}
               fill="#3b82f6"
               opacity={0.5}
               cornerRadius={12}
             />
          )}
          {drawingShape && drawingShape.type === 'circle' && (
             <Rect
               x={drawingShape.x}
               y={drawingShape.y}
               width={drawingShape.width}
               height={drawingShape.height}
               fill="#10b981"
               opacity={0.5}
               cornerRadius={Math.min(drawingShape.width, drawingShape.height) / 2}
             />
          )}
          {drawingShape && drawingShape.type === 'sticky' && (
             <Rect
               x={drawingShape.x}
               y={drawingShape.y}
               width={drawingShape.width}
               height={drawingShape.height}
               fill="#fef08a" // yellow wrapper
               opacity={0.7}
               shadowColor="#000"
               shadowBlur={15}
               shadowOpacity={0.1}
               shadowOffset={{ x: 0, y: 8 }}
               cornerRadius={2}
             />
          )}
          {drawingShape && ['text', 'image', 'video', 'audio'].includes(drawingShape.type) && (
             <Rect
               x={drawingShape.x}
               y={drawingShape.y}
               width={drawingShape.width}
               height={drawingShape.height}
               fill="#cbd5e1"
               opacity={0.5}
               dash={[5, 5]}
               stroke="#475569"
               strokeWidth={2}
               cornerRadius={8}
             />
          )}
        </Layer>
      </Stage>

      {/* Mini Viewport Info */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-gray-200/50">
        <button 
          className="p-1 hover:bg-gray-100/50 rounded-full text-gray-500"
          onClick={() => setStageConfig({ scale: Math.max(0.1, stageConfig.scale / 1.1) })}
        >
          -
        </button>
        <span className="text-[10px] font-bold min-w-[36px] text-center text-gray-700">
          {Math.round(stageConfig.scale * 100)}%
        </span>
        <button 
          className="p-1 hover:bg-gray-100/50 rounded-full text-gray-500"
          onClick={() => setStageConfig({ scale: Math.min(5, stageConfig.scale * 1.1) })}
        >
          +
        </button>
      </div>
    </div>
  );
}
