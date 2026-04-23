import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { InfiniteCanvas } from './components/canvas/InfiniteCanvas';
import { PropertiesPanel } from './components/properties/PropertiesPanel';
import { SettingsModal } from './components/SettingsModal';
import { HistoryPanel } from './components/HistoryPanel';
import { AssetLibraryPanel } from './components/AssetLibraryPanel';
import { TemplatesModal } from './components/TemplatesModal';
import { AlignmentToolbar } from './components/AlignmentToolbar';
import { GenerationQueuePanel } from './components/GenerationQueuePanel';
import { Atmosphere } from './components/Atmosphere';
import { StatusBar } from './components/StatusBar';
import { TopBar } from './components/chrome/TopBar';
import { ToolDock } from './components/chrome/ToolDock';
import { exportSelection } from './utils/exportPng';
import { useCanvasStore } from './store/useCanvasStore';
import { resumePendingImageTasks } from './services/taskResume';

/**
 * App shell — Warm Paper Studio.
 *
 * Layout contract (all measurements in viewport px, chrome floats on top):
 *   z=0  canvas surface (dot grid background, Konva stage)
 *   z=1  paper grain (mix-blend: multiply)
 *   z=2  vignette
 *   z=20 Konva DOM overlays (NodeInputBar, etc.)
 *   z=30 chrome (TopBar, ToolDock, GenerationQueuePanel, StatusBar,
 *        AlignmentToolbar, PropertiesPanel, HistoryPanel, AssetLibraryPanel)
 *   z=60 modals (Settings, Templates)
 */
export default function App() {
  const activeTool = useCanvasStore(s => s.activeTool);
  const setActiveTool = useCanvasStore(s => s.setActiveTool);
  const stageConfig = useCanvasStore(s => s.stageConfig);
  const addElement = useCanvasStore(s => s.addElement);
  const setSelection = useCanvasStore(s => s.setSelection);
  const undo = useCanvasStore(s => s.undo);
  const redo = useCanvasStore(s => s.redo);
  const deleteElements = useCanvasStore(s => s.deleteElements);
  const selectedIds = useCanvasStore(s => s.selectedIds);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

  // Inline error panels request the settings modal via window event.
  useEffect(() => {
    const open = () => setIsSettingsOpen(true);
    window.addEventListener('open-settings', open);
    return () => window.removeEventListener('open-settings', open);
  }, []);

  // 启动时立即扫一次异步 provider 遗留的 pending 任务（RH 之类），之后每 3 分钟
  // 再扫一次。原因：
  //   · 启动扫描：canvas store 的 persist 此时已 rehydrate，能看到上次会话残留
  //     的 pendingTask，对上次没跑完的任务做一次"接回"。
  //   · 周期性重扫：即便用户一直开着同一个标签页不刷新，provider 的首轮 poll
  //     （5 分钟）超时后也会返回 pending；若没有这个定时器就只能等下次启动。
  //     3 分钟 > resume poll 窗口（2 分钟），保证每一轮 resume 有足够时间跑完。
  //
  // 两条路径（初始 runOneSlot 的 poll + 这里的 resume poll）若同时命中 SUCCESS，
  // `replacePlaceholderWithImage` 内的 `materializing` 集合会去重，不会产生
  // 重复节点。
  useEffect(() => {
    resumePendingImageTasks();
    const id = setInterval(resumePendingImageTasks, 3 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Global keyboard shortcuts.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (
        (e.ctrlKey || e.metaKey) && e.shiftKey &&
        e.key.toLowerCase() === 'e'
      ) {
        e.preventDefault();
        exportSelection();
      } else if (
        !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey &&
        e.key.toLowerCase() === 'e'
      ) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('canvas:start-marquee-export'));
      } else if (e.key === 'Escape') {
        setActiveTool('select');
        setSelection([]);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
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
    const centerX =
      (window.innerWidth / 2 - stageConfig.x) / stageConfig.scale;
    const centerY =
      (window.innerHeight / 2 - stageConfig.y) / stageConfig.scale;

    let defaultWidth = 100;
    let defaultHeight = 100;
    if (type === 'sticky') { defaultWidth = 200; defaultHeight = 200; }
    else if (type === 'text') { defaultWidth = 360; defaultHeight = 240; }
    else if (type === 'image') { defaultWidth = 480; defaultHeight = 360; }
    else if (type === 'video') { defaultWidth = 520; defaultHeight = 360; }
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
      text:
        type === 'sticky' ? '点击编辑便签内容…' :
        type === 'text' ? '' :
        undefined,
      fontSize: type === 'text' ? 14 : undefined,
      fontFamily: type === 'text' ? 'var(--font-serif)' : undefined,
      // Node default fills — tuned for the Warm Paper palette, still
      // overridable via PropertiesPanel. Sticky picks up the wax-yellow
      // token; image/video stay neutral (they render their src instead).
      fill:
        type === 'rectangle' ? '#E1D7CB' :
        type === 'circle' ? '#DDD1C2' :
        type === 'sticky' ? '#F3E3A0' :
        type === 'text' ? undefined :
        undefined,
      src: isMedia ? '' : undefined,
      cornerRadius: type === 'rectangle' ? 12 : undefined,
    });
    setSelection([id]);
    setActiveTool('select');
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden select-none"
      style={{ background: 'var(--bg-0)', color: 'var(--ink-0)' }}
    >
      {/* z=1 grain + z=2 vignette + shared SVG defs */}
      <Atmosphere />

      {/* Canvas surface — dot grid background + Konva */}
      <section
        className="absolute inset-0 overflow-hidden"
        style={{
          background: 'var(--bg-1)',
          // Dot grid drawn with token color; size tracks canvas zoom so
          // the grid feels anchored to the paper, not the viewport.
          backgroundImage:
            'radial-gradient(var(--grid-dot) 1px, transparent 1px)',
          backgroundSize: `${20 * stageConfig.scale}px ${20 * stageConfig.scale}px`,
          backgroundPosition: `${stageConfig.x}px ${stageConfig.y}px`,
        }}
      >
        <InfiniteCanvas />
      </section>

      {/* Chrome (z=30) — floating paper chips */}
      <TopBar
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
      />
      <ToolDock onCreate={handleCreateNode} />
      <PropertiesPanel />
      <HistoryPanel />
      <AssetLibraryPanel />
      <AlignmentToolbar />
      <GenerationQueuePanel />
      <StatusBar />

      {/* Tool hint when not select — tiny serif chip at the top-center
          rim so the user knows they're "loaded" with a tool. */}
      {activeTool !== 'select' && (
        <div
          className="chip-paper chip-paper--flat anim-fade-in pointer-events-none"
          style={{
            position: 'absolute',
            top: 72,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '5px 11px',
            fontSize: 11.5,
            color: 'var(--ink-1)',
            zIndex: 25,
          }}
        >
          <span className="serif-it">工具：</span>
          <span className="mono ml-1" style={{ color: 'var(--ink-0)' }}>
            {activeTool}
          </span>
        </div>
      )}

      {/* Modals (z=60) */}
      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
      <TemplatesModal open={isTemplatesOpen} onClose={() => setIsTemplatesOpen(false)} />
    </div>
  );
}
