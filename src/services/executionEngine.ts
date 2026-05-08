// executionEngine.ts — 拓扑排序执行引擎
// Story 1.4: AbortController, cancelRun, retryNode, retryRun
// Story 1.5: generation:success CustomEvent, execId in GenRequest
import { v4 as uuidv4 } from 'uuid';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useExecutionStore } from '@/store/useExecutionStore';
import {
  getUpstreamTextContributions,
  composeEffectivePrompt,
} from '@/utils/flowResolver';
import { runGeneration } from './imageGeneration';
import { runVideoGeneration } from './videoGeneration';
import type { VideoGenRequest } from './videoGeneration';
import type { GenRequest } from './imageGeneration';
import type { Connection } from '@/types/canvas';
import type { ExecutionErrorKind } from '@/store/useExecutionStore';
import { dispatchToast } from '@/components/Toast';
import { appendLog } from './executionLogs';
import { isRunComplete } from '@/store/useExecutionStore';
import { getController, setController, getExecId, setExecId, getSignal, isAborted, abortSession, phIdToNodeId } from './executionSession';

/* -------------------------------------------------------------------- */
/*  Module-level state (per run)                                              */
/* -------------------------------------------------------------------- */

/** AbortController for the currently active run. Aborted on cancel. */
// activeController imported from ./executionSession

/** The execId of the currently active run. Used to correlate events. */
// activeExecId imported from ./executionSession

/** F12 fix: placeholderId → nodeId map for resolving generation:success events.
 *  Populated in executeNode before runGeneration, cleared after resolution.
 *  Enables correct node status update even when taskResume resumes an old session. */
// phIdToNodeId imported from ./executionSession

/** Handler for the generation:success CustomEvent dispatched by imageGeneration.
 * F4 fix: also guard against aborted controller — if the user cancelled the run
 * before the generation resolved, do not update the node status. */
function _handleGenerationSuccess(e: Event): void {
  // F4: skip if the run was cancelled (controller is null after cancelExecution).
  if (!getController() || !getExecId()) return;

  const { placeholderId, execId } = (e as CustomEvent).detail as { placeholderId: string; execId?: string };
  // Only handle if this event belongs to the active run.
  if (execId && execId !== getExecId()) return;
  const store = useExecutionStore.getState();

  // F12 fix: use the placeholderId→nodeId map to resolve the correct node.
  const nodeId = phIdToNodeId.get(placeholderId);

  if (nodeId) {
    store.updateNodeStatus(nodeId, 'success');
    appendLog(execId ?? getExecId() ?? '', 'info', `${nodeId} 生成成功`, nodeId);
    phIdToNodeId.delete(placeholderId);
    return;
  }

  // Fallback for taskResume (no execId): try to find a running node.
  if (!execId && getExecId()) {
    const run = store.getRun(getExecId());
    if (run) {
      const runningNode = Object.values(run.nodeStates).find((ns) => ns.status === 'running');
      if (runningNode) {
        store.updateNodeStatus(runningNode.nodeId, 'success');
        appendLog(getExecId(), 'info', `${runningNode.nodeId} 生成成功`, runningNode.nodeId);
      }
    }
  }
}

/**
 * Abort the currently active execution run.
 * Called by cancelRun from RunPanel.
 * Story 1.5 AC5: removes the aigenerating placeholder (if any) for each
 * cancelled node so no orphan spinners remain on the canvas.
 * F4 fix: also calls cancelRun to synchronize store state.
 */
export function cancelExecution(execId: string): void {
  getController()?.abort();
  // F2 fix: nullify the reference so subsequent retry operations get a fresh
  // controller instead of a stale aborted one.
  setController(null);
  setExecId(null);

  // F4: synchronize execution store — reset non-terminal node states to idle.
  // This must be called BEFORE deleteElements so the store reflects the
  // cancelled state when the UI re-renders.
  useExecutionStore.getState().cancelRun(execId);

  // Story 1.5 AC5: clean up aigenerating placeholders from the cancelled
  // run only, scoped by execId.
  const canvasState = useCanvasStore.getState();
  const execState = useExecutionStore.getState().getRun(execId);
  if (execState) {
    const cancelledNodeIds = Object.values(execState.nodeStates)
      .filter((ns) => ns.status === 'running' || ns.status === 'queued')
      .map((ns) => ns.nodeId);
    const aigIds = canvasState.elements
      .filter((e) => e.type === 'aigenerating' && cancelledNodeIds.includes(e.id))
      .map((e) => e.id);
    if (aigIds.length > 0) {
      canvasState.deleteElements(aigIds);
    }
  }
}

/* -------------------------------------------------------------------- */
/*  Pure utility: Kahn's topological sort with cycle detection            */
/* -------------------------------------------------------------------- */

/**
 * Topologically sort `nodeIds` using Kahn's algorithm over `connections`.
 * Returns `null` if a directed cycle is detected.
 *
 * Nodes at the same topological depth are returned in the same array,
 * enabling callers to `Promise.all` them for parallel execution.
 */
export function topologicalSort(
  nodeIds: string[],
  connections: Connection[],
): string[][] | null {
  const nodeSet = new Set(nodeIds);
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }

  for (const c of connections) {
    if (nodeSet.has(c.fromId) && nodeSet.has(c.toId)) {
      inDegree.set(c.toId, (inDegree.get(c.toId) ?? 0) + 1);
      adj.get(c.fromId)!.push(c.toId);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const levels: string[][] = [];

  while (queue.length > 0) {
    const level: string[] = [];
    const nextQueue: string[] = [];

    for (const nodeId of queue) {
      level.push(nodeId);
      for (const neighbor of adj.get(nodeId) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) nextQueue.push(neighbor);
      }
    }

    if (level.length > 0) levels.push(level);

    queue.length = 0;
    queue.push(...nextQueue);
  }

  // Any remaining non-zero in-degree → cycle.
  for (const [, deg] of inDegree) {
    if (deg > 0) return null;
  }

  return levels;
}

/* -------------------------------------------------------------------- */
/*  Public API: run a selected subgraph                            */
/* -------------------------------------------------------------------- */

/**
 * Entry point: user selects nodes and clicks "Run".
 *
 * 1. Kahn topo-sort
 * 2. Cycle → rejectRun with toast
 * 3. Else → initRun → commitExecutionOrder → execute level by level
 */
export async function runExecution(selectedIds: string[]): Promise<void> {
  const { elements, connections } = useCanvasStore.getState();
  if (selectedIds.length === 0) {
    dispatchToast('请先选中要执行的节点', 'info');
    return;
  }

  // Create a fresh AbortController for this run.
  setController(new AbortController());

  const execId = uuidv4();
  setExecId(execId);

  // F5 fix: register generation:success listener. Use try/finally to guarantee
  // removal on all exit paths (normal completion, cancel, exception, cycle rejection).
  const onSuccess = (e: Event) => _handleGenerationSuccess(e);
  window.addEventListener('generation:success', onSuccess);

  try {
    // Step 1: topo sort
    const levels = topologicalSort(selectedIds, connections);

    if (levels === null) {
      useExecutionStore.getState().initRun(execId, selectedIds);
      useExecutionStore.getState().rejectRun(execId, '检测到循环依赖', selectedIds);
      dispatchToast('检测到循环依赖，无法执行', 'danger');
      appendLog(execId, 'error', '检测到循环依赖，执行被拒绝');
      return;
    }

    appendLog(execId, 'info', `开始执行 ${selectedIds.length} 个节点，共 ${levels.length} 个拓扑层级`);

    // Step 2: init run with idle states, then commit order.
    useExecutionStore.getState().initRun(execId, selectedIds);
  useExecutionStore.getState().commitExecutionOrder(execId, levels);

  // Step 3: execute level by level.
  for (let i = 0; i < levels.length; i++) {
    // Bail out if cancelled.
    if (isAborted()) break;

    const level = levels[i];
    const depthLabel = `层级 ${i + 1}/${levels.length} (${level.length} 节点)`;
    appendLog(execId, 'info', `开始 ${depthLabel}`);

    const pending = level.map((nodeId) =>
      executeNode(nodeId, execId, elements, connections),
    );
    await Promise.all(pending);
  }
  // Step 4: mark run complete and log summary.
  useExecutionStore.getState().completeRun(execId);
  const stats = useExecutionStore.getState().getActiveRun();
  if (stats) {
    const s = Object.values(stats.nodeStates);
    const success = s.filter((n) => n.status === 'success').length;
    const failed = s.filter((n) => n.status === 'failed').length;
    appendLog(execId, 'info', `执行完成：${success} 成功，${failed} 失败`);
    if (failed > 0) {
      dispatchToast(`${failed} 个节点失败`, 'danger');
    } else {
      dispatchToast('执行完成', 'success');
    }
  }
  } finally {
    // F5 fix: always clean up listener and module state regardless of exit path.
    window.removeEventListener('generation:success', onSuccess);
    setController(null);
    setExecId(null);
  }
}

/* -------------------------------------------------------------------- */
/*  Per-node executor                                            */
/* -------------------------------------------------------------------- */

/**
 * Execute a single node within a run.
 * Exported so retryNode can call it directly.
 */
export async function executeNode(
  nodeId: string,
  execId: string,
  elements: ReturnType<typeof useCanvasStore.getState>['elements'],
  connections: ReturnType<typeof useCanvasStore.getState>['connections'],
): Promise<void> {
  const store = useExecutionStore.getState();

  // Check abort signal before starting.
  if (isAborted()) return;

  store.updateNodeStatus(nodeId, 'running');
  appendLog(execId, 'info', `${nodeId} 开始执行`, nodeId);

  // Check abort again after status update.
  if (isAborted()) return;

  const el = elements.find((e) => e.id === nodeId);
  if (!el) {
    store.updateNodeStatus(nodeId, 'failed', '节点不存在', 'unknown');
    appendLog(execId, 'error', `${nodeId} 节点不存在`, nodeId);
    return;
  }

  // Non-generatable nodes: text, shape, sticky, file — skip.
  if (el.type === 'text' || el.type === 'sticky' || el.type === 'rectangle' || el.type === 'circle' || el.type === 'file') {
    store.updateNodeStatus(nodeId, 'success');
    appendLog(execId, 'info', `${nodeId} (${el.type}) 跳过生成`, nodeId);
    return Promise.resolve();
  }

  // Already has content: skip.
  if ((el.type === 'image' || el.type === 'video' || el.type === 'audio') && (el as any).src) {
    store.updateNodeStatus(nodeId, 'success');
    appendLog(execId, 'info', `${nodeId} 已有内容，跳过`, nodeId);
    return;
  }

  // Compose effective prompt from upstream connections.
  const upstream = getUpstreamTextContributions(nodeId, elements, connections);
  const effectivePrompt = composeEffectivePrompt((el as any).prompt ?? '', upstream);

  if (upstream.length > 0) {
    appendLog(execId, 'info', `${nodeId} 合并了 ${upstream.length} 个上游贡献生成 prompt`, nodeId);
  }

  // Story 1.5 AC1: video/audio nodes use runVideoGeneration; image uses runGeneration.
  if (el.type === 'video' || el.type === 'audio') {
    const videoRequest: VideoGenRequest = {
      model: (el as any).generation?.model ?? '',
      prompt: effectivePrompt,
      size: `${el.width ?? 560}x${el.height ?? 560}`,
      w: el.width ?? 560,
      h: el.height ?? 560,
      durationSec: (el as any).generation?.durationSec ?? 5,
      seedImage: (el as any).references?.[0],
    };
    try {
      appendLog(execId, 'info', `${nodeId} 调用 AI 生成…`, nodeId);
      await runVideoGeneration(nodeId, videoRequest);
      if (isAborted()) return;
      const updatedEl = useCanvasStore.getState().elements.find((e) => e.id === nodeId);
      if (updatedEl?.type === 'aigenerating') {
        appendLog(execId, 'info', `${nodeId} 生成中（异步）`, nodeId);
        return;
      }
      store.updateNodeStatus(nodeId, 'success');
      appendLog(execId, 'info', `${nodeId} 生成成功`, nodeId);
    } catch (err) {
      // F9 fix: after AbortError, explicitly transition to idle so the state
      // machine reflects the cancelled state regardless of how cancelRun is invoked.
      if (err instanceof Error && err.name === 'AbortError') {
        appendLog(execId, 'info', `${nodeId} 已取消`, nodeId);
        store.updateNodeStatus(nodeId, 'idle');
        return;
      }
      const msg = err instanceof Error ? err.message : '未知错误';
      store.updateNodeStatus(nodeId, 'failed', msg, 'unknown');
      appendLog(execId, 'error', `${nodeId} 生成失败：${msg}`, nodeId);
    }
    return;
  }

  // image / aigenerating
  const request: GenRequest = {
    model: (el as any).generation?.model ?? '',
    prompt: effectivePrompt,
    size: `${el.width ?? 560}x${el.height ?? 560}`,
    aspect: (el as any).generation?.aspect,
    n: 1,
    w: el.width,
    h: el.height,
    references: (el as any).references,
    execId,
    // F3 fix: pass AbortSignal so provider can abort the fetch immediately.
    signal: getSignal(),
    // Story 1.5: onSuccess fires when replacePlaceholderWithImage replaces the placeholder.
    onSuccess: (_placeholderId: string) => {
      store.updateNodeStatus(nodeId, 'success');
      appendLog(execId, 'info', `${nodeId} 生成成功`, nodeId);
      phIdToNodeId.delete(nodeId);
    },
  };

  try {
    appendLog(execId, 'info', `${nodeId} 调用 AI 生成…`, nodeId);
    // F12 fix: register placeholderId→nodeId mapping so generation:success events
    // can resolve the correct node even from taskResume.
    phIdToNodeId.set(nodeId, nodeId);
    await runGeneration([nodeId], request);

    // Clean up mapping on return (success or still-pending).
    phIdToNodeId.delete(nodeId);

    // Check abort again before updating success.
    if (isAborted()) return;

    // Check if placeholder still exists (still pending).
    const updated = useCanvasStore.getState().elements.find((e) => e.id === nodeId);
    if (updated?.type === 'aigenerating') {
      // Still generating — leave status as running; generation callbacks handle resolution.
      appendLog(execId, 'info', `${nodeId} 生成中（异步）`, nodeId);
      // Do NOT delete mapping — keep it for when the callback fires later.
      return;
    }
    // onSuccess callback above already updated success; this line is a no-op guard.
    store.updateNodeStatus(nodeId, 'success');
    appendLog(execId, 'info', `${nodeId} 生成成功`, nodeId);
  } catch (err) {
    // F9 fix: after AbortError, explicitly transition to idle so the state
    // machine reflects the cancelled state regardless of how cancelRun is invoked.
    if (err instanceof Error && err.name === 'AbortError') {
      appendLog(execId, 'info', `${nodeId} 已取消`, nodeId);
      store.updateNodeStatus(nodeId, 'idle');
      phIdToNodeId.delete(nodeId);
      return;
    }
    // Also handle the t8star provider's aborted flag path (F3).
    if ((err as any)?.aborted === true) {
      appendLog(execId, 'info', `${nodeId} 已取消`, nodeId);
      store.updateNodeStatus(nodeId, 'idle');
      phIdToNodeId.delete(nodeId);
      return;
    }
    const msg = err instanceof Error ? err.message : '未知错误';
    const kind: ExecutionErrorKind = classifyError(err);
    store.updateNodeStatus(nodeId, 'failed', msg, kind);
    appendLog(execId, 'error', `${nodeId} 生成失败：${msg}`, nodeId);
  }
}

function classifyError(err: unknown): ExecutionErrorKind {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('429') || msg.includes('rate') || msg.includes('limit')) return 'api-limit';
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('econnreset')) return 'network';
    if (msg.includes('timeout')) return 'timeout';
  }
  return 'unknown';
}

/* -------------------------------------------------------------------- */
/*  Retry: single node and full run                                         */
/* -------------------------------------------------------------------- */

/**
 * Retry a single failed node. Re-executes just that node.
 * F5 fix: always create a fresh AbortController so the aborted signal from a
 * cancelled previous run doesn't block this retry.
 * F1 fix: register generation:success listener inside try/finally.
 */
export async function retryNode(execId: string, nodeId: string): Promise<void> {
  const { elements, connections } = useCanvasStore.getState();
  const store = useExecutionStore.getState();

  const run = store.getRun(execId);
  if (!run) return;

  setController(new AbortController());
  setExecId(execId);

  const onSuccess = (e: Event) => _handleGenerationSuccess(e);
  window.addEventListener('generation:success', onSuccess);

  try {
    appendLog(execId, 'info', `重试节点 ${nodeId}`, nodeId);

    // executeNode will transition failed → queued → running.
    await executeNode(nodeId, execId, elements, connections);

    // Check if run is complete after this node.
    const updated = store.getRun(execId);
    if (updated && isRunComplete(updated)) {
      store.completeRun(execId);
      const s = Object.values(updated.nodeStates);
      const success = s.filter((n) => n.status === 'success').length;
      const failed = s.filter((n) => n.status === 'failed').length;
      appendLog(execId, 'info', `重试完成：${success} 成功，${failed} 失败`);
      if (failed > 0) {
        dispatchToast(`${failed} 个节点失败`, 'danger');
      } else {
        dispatchToast('重试完成', 'success');
      }
    }
  } finally {
    window.removeEventListener('generation:success', onSuccess);
    setController(null);
    setExecId(null);
  }
}

/**
 * Retry all failed nodes in a run. Re-runs them in topological order.
 * F5 fix: always create a fresh AbortController.
 * F1 fix: register generation:success listener inside try/finally.
 */
export async function retryRun(execId: string): Promise<void> {
  const { elements, connections } = useCanvasStore.getState();
  const store = useExecutionStore.getState();

  const run = store.getRun(execId);
  if (!run) return;

  const failedIds = Object.values(run.nodeStates)
    .filter((ns) => ns.status === 'failed')
    .map((ns) => ns.nodeId);

  if (failedIds.length === 0) return;

  setController(new AbortController());
  setExecId(execId);

  const onSuccess = (e: Event) => _handleGenerationSuccess(e);
  window.addEventListener('generation:success', onSuccess);

  try {
    appendLog(execId, 'info', `重新运行 ${failedIds.length} 个失败节点`);

    // Topological sort over the failed subset.
    const levels = topologicalSort(failedIds, connections);
    if (!levels || levels.length === 0) return;

    for (let i = 0; i < levels.length; i++) {
      if (isAborted()) break;

      const level = levels[i];
      const pending = level.map((nodeId) =>
        executeNode(nodeId, execId, elements, connections),
      );
      await Promise.all(pending);
    }

    const updated = store.getRun(execId);
    if (updated) {
      store.completeRun(execId);
      const s = Object.values(updated.nodeStates);
      const success = s.filter((n) => n.status === 'success').length;
      const failed = s.filter((n) => n.status === 'failed').length;
      appendLog(execId, 'info', `重新运行完成：${success} 成功，${failed} 失败`);
      if (failed > 0) {
        dispatchToast(`${failed} 个节点失败`, 'danger');
      } else {
        dispatchToast('重新运行完成', 'success');
      }
    }
  } finally {
    window.removeEventListener('generation:success', onSuccess);
    setController(null);
    setExecId(null);
  }
}

/**
 * Restart the entire run from scratch.
 * Story 1.4 AC5: clears all non-terminal node states and re-executes
 * every node in topological order.
 * F1 fix: always create fresh AbortController and register generation:success
 * listener so async generations during restart resolve correctly.
 */
export async function restartRun(execId: string): Promise<void> {
  const { elements, connections } = useCanvasStore.getState();
  const store = useExecutionStore.getState();

  const run = store.getRun(execId);
  if (!run) return;

  // Always create a fresh controller — even if one exists, a cancelled controller
  // must not be reused since its signal is permanently aborted.
  setController(new AbortController());
  setExecId(execId);

  const onSuccess = (e: Event) => _handleGenerationSuccess(e);
  window.addEventListener('generation:success', onSuccess);

  try {
    // Reset all non-terminal node states to idle so they can be re-executed.
    store.cancelRun(execId);

    // Collect all node IDs for full re-execution.
    const nodeIds = Object.keys(run.nodeStates);
    if (nodeIds.length === 0) return;

    appendLog(execId, 'info', `重新运行全部 ${nodeIds.length} 个节点`);

    // Topological sort over the full node set.
    const levels = topologicalSort(nodeIds, connections);
    if (!levels || levels.length === 0) return;

    for (let i = 0; i < levels.length; i++) {
      if (isAborted()) break;

      const level = levels[i];
      const pending = level.map((nodeId) =>
        executeNode(nodeId, execId, elements, connections),
      );
      await Promise.all(pending);
    }

    const updated = store.getRun(execId);
    if (updated) {
      store.completeRun(execId);
      const s = Object.values(updated.nodeStates);
      const success = s.filter((n) => n.status === 'success').length;
      const failed = s.filter((n) => n.status === 'failed').length;
      appendLog(execId, 'info', `重新运行完成：${success} 成功，${failed} 失败`);
      if (failed > 0) {
        dispatchToast(`${failed} 个节点失败`, 'danger');
      } else {
        dispatchToast('重新运行完成', 'success');
      }
    }
  } finally {
    window.removeEventListener('generation:success', onSuccess);
    setController(null);
    setExecId(null);
  }
}
