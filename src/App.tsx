import { useEffect, useState } from 'react';
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
import { runExecution } from './services/executionEngine';
import { RunPanel } from './components/RunPanel';
import { ToastContainer } from './components/Toast';
import { resumePendingImageTasks } from './services/taskResume';
import { buildFileElement } from './services/fileIngest';
import { storeBlob, blobKey } from './services/fileStorage';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';

export default function App() {
  const activeTool = useCanvasStore(s => s.activeTool);
  const setActiveTool = useCanvasStore(s => s.setActiveTool);
  const stageConfig = useCanvasStore(s => s.stageConfig);
  const addElement = useCanvasStore(s => s.addElement);
  const setSelection = useCanvasStore(s => s.setSelection);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

  const { handleCreateNode } = useGlobalShortcuts();

  useEffect(() => {
    const open = () => setIsSettingsOpen(true);
    window.addEventListener('open-settings', open);
    return () => window.removeEventListener('open-settings', open);
  }, []);

  useEffect(() => {
    resumePendingImageTasks();
    const id = setInterval(resumePendingImageTasks, 3 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

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

  const handleUploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const centerX = (window.innerWidth / 2 - stageConfig.x) / stageConfig.scale;
    const centerY = (window.innerHeight / 2 - stageConfig.y) / stageConfig.scale;

    const settled = await Promise.allSettled(
      files.map((file, idx) =>
        buildFileElement(file, { x: centerX, y: centerY }, { dx: idx * 24, dy: idx * 24 }),
      ),
    );

    const createdIds: string[] = [];
    settled.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        addElement(result.value);
        createdIds.push(result.value.id);
      } else {
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
      <Atmosphere />

      <section
        className="absolute inset-0 overflow-hidden"
        style={{
          background: 'var(--bg-1)',
          backgroundImage: 'radial-gradient(var(--grid-dot) 1px, transparent 1px)',
          backgroundSize: `${20 * stageConfig.scale}px ${20 * stageConfig.scale}px`,
          backgroundPosition: `${stageConfig.x}px ${stageConfig.y}px`,
        }}
      >
        <InfiniteCanvas />
      </section>

      <TopBar
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        onRun={() => {
          const { selectedIds } = useCanvasStore.getState();
          if (selectedIds.length > 0) runExecution(selectedIds);
        }}
      />

      <ToolDock onCreate={handleCreateNode} onUploadFiles={handleUploadFiles} activeTool={activeTool} onSetActiveTool={setActiveTool} />
      <FloatingActions onOpenTemplates={() => setIsTemplatesOpen(true)} onOpenChat={() => setIsTemplatesOpen(true)} />
      <PropertiesPanel />
      <HistoryPanel />
      <AlignmentToolbar />
      <AssetLibraryPanel />
      <GenerationQueuePanel />
      <GenerationHistoryPanel />
      <RunPanel />
      <ToastContainer />
      <StatusBar />

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

      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
      <TemplatesModal open={isTemplatesOpen} onClose={() => setIsTemplatesOpen(false)} />
    </div>
  );
}
