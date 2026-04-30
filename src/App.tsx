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
import { FloatingActions } from './components/FloatingActions';
import { exportSelection } from './utils/exportPng';
import { useCanvasStore } from './store/useCanvasStore';
import { resumePendingImageTasks } from './services/taskResume';
import { buildFileElement } from './services/fileIngest';

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
  const elements = useCanvasStore(s => s.elements);

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
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelection(elements.map(el => el.id));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const sel = elements.filter(el => selectedIds.includes(el.id));
        sel.forEach(el => { const nid = uuidv4(); addElement({...el, id: nid, x: el.x + 24, y: el.y + 24} as any); });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) { e.preventDefault(); deleteElements(selectedIds); }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        const k = e.key.toLowerCase();
        if (k === 'v') { e.preventDefault(); setActiveTool('select'); }
        else if (k === 'h') { e.preventDefault(); setActiveTool('hand'); }
        else if (k === 't') { e.preventDefault(); handleCreateNode('text'); }
        else if (k === 'r') { e.preventDefault(); handleCreateNode('rectangle'); }
        else if (k === 'i') { e.preventDefault(); handleCreateNode('image'); }
        else if (k === 's') { e.preventDefault(); handleCreateNode('sticky'); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, deleteElements, selectedIds, elements, addElement, setActiveTool, setSelection]);

  const handleCreateNode = (type: string) => {
    const centerX =
      (window.innerWidth / 2 - stageConfig.x) / stageConfig.scale;
    const centerY =
      (window.innerHeight / 2 - stageConfig.y) / stageConfig.scale;

    // 默认几何遵循 **和 NodeInputBar 的默认 aspect 对齐** 的原则：
    //   · image → 1:1（NodeInputBar `aspect` 默认值也是 '1:1'），避免生图回填
    //     时占位符从 4:3 跳到 1:1 造成视觉跳变
    //   · video → 16:9（视频场景的默认 aspect）
    //   · text / sticky / audio 走人因舒适度：正文宽度 ~ 420ch 可读，便签维持
    //     200 见方足够写几行字而不过份占屏
    // 尺寸在 scale=1 下比旧版放大约 30%，让节点在 1920+ 屏幕上有足够存在感，
    // 同时让输入框的 min-width 退化为兜底值（只有手动缩小节点时才触发）。
    let defaultWidth = 100;
    let defaultHeight = 100;
    if (type === 'sticky') { defaultWidth = 220; defaultHeight = 220; }
    else if (type === 'text') { defaultWidth = 420; defaultHeight = 280; }
    else if (type === 'image') { defaultWidth = 560; defaultHeight = 560; }
    else if (type === 'video') { defaultWidth = 640; defaultHeight = 360; }
    else if (type === 'audio') { defaultWidth = 360; defaultHeight = 96; }

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

  /**
   * 来自 ToolDock "File / 文件" 通道的上传回调。FlowDock 已经帮我们取到
   * 了 File[] （已通过用户手势打开的对话框），这里负责：
   *   1) 把画布中心换算成元素左上角基准点（和 handleCreateNode 对齐）
   *   2) 异步把每个 File 读成 data URL，组装成 FileElement
   *   3) 多文件错开位置（24px 阶梯）防堆叠
   *   4) 读完后批量 addElement 并选中它们，让用户一眼看到成果
   *
   * 读失败的单个文件会被跳过（不中断整批），控制台打 warn 就行；后续
   * 若要更友好，可改成向某个 error bus 发事件。
   */
  const handleUploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const centerX =
      (window.innerWidth / 2 - stageConfig.x) / stageConfig.scale;
    const centerY =
      (window.innerHeight / 2 - stageConfig.y) / stageConfig.scale;

    const settled = await Promise.allSettled(
      files.map((file, idx) =>
        buildFileElement(
          file,
          { x: centerX, y: centerY },
          { dx: idx * 24, dy: idx * 24 },
        ),
      ),
    );

    const createdIds: string[] = [];
    settled.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        addElement(result.value);
        createdIds.push(result.value.id);
      } else {
        // 单个文件读取失败不阻塞其它文件落地
        console.warn('[upload] failed to read file', files[idx]?.name, result.reason);
      }
    });

    if (createdIds.length > 0) {
      setSelection(createdIds);
      setActiveTool('select');
    }
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
      <ToolDock onCreate={handleCreateNode} onUploadFiles={handleUploadFiles} activeTool={activeTool} onSetActiveTool={setActiveTool} />
      <FloatingActions onOpenTemplates={() => setIsTemplatesOpen(true)} onOpenChat={() => setIsTemplatesOpen(true)} />
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
