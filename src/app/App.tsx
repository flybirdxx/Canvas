import { useEffect, useState } from 'react';
import { InfiniteCanvas } from '@/components/canvas/InfiniteCanvas';
import { AlignmentToolbar } from '@/components/canvas/AlignmentToolbar';
import { Atmosphere } from '@/components/chrome/Atmosphere';
import { FloatingActions } from '@/components/chrome/FloatingActions';
import { StatusBar } from '@/components/chrome/StatusBar';
import { TopBar } from '@/components/chrome/TopBar';
import { ToolDock } from '@/components/chrome/ToolDock';
import { AssetLibraryPanel } from '@/components/panels/AssetLibraryPanel';
import { GenerationHistoryPanel } from '@/components/panels/GenerationHistoryPanel';
import { GenerationQueuePanel } from '@/components/panels/GenerationQueuePanel';
import { HistoryPanel } from '@/components/panels/HistoryPanel';
import { RunPanel } from '@/components/panels/RunPanel';
import { SettingsModal } from '@/components/panels/SettingsModal';
import { TemplatesModal } from '@/components/panels/TemplatesModal';
import { ToastContainer } from '@/components/ui/Toast';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { runExecution } from '@/services/executionEngine';
import { buildFileElement } from '@/services/fileIngest';
import { useCanvasStore } from '@/store/useCanvasStore';
import { runBlobMigration } from './bootstrap/migrateBlobs';
import { startTaskResumeLoop } from './bootstrap/resumeTasks';

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

  useEffect(() => startTaskResumeLoop(), []);

  useEffect(() => {
    runBlobMigration();
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
