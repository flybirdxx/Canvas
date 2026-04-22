import { Search, Square, Circle, Type, Image as ImageIcon, Sparkles, Share2, Layers, Undo2, Redo2, StickyNote, Video, Music, Plus, Settings } from 'lucide-react';
import { InfiniteCanvas } from './components/canvas/InfiniteCanvas';
import { PropertiesPanel } from './components/properties/PropertiesPanel';
import { SettingsModal } from './components/SettingsModal';
import { HistoryPanel } from './components/HistoryPanel';
import { SaveControls } from './components/SaveControls';
import { useCanvasStore } from './store/useCanvasStore';
import { useRef, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default function App() {
  const { activeTool, setActiveTool, stageConfig, addElement, setSelection, undo, redo, past, future, deleteElements, selectedIds } = useCanvasStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Check for Cmd/Ctrl + Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } 
      // Check for Cmd/Ctrl + Y (Alternative Redo)
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
      // Check for Escape to reset tool
      else if (e.key === 'Escape') {
        setActiveTool('select');
        setSelection([]);
      }
      // Check for Delete or Backspace
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          deleteElements(selectedIds);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, deleteElements, selectedIds, setActiveTool, setSelection]);

  const handleCreateNode = (type: string) => {
    const centerX = (window.innerWidth / 2 - stageConfig.x) / stageConfig.scale;
    const centerY = (window.innerHeight / 2 - stageConfig.y) / stageConfig.scale;

    let defaultWidth = 100;
    let defaultHeight = 100;
    if (type === 'sticky') { defaultWidth = 200; defaultHeight = 200; }
    else if (type === 'text') { defaultWidth = 360; defaultHeight = 240; }
    else if (type === 'image' || type === 'video') { defaultWidth = 400; defaultHeight = 300; }
    else if (type === 'audio') { defaultWidth = 300; defaultHeight = 80; }

    const id = uuidv4();
    const isMedia = ['image', 'video', 'audio'].includes(type);

    addElement({
      id,
      type: type as any,
      x: centerX - defaultWidth / 2,
      y: centerY - defaultHeight / 2,
      width: defaultWidth,
      height: defaultHeight,
      text: type === 'sticky' ? '📝 点击编辑便签内容...' : type === 'text' ? '' : undefined,
      fontSize: type === 'text' ? 14 : undefined,
      fontFamily: type === 'text' ? 'sans-serif' : undefined,
      fill: type === 'rectangle' ? '#3b82f6' : type === 'circle' ? '#10b981' : type === 'sticky' ? '#fef08a' : type === 'text' ? '#1f2937' : undefined,
      src: isMedia ? '' : undefined,
      cornerRadius: type === 'rectangle' ? 12 : undefined
    });
    setSelection([id]);
    setActiveTool('select');
  };

  return (
    <div className="w-screen h-screen bg-[#f0f2f5] text-[#1a1a1b] font-sans flex flex-col overflow-hidden select-none">
      {/* Immersive Main Workspace */}
      <main className="flex flex-1 overflow-hidden relative">
        
        {/* Floating Top Left Controls (Logo + Title + Undo/Redo) */}
        <div className="absolute top-4 left-4 flex items-center gap-3 z-20 bg-white/90 backdrop-blur-md pt-1.5 pb-1.5 pl-2 pr-4 rounded-xl shadow-sm border border-gray-200/80">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm">
            <Layers className="w-4 h-4" />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-[13px] font-bold text-gray-800 leading-tight">AI 画布 Pro</span>
            <span className="text-[10px] text-gray-400 leading-tight">未命名设计.canvas</span>
          </div>
          
          <div className="w-[1px] h-6 bg-gray-200 ml-2"></div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={undo} 
              disabled={past.length === 0}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-600"
              title="撤销 (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button 
              onClick={redo} 
              disabled={future.length === 0}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-600"
              title="重做 (Ctrl+Y 或 Ctrl+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Floating Top Right Controls (Actions) */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
          <SaveControls />
          <div className="w-[1px] h-6 bg-gray-200/80 mx-1"></div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center justify-center p-2 bg-white/90 backdrop-blur-md text-gray-600 hover:text-gray-900 shadow-sm border border-gray-200/80 rounded-lg transition-colors hover:bg-gray-50"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-white/90 backdrop-blur-md text-[11px] font-medium text-gray-700 hover:text-gray-900 shadow-sm border border-gray-200/80 rounded-lg transition-colors">
            <Sparkles className="w-4 h-4 text-purple-600" />
            AI 工作区
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-[11px] font-semibold rounded-lg shadow-sm hover:bg-blue-700 transition-colors">
            <Share2 className="w-3.5 h-3.5" />
            分享
          </button>
        </div>

        {/* Canvas Area with Dot Grid CSS Background */}
        <section 
          className="flex-1 relative overflow-hidden bg-[#fafafa] shadow-inner"
          style={{ 
            backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 1px)', 
            backgroundSize: `${20 * stageConfig.scale}px ${20 * stageConfig.scale}px`,
            backgroundPosition: `${stageConfig.x}px ${stageConfig.y}px`
          }}
        >
          <InfiniteCanvas />
          
          {/* Floating UI Elements */}
          <PropertiesPanel />

          {/* History timeline panel */}
          <HistoryPanel />
          
          {/* Floating Capsule Toolbar */}
          <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col items-center bg-white/90 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200/80 rounded-full px-2 py-3 gap-2 z-20">
            <div className="relative group/media self-stretch flex justify-center">
              <div className="relative w-10 h-10 flex items-center justify-center rounded-full cursor-pointer transition-all duration-300 z-10 shadow-sm bg-gray-900 text-white hover:bg-gray-800 hover:shadow-md">
                <Plus className="w-5 h-5 transition-transform duration-300 group-hover/media:rotate-90" strokeWidth={2.5} />
                
                {/* Invisible hover bridge */}
                <div className="absolute left-full top-0 w-8 h-full pointer-events-auto invisible group-hover/media:visible transition-all delay-500 group-hover/media:delay-0 z-0"></div>
              </div>
              
              <div className="absolute left-full top-0 ml-4 invisible opacity-0 -translate-x-4 group-hover/media:visible group-hover/media:opacity-100 group-hover/media:translate-x-0 transition-all duration-300 delay-500 group-hover/media:delay-0 z-50 w-[280px]">
                <div className="bg-white/95 backdrop-blur-xl shadow-[0_20px_60px_rgb(0,0,0,0.15)] border border-gray-200/80 rounded-[20px] p-2.5 flex flex-col gap-3 text-left">
                  {/* Search Bar */}
                  <div className="relative flex items-center mt-1 mx-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3" />
                    <input type="text" placeholder="Search nodes and models" className="w-full bg-gray-100/60 hover:bg-gray-100 border border-solid border-transparent focus:border-blue-300 focus:bg-white transition-colors rounded-xl py-2 pl-9 pr-3 text-[13px] outline-none text-gray-700 placeholder-gray-400" />
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <div className="text-[11px] font-semibold text-gray-400 px-3 py-1.5 mt-1">Add Node</div>
                    <MenuItem icon={<Type />} title="Text" desc="Generate and edit" hotkey="T" onClick={() => handleCreateNode('text')} active={false} />
                    <MenuItem icon={<ImageIcon />} title="Image" desc="Generate, edit, and upload" hotkey="I" onClick={() => handleCreateNode('image')} active={false} />
                    <MenuItem icon={<Video />} title="Video" desc="Generate, edit, and upload" hotkey="V" onClick={() => handleCreateNode('video')} active={false} />
                    <MenuItem icon={<Music />} title="Audio" desc="Generate audio from text" hotkey="A" onClick={() => handleCreateNode('audio')} active={false} />
                  </div>

                  <div className="h-[1px] w-[calc(100%-8px)] mx-auto bg-gray-100 my-0.5"></div>

                  <div className="flex flex-col gap-0.5 mb-1">
                    <div className="text-[11px] font-semibold text-gray-400 px-3 py-1.5">Utilities</div>
                    <MenuItem icon={<Layers />} title="Layer Editor" desc="Combine images together" hotkey="L" />
                  </div>
                </div>
              </div>
            </div>

            <div className="h-[1px] w-6 bg-gray-200 my-1"></div>

            <ToolButton icon={<Square />} label="矩形" tool="rectangle" active={false} onClick={() => handleCreateNode('rectangle')} />
            <ToolButton icon={<Circle />} label="圆形" tool="circle" active={false} onClick={() => handleCreateNode('circle')} />
            <ToolButton icon={<StickyNote />} label="便签" tool="sticky" active={false} onClick={() => handleCreateNode('sticky')} />
          </div>
        </section>

      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  );
}

// Helper toolbar button component
function ToolButton({ icon, active, onClick, label, placement = 'right' }: any) {
  const tooltipClass = placement === 'top' 
    ? "bottom-full mb-3 left-1/2 -translate-x-1/2" 
    : "left-full ml-3 top-1/2 -translate-y-1/2";

  return (
    <div 
      className={`relative w-10 h-10 flex items-center justify-center rounded-full cursor-pointer transition-all duration-200 group/btn shrink-0 ${
        active 
          ? 'bg-blue-100 text-blue-600 shadow-inner' 
          : 'text-gray-500 hover:bg-gray-100'
      }`}
      onClick={onClick}
    >
      <div className="w-5 h-5 [&>svg]:w-full [&>svg]:h-full [&>svg]:stroke-[2px]">{icon}</div>
      <div className={`absolute px-2 py-1 bg-gray-800 text-white text-[10px] font-medium rounded opacity-0 group-hover/btn:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-md transition-opacity duration-200 ${tooltipClass}`}>
        {label}
      </div>
    </div>
  );
}

// Helper menu item for the rich popout menu
function MenuItem({ icon, title, desc, hotkey, onClick, active }: any) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${active ? 'bg-blue-50' : 'hover:bg-gray-100/80'}`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-blue-100 text-blue-600' : 'bg-white shadow-sm border border-gray-200 text-gray-500'}`}>
        <div className="w-[18px] h-[18px] [&>svg]:w-full [&>svg]:h-full [&>svg]:stroke-[2px]">{icon}</div>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <span className={`text-[13px] font-semibold leading-tight ${active ? 'text-blue-700' : 'text-gray-800'}`}>{title}</span>
        <span className="text-[11px] text-gray-400 leading-tight mt-0.5">{desc}</span>
      </div>
      {hotkey && (
        <div className="text-[12px] font-medium text-gray-400 w-5 text-right pr-1">{hotkey}</div>
      )}
    </div>
  );
}
