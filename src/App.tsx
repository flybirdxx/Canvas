import { useEffect, useState, lazy, Suspense } from 'react';
import { InfiniteCanvas } from './components/canvas/InfiniteCanvas';
import { PropertiesPanel } from './components/properties/PropertiesPanel';
import { SettingsModal } from './components/SettingsModal';
import { HistoryPanel } from './components/HistoryPanel';
import { AssetLibraryPanel } from './components/AssetLibraryPanel';
import { TemplatesModal } from './components/TemplatesModal';
import { AlignmentToolbar } from './components/AlignmentToolbar';
import { GenerationQueuePanel } from './components/GenerationQueuePanel';
import { GenerationHistoryPanel } from './components/GenerationHistoryPanel';
import { Atmosphere } from './components/Atmosphere';
import { StatusBar } from './components/StatusBar';
import { TopBar } from './components/chrome/TopBar';
import { ToolDock } from './components/chrome/ToolDock';
import { FloatingActions } from './components/FloatingActions';
import { useCanvasStore } from './store/useCanvasStore';
import { SceneDetailOverlay } from './components/canvas/SceneDetailOverlay';
import type { SceneElement } from './types/canvas';
import { runExecution } from './services/executionEngine';
import { RunPanel } from './components/RunPanel';
import { ToastContainer } from './components/Toast';
import { resumePendingImageTasks } from './services/taskResume';
import { buildFileElement } from './services/fileIngest';
import { storeBlob, blobKey } from './services/fileStorage';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';

// AD2: StoryboardView 懒加载 — Konva 不在分镜模式下初始化
const StoryboardView = lazy(() => import('./components/StoryboardView').then(m => ({ default: m.StoryboardView })));

/** 兜底 SSR / Suspense 友好 wrapper */
function AppStoryboardViewLazy({ onCreateScript }: { onCreateScript: () => void }) {
  return (
    <Suspense fallback={
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-2)', fontFamily:'var(--font-serif)' }}>
        加载分镜视图中…
      </div>
    }>
      <StoryboardView onCreateScript={onCreateScript} />
    </Suspense>
  );
}

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
  const elements = useCanvasStore(s => s.elements);
  const selectedIds = useCanvasStore(s => s.selectedIds);
  const activeTool = useCanvasStore(s => s.activeTool);
  const setActiveTool = useCanvasStore(s => s.setActiveTool);
  const stageConfig = useCanvasStore(s => s.stageConfig);
  const addElement = useCanvasStore(s => s.addElement);
  const setSelection = useCanvasStore(s => s.setSelection);
  const viewMode = useCanvasStore(s => s.viewMode);
  const setViewMode = useCanvasStore(s => s.setViewMode);

  const selectedSceneId =
    selectedIds.length === 1 &&
    elements.find(e => e.id === selectedIds[0])?.type === 'scene'
      ? selectedIds[0]
      : null;
  const selectedScene = selectedSceneId
    ? elements.find(e => e.id === selectedSceneId) as SceneElement | undefined
    : undefined;

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

  const { handleCreateNode } = useGlobalShortcuts();

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

  // Process IndexedDB blob migration queue (v6→v7 persist migration).
  useEffect(() => {
    const queue = window.__canvasBlobMigration;
    if (!queue || queue.length === 0) return;
    delete window.__canvasBlobMigration;

    const migrationTasks = queue.map(async ({ id, dataUrl }) => {
      try {
        const key = blobKey(id);
        await storeBlob(key, dataUrl);
        const el = useCanvasStore.getState().elements.find(e => e.id === id);
        if (el && el.type === 'file') {
          useCanvasStore.getState().updateElement(id, {
            persistence: 'blob',
            blobKey: key,
            src: '',
          } as Partial<typeof el>);
        }
        return { id, ok: true };
      } catch (err) {
        console.warn(`[migration] blob store failed for ${id}, keeping data`, err);
        return { id, ok: false, error: err };
      }
    });
    Promise.allSettled(migrationTasks).then((results) => {
      const failed = results.filter(r => r.status === 'fulfilled' && !(r as any).value?.ok);
      if (failed.length > 0) {
        console.warn(`[migration] ${failed.length}/${queue.length} blob migrations failed, kept as data URLs`);
      }
    });
  }, []);

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
          opacity: viewMode === 'canvas' ? 1 : 0,
          pointerEvents: viewMode === 'canvas' ? 'auto' : 'none',
          transition: 'opacity 250ms ease-out',
          willChange: 'opacity',
        }}
      >
        <InfiniteCanvas />
      </section>

      {/* StoryboardView — pure DOM 分镜网格（AD2，与 InfiniteCanvas 同级） */}
      <div
        className="absolute inset-0"
        style={{
          opacity: viewMode === 'storyboard' ? 1 : 0,
          pointerEvents: viewMode === 'storyboard' ? 'auto' : 'none',
          transition: 'opacity 250ms ease-out',
          zIndex: 5,
          willChange: 'opacity',
        }}
      >
        {viewMode === 'storyboard' && (
          // Lazy-load — import lazily so Konva doesn't initialise in storyboard mode
          <AppStoryboardViewLazy onCreateScript={() => handleCreateNode('script')} />
        )}
      </div>

      {/* Chrome (z=30) — floating paper chips */}
      <TopBar
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        onCreateScript={() => handleCreateNode('script')}
        onRun={() => {
          const { selectedIds } = useCanvasStore.getState();
          if (selectedIds.length === 0) return;
          runExecution(selectedIds);
        }}
        onToggleView={() => setViewMode(viewMode === 'canvas' ? 'storyboard' : 'canvas')}
        viewMode={viewMode}
      />
      <ToolDock onCreate={handleCreateNode} onUploadFiles={handleUploadFiles} activeTool={activeTool} onSetActiveTool={setActiveTool} />
      <FloatingActions onOpenTemplates={() => setIsTemplatesOpen(true)} onOpenChat={() => setIsTemplatesOpen(true)} />
      <PropertiesPanel />
      <HistoryPanel />
      <AssetLibraryPanel />
      <AlignmentToolbar />
      <GenerationQueuePanel />
      <GenerationHistoryPanel />
      <RunPanel />
      <ToastContainer />
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

      {/* SceneDetailOverlay — 画布模式下选中分镜节点时的编辑面板 */}
      {viewMode === 'canvas' && selectedScene && (
        <SceneDetailOverlay
          scene={selectedScene}
          onClose={() => setSelection([])}
        />
      )}

      {/* Modals (z=60) */}
      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
      <TemplatesModal open={isTemplatesOpen} onClose={() => setIsTemplatesOpen(false)} />
    </div>
  );
}