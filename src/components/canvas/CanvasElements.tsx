import React, { useRef, useEffect } from 'react';
import { Rect, Text, Group, Transformer, Image as KonvaImage } from 'react-konva';
import { Html } from 'react-konva-utils';
import useImage from 'use-image';
import { Loader2, Sparkles } from 'lucide-react';
import { useCanvasStore } from '../../store/useCanvasStore';

// Helper component for loading image references
function URLImage({ el, commonProps }: { el: any, commonProps: any }) {
  const [img] = useImage(el.src || '');
  if (!el.src) {
    return (
      <Group {...commonProps}>
         <Rect width={el.width} height={el.height} fill="#e2e8f0" cornerRadius={8} stroke="#cbd5e1" strokeWidth={1} />
         <Text text="🖼️ 空白图片" width={el.width} height={el.height} align="center" verticalAlign="middle" fill="#64748b" fontSize={14} />
      </Group>
    );
  }
  return <KonvaImage image={img} {...commonProps} />;
}

export function CanvasElements() {
  const { elements, selectedIds, setSelection, updateElement, activeTool } = useCanvasStore();
  const trRef = useRef<any>(null);

  // Attach transformer to selected nodes
  useEffect(() => {
    if (trRef.current) {
      const stage = trRef.current.getStage();
      const selectedNodes = selectedIds
        .map((id) => stage.findOne(`#${id}`))
        .filter((node) => node !== undefined);
        
      trRef.current.nodes(selectedNodes);
      trRef.current.getLayer().batchDraw();
    }
  }, [selectedIds, elements]);

  return (
    <>
      {elements.map((el) => {
        const isSelected = selectedIds.includes(el.id);
        const { id, x, y, rotation, width, height } = el;
        
        // Base props applied to all rendered Konva nodes
        const commonProps = {
          id,
          x,
          y,
          width,
          height,
          rotation: rotation || 0,
          draggable: activeTool === 'select' && !el.isLocked,
          // Handle selection
          onPointerDown: (e: any) => {
            if (activeTool === 'select') {
              e.cancelBubble = true;
              
              // Multi-select with Shift key
              const isShiftPressed = e.evt.shiftKey;
              if (isShiftPressed) {
                if (isSelected) {
                  setSelection(selectedIds.filter((selId) => selId !== id));
                } else {
                  setSelection([...selectedIds, id]);
                }
              } else {
                setSelection([id]);
              }
            }
          },
          // Handle drag end
          onDragEnd: (e: any) => {
            updateElement(id, {
              x: e.target.x(),
              y: e.target.y(),
            });
          },
          // Handle transform (resize/rotate) end
          onTransformEnd: (e: any) => {
            const node = e.target;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            
            // Reset scale back to 1 and explicitly set width/height
            node.scaleX(1);
            node.scaleY(1);
            
            updateElement(id, {
              x: node.x(),
              y: node.y(),
              rotation: node.rotation(),
              width: Math.max(5, node.width() * scaleX),
              height: Math.max(5, node.height() * scaleY),
            });
          },
        };

        if (el.type === 'rectangle') {
          const shape = el as any;
          return (
            <Rect 
              key={id} 
              {...commonProps} 
              fill={shape.fill || '#e5e7eb'} 
              stroke={shape.stroke}
              strokeWidth={shape.strokeWidth}
              cornerRadius={shape.cornerRadius || 8} 
            />
          );
        }
        
        if (el.type === 'circle') {
          const shape = el as any;
          // Render circles using Rect with dynamic corner radius (50% of min dimension) to support non-uniform scaling/ellipses gracefully
          return (
            <Rect 
              key={id} 
              {...commonProps} 
              fill={shape.fill || '#e5e7eb'} 
              stroke={shape.stroke}
              strokeWidth={shape.strokeWidth}
              cornerRadius={Math.min(width, height) / 2} 
            />
          );
        }

        if (el.type === 'text') {
          const textEl = el as any;
          return (
            <Text 
              key={id} 
              {...commonProps} 
              text={textEl.text} 
              fontSize={textEl.fontSize || 16} 
              fill={textEl.fill || '#1a1a1b'} 
              fontFamily={textEl.fontFamily || 'sans-serif'} 
            />
          );
        }

        if (el.type === 'image') {
          return <URLImage key={id} el={el} commonProps={commonProps} />;
        }

        if (el.type === 'sticky') {
          const sticky = el as any;
          return (
            <Group key={id} {...commonProps}>
              <Rect 
                width={width}
                height={height}
                fill={sticky.fill || '#fef08a'} 
                shadowColor="#000"
                shadowBlur={15}
                shadowOpacity={0.1}
                shadowOffset={{ x: 0, y: 8 }}
                cornerRadius={2}
              />
              <Text 
                text={sticky.text || ''}
                width={Math.max(0, width - 24)}
                height={Math.max(0, height - 24)}
                x={12}
                y={12}
                fontSize={16}
                fill="#374151" // dark gray for better readability
                fontFamily="sans-serif"
                wrap="word"
                ellipsis={true}
              />
            </Group>
          );
        }

        if (el.type === 'aigenerating') {
          return (
            <Group key={id} {...commonProps}>
              <Rect width={width} height={height} fill="transparent" />
              <Html divProps={{ style: { pointerEvents: 'none' } }}>
                <div style={{ width, height, borderRadius: 12, overflow: 'hidden', position: 'relative', boxShadow: '0 8px 32px rgba(168, 85, 247, 0.2)', border: '2px solid rgba(168, 85, 247, 0.4)' }}>
                   <style>{`
                     @keyframes ai-shimmer {
                       0% { background-position: 200% 0; }
                       100% { background-position: -200% 0; }
                     }
                   `}</style>
                   <div style={{ 
                     position: 'absolute', inset: 0, 
                     background: 'linear-gradient(90deg, rgba(243,232,255,0.7) 25%, rgba(216,180,254,1) 50%, rgba(243,232,255,0.7) 75%)',
                     backgroundSize: '200% 100%',
                     animation: 'ai-shimmer 2s infinite linear' 
                   }}></div>
                   <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                      <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
                      <div className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-md rounded-full shadow-sm">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span className="text-purple-800 font-bold text-sm">正在施展 AI 魔法...</span>
                      </div>
                   </div>
                </div>
              </Html>
            </Group>
          );
        }

        if (el.type === 'video' || el.type === 'audio') {
          const media = el as any;
          return (
            <Group key={id} {...commonProps}>
              {/* Invisible rect bounding box for Konva interaction and selection borders */}
              <Rect width={width} height={height} fill="transparent" />
              
              <Html divProps={{ style: { pointerEvents: 'none' } }}>
                <div style={{ width, height, display: 'flex', flexDirection: 'column', pointerEvents: 'none' }}>
                  {/* Top Drag Handle (transparent to let Konva handle dragging underneath) */}
                  <div style={{ height: 24, background: '#cbd5e1', borderTopLeftRadius: 8, borderTopRightRadius: 8, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                     <span style={{ fontSize: 10, color: '#475569', fontWeight: 'bold' }}>
                       {el.type === 'video' ? 'VIDEO' : 'AUDIO'}
                     </span>
                  </div>
                  {/* Media container (pointer-events: auto so browser native controls work) */}
                  <div style={{ flex: 1, pointerEvents: 'auto', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottomLeftRadius: 8, borderBottomRightRadius: 8, overflow: 'hidden' }}>
                    {el.type === 'video' ? (
                       media.src ? <video controls src={media.src} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onPointerDown={(e) => e.stopPropagation()} />
                       : <div style={{width:'100%',height:'100%',display:'flex',justifyContent:'center',alignItems:'center',color:'#94a3b8',fontSize:12}}>🎥 空白视频节点</div>
                    ) : (
                       media.src ? <audio controls src={media.src} style={{ width: '90%' }} onPointerDown={(e) => e.stopPropagation()} />
                       : <div style={{width:'100%',height:'100%',display:'flex',justifyContent:'center',alignItems:'center',color:'#94a3b8',fontSize:12}}>🎵 空白音频节点</div>
                    )}
                  </div>
                </div>
              </Html>
            </Group>
          );
        }

        return null;
      })}

      {/* Control points for selected elements */}
      {selectedIds.length > 0 && activeTool === 'select' && (
        <Transformer 
          ref={trRef} 
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) return oldBox;
            return newBox;
          }}
          borderStroke="#3b82f6"
          anchorStroke="#3b82f6"
          anchorFill="#ffffff"
          anchorSize={8}
          padding={4}
        />
      )}
    </>
  );
}
