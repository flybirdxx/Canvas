import { Trash } from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';

/**
 * SaveControls — inside TopBar.
 *
 * Save state readout has moved to <StatusBar />. This component is now
 * just the "clear canvas" trashcan; keeping it mounted here preserves
 * TopBar's spatial memory (destructive action lives next to the
 * masthead actions, not in the status bar).
 */
export function SaveControls() {
  const clearCanvas = useCanvasStore(s => s.clearCanvas);
  const elementsCount = useCanvasStore(s => s.elements.length);

  const handleClear = () => {
    if (elementsCount === 0) return;
    if (confirm('确定要清空当前画布吗？（此操作可通过撤销恢复）')) {
      clearCanvas();
    }
  };

  return (
    <button
      onClick={handleClear}
      disabled={elementsCount === 0}
      className="btn btn-ghost btn-icon"
      style={{ width: 30, height: 30, padding: 0 }}
      title="清空画布"
      aria-label="清空画布"
    >
      <Trash className="w-4 h-4" strokeWidth={1.6} />
    </button>
  );
}
