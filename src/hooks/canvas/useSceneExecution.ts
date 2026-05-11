/**
 * useSceneExecution — manages batch execution of scene nodes from StoryboardView.
 *
 * E7 Story 8: Batch execution hook
 *
 * Watches the execution store to track scene execution progress and
 * provides handleExecuteAll / handleExecuteSelected callbacks.
 */
import { useCallback, useState } from 'react';
import { runExecution } from '@/services/executionEngine';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useExecutionStore } from '@/store/useExecutionStore';
import { isRunComplete } from '@/store/useExecutionStore';

export interface SceneExecutionProgress {
  /** Total number of scenes in the batch */
  total: number;
  /** Number of scenes that have completed (success or failed) */
  done: number;
  /** Currently executing scene id, or null */
  current: string | null;
  /** Whether a batch execution is in progress */
  isRunning: boolean;
}

const POLL_INTERVAL_MS = 500;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Poll until the given execId's run is complete.
 * Calls `onTick` every POLL_INTERVAL_MS while waiting.
 */
async function pollUntilComplete(
  execId: string,
  onTick: () => void,
): Promise<void> {
  const store = useExecutionStore.getState();
  while (true) {
    const run = store.getRun(execId);
    if (!run || isRunComplete(run)) break;
    onTick();
    await sleep(POLL_INTERVAL_MS);
  }
  // One final tick so the final state is reflected
  onTick();
}

export function useSceneExecution(onAllComplete?: () => void) {
  const elements = useCanvasStore(s => s.elements);
  const setViewMode = useCanvasStore(s => s.setViewMode);

  const [progress, setProgress] = useState<SceneExecutionProgress>({
    total: 0,
    done: 0,
    current: null,
    isRunning: false,
  });

  /**
   * Execute a batch of scenes in sceneNum order, serially.
   * Each scene gets its own runExecution() call so RunPanel shows individual runs.
   * Resolves when all scenes complete (success, failed, or aborted).
   */
  const executeBatch = useCallback(async (sceneIds: string[]) => {
    if (sceneIds.length === 0) return;

    const scenes = elements
      .filter(e => e.type === 'scene' && sceneIds.includes(e.id))
      .sort((a, b) => (a as any).sceneNum - (b as any).sceneNum) as any[];

    if (scenes.length === 0) return;

    setProgress({ total: scenes.length, done: 0, current: null, isRunning: true });

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      setProgress(prev => ({ ...prev, current: scene.id }));

      // Run this scene (which triggers scene → image → generation)
      const execId = await runExecution([scene.id]);

      if (execId) {
        // B1: pollUntilComplete 内不提前推进 done；
        // 每个 scene 的 run 真正完成后再 done = i + 1（见下方 setProgress）
        await pollUntilComplete(execId, () => {
          // 心跳回调：仅用于保持轮询活跃，不做状态推进
        });
      }

      // Scene execution complete — advance done count
      setProgress(prev => ({ ...prev, done: i + 1, current: null }));
    }

    setProgress(prev => ({ ...prev, isRunning: false, current: null }));
    onAllComplete?.();
  }, [elements, onAllComplete]);

  const handleExecuteAll = useCallback(() => {
    const allSceneIds = elements
      .filter(e => e.type === 'scene')
      .map(e => e.id);
    executeBatch(allSceneIds);
  }, [elements, executeBatch]);

  const handleExecuteSelected = useCallback((sceneIds: string[]) => {
    executeBatch(sceneIds);
  }, [executeBatch]);

  const handleViewOnCanvas = useCallback(() => {
    setViewMode('canvas');
  }, [setViewMode]);

  return {
    progress,
    handleExecuteAll,
    handleExecuteSelected,
    handleViewOnCanvas,
  };
}
