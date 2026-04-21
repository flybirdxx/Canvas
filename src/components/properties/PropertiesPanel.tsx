import React from 'react';
import { Layers, Type, Square, Settings2, Trash2, Link2, Upload, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
import { useCanvasStore } from '../../store/useCanvasStore';

export function PropertiesPanel() {
  const { elements, selectedIds, updateElement, deleteElements } = useCanvasStore();
  
  if (selectedIds.length === 0) return null;

  // For MVP: We only show properties for the first selected element
  const selectedId = selectedIds[0];
  const el = elements.find(e => e.id === selectedId);

  if (!el) return null;

  return (
    <div className="absolute top-20 right-4 w-64 bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-xl shadow-xl z-20 flex flex-col overflow-hidden max-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-gray-500" />
          <span className="text-[12px] font-bold text-gray-700">属性配置</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 font-mono uppercase bg-gray-100 px-1.5 py-0.5 rounded">
            {el.type}
          </span>
          <button 
            onClick={() => deleteElements([el.id])}
            className="p-1 hover:bg-red-100 text-gray-400 hover:text-red-500 rounded transition-colors"
            title="删除元素 (Delete / Backspace)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
        
        {/* Transform - Layout Group */}
        <div className="flex flex-col gap-3">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><Layers className="w-3 h-3" /> 布局</h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-gray-500">X 坐标</label>
              <input type="number" 
                     value={Math.round(el.x)} 
                     onChange={(e) => updateElement(el.id, { x: Number(e.target.value) })}
                     className="bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-gray-500">Y 坐标</label>
              <input type="number" 
                     value={Math.round(el.y)} 
                     onChange={(e) => updateElement(el.id, { y: Number(e.target.value) })}
                     className="bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />
            </div>
            
            {(el.type === 'rectangle' || el.type === 'circle' || el.type === 'image' || el.type === 'sticky' || el.type === 'video' || el.type === 'audio') && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-500">宽度 (W)</label>
                  <input type="number" 
                         value={Math.round(el.width)} 
                         onChange={(e) => updateElement(el.id, { width: Math.max(5, Number(e.target.value)) })}
                         className="bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-500">高度 (H)</label>
                  <input type="number" 
                         value={Math.round(el.height)} 
                         onChange={(e) => updateElement(el.id, { height: Math.max(5, Number(e.target.value)) })}
                         className="bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="h-[1px] w-full bg-gray-100"></div>

        {/* Media / Link Appearance */}
        {(el.type === 'image' || el.type === 'video' || el.type === 'audio') && (
          <div className="flex flex-col gap-3">
             <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Link2 className="w-3 h-3" /> 媒体源设置
             </h4>
             
             <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-500">外部链接地址 (URL)</label>
                <input 
                  type="text" 
                  placeholder="https://"
                  value={(el as any).src || ''}
                  onChange={(e) => updateElement(el.id, { src: e.target.value })}
                  className="bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-[11px] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                />
                
                <div className="relative mt-2">
                  <input 
                    type="file"
                    accept={el.type + "/*"}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      // Use Base64 for images, ObjectURL for larger video/audio media chunks
                      if (el.type === 'image') {
                        const reader = new FileReader();
                        reader.onload = (ev) => updateElement(el.id, { src: ev.target?.result as string });
                        reader.readAsDataURL(file);
                      } else {
                        updateElement(el.id, { src: URL.createObjectURL(file) });
                      }
                      e.target.value = '';
                    }}
                  />
                  <div className="flex items-center justify-center gap-1.5 w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-1.5 rounded-md transition-colors pointer-events-none shadow-sm">
                    <Upload className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-medium">从本地上传 {el.type === 'image' ? '图片' : el.type === 'video' ? '视频' : '音频'}</span>
                  </div>
                </div>
             </div>
          </div>
        )}

        {/* Separator for media specific */}
        {(el.type === 'image' || el.type === 'video' || el.type === 'audio') && (
           <div className="h-[1px] w-full bg-gray-100"></div>
        )}

        {/* Shape / Text Appearance */}
        {(el.type === 'rectangle' || el.type === 'circle' || el.type === 'text' || el.type === 'sticky') && (
          <div className="flex flex-col gap-3">
             <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                {el.type === 'text' ? <Type className="w-3 h-3" /> : <Square className="w-3 h-3" />} 
                外观与内容
             </h4>
             
             {(el.type === 'text' || el.type === 'sticky') && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-500">内容</label>
                  <textarea 
                    value={(el as any).text} 
                    onChange={(e) => updateElement(el.id, { text: e.target.value })}
                    className="bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-[11px] resize-y min-h-[60px] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  />
                  {el.type === 'text' && (
                    <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-gray-100">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-500">字体 (Font)</label>
                        <select 
                          value={(el as any).fontFamily || 'sans-serif'}
                          onChange={(e) => updateElement(el.id, { fontFamily: e.target.value })}
                          className="bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-[11px] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                        >
                          <option value="sans-serif">Sans-Serif</option>
                          <option value="serif">Serif</option>
                          <option value="monospace">Monospace</option>
                          <option value="Inter">Inter</option>
                          <option value="Comic Sans MS">Comic Sans</option>
                          <option value="Arial">Arial</option>
                          <option value="Times New Roman">Times New Roman</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-500 flex justify-between">
                          <span>字号 (Size)</span>
                          <span className="font-mono">{(el as any).fontSize || 16}px</span>
                        </label>
                        <input 
                           type="range" min="8" max="120" 
                           value={(el as any).fontSize || 16}
                           onChange={(e) => updateElement(el.id, { fontSize: Number(e.target.value) })}
                           className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-gray-500">对齐 (Align)</label>
                          <div className="flex bg-gray-100 p-0.5 rounded-md border border-gray-200/80">
                            {[
                              { id: 'left', icon: <AlignLeft className="w-3" /> },
                              { id: 'center', icon: <AlignCenter className="w-3" /> },
                              { id: 'right', icon: <AlignRight className="w-3" /> },
                              { id: 'justify', icon: <AlignJustify className="w-3" /> }
                            ].map(btn => (
                              <button 
                                key={btn.id}
                                onClick={() => updateElement(el.id, { align: btn.id })}
                                className={`flex-1 flex justify-center py-1 rounded transition-colors ${((el as any).align || 'left') === btn.id ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                              >
                                {btn.icon}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-gray-500">行高 (Line Height)</label>
                          <input 
                            type="number" 
                            step="0.1"
                            min="0.5"
                            max="5"
                            value={(el as any).lineHeight || 1.2} 
                            onChange={(e) => updateElement(el.id, { lineHeight: Number(e.target.value) })}
                            className="bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 h-[26px]" 
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 mt-1">
                        <label className="text-[10px] text-gray-500 block">颜色 (Color)</label>
                        <div className="flex gap-2">
                          <ColorPicker 
                            value={(el as any).fill}
                            onChange={(color) => updateElement(el.id, { fill: color })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
             )}

             {(el.type === 'rectangle' || el.type === 'circle' || el.type === 'sticky') && (
                <div className="flex flex-col gap-2 mt-2">
                  <label className="text-[10px] text-gray-500 block">背景颜色 (Fill)</label>
                  <ColorPicker 
                    value={(el as any).fill}
                    onChange={(color) => updateElement(el.id, { fill: color })}
                  />
                  
                  {el.type === 'rectangle' && (
                     <div className="mt-2 flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-500 flex justify-between">
                          <span>圆角 (Radius)</span>
                          <span className="font-mono">{(el as any).cornerRadius || 0}px</span>
                        </label>
                        <input 
                           type="range" min="0" max="100" 
                           value={(el as any).cornerRadius || 0}
                           onChange={(e) => updateElement(el.id, { cornerRadius: Number(e.target.value) })}
                           className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                     </div>
                  )}
                </div>
             )}
          </div>
        )}

      </div>
    </div>
  );
}

// Helper Color Picker with presets
function ColorPicker({ value, onChange }: { value: string, onChange: (color: string) => void }) {
  const presets = ['#e5e7eb', '#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#3b82f6', '#ef4444', '#1a1a1b', '#ffffff'];
  
  return (
    <div className="flex flex-wrap gap-2">
       <input 
          type="color" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0 select-none overflow-hidden" 
       />
       {presets.map(c => (
         <div 
           key={c}
           onClick={() => onChange(c)}
           className={`w-8 h-8 rounded border cursor-pointer hover:scale-105 transition-transform ${value === c ? 'border-2 border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}
           style={{ backgroundColor: c }}
         />
       ))}
    </div>
  );
}
