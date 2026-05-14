import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SceneElement } from './types/canvas';
import { useCanvasStore } from './store/useCanvasStore';
import App from './App';

vi.mock('./components/canvas/InfiniteCanvas', () => ({ InfiniteCanvas: () => <div data-testid="canvas" /> }));
vi.mock('./components/properties/PropertiesPanel', () => ({ PropertiesPanel: () => null }));
vi.mock('./components/SettingsModal', () => ({ SettingsModal: () => null }));
vi.mock('./components/HistoryPanel', () => ({ HistoryPanel: () => null }));
vi.mock('./components/AssetLibraryPanel', () => ({ AssetLibraryPanel: () => null }));
vi.mock('./components/TemplatesModal', () => ({ TemplatesModal: () => null }));
vi.mock('./components/AlignmentToolbar', () => ({ AlignmentToolbar: () => null }));
vi.mock('./components/GenerationQueuePanel', () => ({ GenerationQueuePanel: () => null }));
vi.mock('./components/GenerationHistoryPanel', () => ({ GenerationHistoryPanel: () => null }));
vi.mock('./components/Atmosphere', () => ({ Atmosphere: () => null }));
vi.mock('./components/StatusBar', () => ({ StatusBar: () => null }));
vi.mock('./components/chrome/TopBar', () => ({ TopBar: () => null }));
vi.mock('./components/chrome/ToolDock', () => ({ ToolDock: () => null }));
vi.mock('./components/FloatingActions', () => ({ FloatingActions: () => null }));
vi.mock('./components/RunPanel', () => ({ RunPanel: () => null }));
vi.mock('./components/Toast', () => ({ ToastContainer: () => null }));
vi.mock('./components/canvas/SceneDetailOverlay', () => ({
  SceneDetailOverlay: ({ scene }: { scene: SceneElement }) => (
    <div data-testid="scene-detail-overlay">{scene.id}</div>
  ),
}));
vi.mock('./services/taskResume', () => ({ resumePendingImageTasks: vi.fn() }));
vi.mock('./services/executionEngine', () => ({ runExecution: vi.fn() }));
vi.mock('./services/fileIngest', () => ({ buildFileElement: vi.fn() }));
vi.mock('./services/fileStorage', () => ({ storeBlob: vi.fn(), blobKey: vi.fn((id: string) => id) }));
vi.mock('./hooks/useGlobalShortcuts', () => ({ useGlobalShortcuts: () => ({ handleCreateNode: vi.fn() }) }));
vi.mock('./hooks/canvas/useSceneExecution', () => ({
  useSceneExecution: () => ({
    progress: { done: 0, total: 0, current: null, isRunning: false },
    handleExecuteAll: vi.fn(),
    handleExecuteSelected: vi.fn(),
  }),
}));

const scene: SceneElement = {
  id: 'scene-1',
  type: 'scene',
  x: 400,
  y: 220,
  width: 320,
  height: 200,
  sceneNum: 1,
  title: 'Drag target',
  content: 'Scene content',
};

describe('scene detail overlay trigger', () => {
  beforeEach(() => {
    act(() => {
      useCanvasStore.setState({
        elements: [scene],
        connections: [],
        selectedIds: [],
        viewMode: 'canvas',
        stageConfig: { scale: 1, x: 0, y: 0 },
        groups: [],
      });
    });
  });

  it('does not open the scene editor when a scene is only selected', () => {
    act(() => {
      useCanvasStore.getState().setSelection(['scene-1']);
    });

    render(<App />);

    expect(screen.queryByTestId('scene-detail-overlay')).not.toBeInTheDocument();
  });

  it('opens the scene editor from the explicit scene edit event', () => {
    render(<App />);

    act(() => {
      window.dispatchEvent(new CustomEvent('scene:edit', { detail: { id: 'scene-1' } }));
    });

    expect(screen.getByTestId('scene-detail-overlay')).toHaveTextContent('scene-1');
  });
});
