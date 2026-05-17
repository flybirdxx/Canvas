import { v4 as uuidv4 } from 'uuid';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useExecutionStore, isRunComplete } from '@/store/useExecutionStore';
import { getUpstreamTextContributions, composeEffectivePrompt } from '@/utils/flowResolver';
import { runGeneration } from './imageGeneration';
import type { GenRequest } from './imageGeneration';
import { runVideoGeneration } from './videoGeneration';
import type { VideoGenRequest } from './videoGeneration';
import type { Connection, AIGeneratingElement } from '@/types/canvas';
import type { ExecutionErrorKind } from '@/store/useExecutionStore';
import { dispatchToast } from '@/components/Toast';
import { appendLog } from './executionLogs';
import { getController, setController, getExecId, setExecId, getSignal, isAborted, phIdToNodeId } from './executionSession';

function handleGenerationSuccess(e: Event): void {
  if (!getController() || !getExecId()) return;
  const { placeholderId, execId } = (e as CustomEvent).detail as { placeholderId: string; execId?: string };
  if (execId && execId !== getExecId()) return;
  const nodeId = phIdToNodeId.get(placeholderId);
  if (!nodeId) return;
  useExecutionStore.getState().updateNodeStatus(nodeId, 'success');
  appendLog(execId ?? getExecId() ?? '', 'info', `${nodeId} 生成成功`, nodeId);
  phIdToNodeId.delete(placeholderId);
}

export function cancelExecution(execId: string): void {
  getController()?.abort();
  setController(null);
  setExecId(null);
  useExecutionStore.getState().cancelRun(execId);

  const canvasState = useCanvasStore.getState();
  const execState = useExecutionStore.getState().getRun(execId);
  if (!execState) return;

  const cancelledNodeIds = Object.values(execState.nodeStates)
    .filter(ns => ns.status === 'running' || ns.status === 'queued' || ns.status === 'pending')
    .map(ns => ns.nodeId);
  const idsToRemove = new Set<string>();

  for (const el of canvasState.elements) {
    if (el.type === 'aigenerating' && cancelledNodeIds.includes(el.id)) idsToRemove.add(el.id);
  }
  for (const [phId, nodeId] of phIdToNodeId) {
    if (cancelledNodeIds.includes(nodeId)) {
      idsToRemove.add(phId);
      phIdToNodeId.delete(phId);
    }
  }
  if (idsToRemove.size > 0) canvasState.deleteElements([...idsToRemove]);
}

export function topologicalSort(nodeIds: string[], connections: Connection[]): string[][] | null {
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

  const queue = [...inDegree.entries()].filter(([, deg]) => deg === 0).map(([id]) => id);
  const levels: string[][] = [];

  while (queue.length > 0) {
    const level = queue.splice(0);
    const nextQueue: string[] = [];
    for (const nodeId of level) {
      for (const neighbor of adj.get(nodeId) ?? []) {
        const next = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, next);
        if (next === 0) nextQueue.push(neighbor);
      }
    }
    levels.push(level);
    queue.push(...nextQueue);
  }

  return [...inDegree.values()].some(deg => deg > 0) ? null : levels;
}

export async function runExecution(selectedIds: string[]): Promise<string | null> {
  const { connections } = useCanvasStore.getState();
  if (selectedIds.length === 0) {
    dispatchToast('请先选中要执行的节点', 'info');
    return null;
  }

  setController(new AbortController());
  const execId = uuidv4();
  setExecId(execId);
  const onSuccess = (e: Event) => handleGenerationSuccess(e);
  window.addEventListener('generation:success', onSuccess);

  try {
    const levels = topologicalSort(selectedIds, connections);
    useExecutionStore.getState().initRun(execId, selectedIds);
    if (levels === null) {
      useExecutionStore.getState().rejectRun(execId, '检测到循环依赖', selectedIds);
      dispatchToast('检测到循环依赖，无法执行', 'danger');
      return null;
    }
    useExecutionStore.getState().commitExecutionOrder(execId, levels);

    for (const level of levels) {
      if (isAborted()) break;
      await Promise.all(level.map(nodeId => executeNode(nodeId, execId)));
    }

    const run = useExecutionStore.getState().getRun(execId);
    if (run && isRunComplete(run)) {
      useExecutionStore.getState().completeRun(execId);
      dispatchToast('执行完成', 'success');
    }
    return execId;
  } finally {
    window.removeEventListener('generation:success', onSuccess);
    setController(null);
    setExecId(null);
  }
}

export async function executeNode(nodeId: string, execId: string): Promise<void> {
  const store = useExecutionStore.getState();
  const canvasState = useCanvasStore.getState();
  const { elements, connections } = canvasState;
  const el = elements.find(e => e.id === nodeId);

  if (isAborted()) return;
  if (!el) {
    store.updateNodeStatus(nodeId, 'failed', '节点不存在', 'unknown');
    return;
  }

  if (el.planningDraft?.status === 'pendingReview') {
    store.updateNodeStatus(nodeId, 'running', undefined, undefined, execId);
    store.updateNodeStatus(nodeId, 'failed', '此节点来自规划，确认后才能执行', 'unknown', execId);
    return;
  }

  store.updateNodeStatus(nodeId, 'running');

  if (el.type === 'text' || el.type === 'sticky' || el.type === 'rectangle' || el.type === 'circle' || el.type === 'file' || el.type === 'omniscript' || el.type === 'planning') {
    store.updateNodeStatus(nodeId, 'success');
    return;
  }

  if ((el.type === 'image' || el.type === 'video' || el.type === 'audio') && el.src) {
    store.updateNodeStatus(nodeId, 'success');
    return;
  }

  const upstream = getUpstreamTextContributions(nodeId, elements, connections);
  const effectivePrompt = composeEffectivePrompt(el.prompt ?? '', upstream);

  if (el.type === 'video' || el.type === 'audio') {
    const request: VideoGenRequest = {
      model: el.generation?.model ?? '',
      prompt: effectivePrompt,
      size: `${el.width ?? 560}x${el.height ?? 560}`,
      w: el.width ?? 560,
      h: el.height ?? 560,
      durationSec: Number(el.generation?.duration ?? 5),
      seedImage: el.generation?.references?.[0],
      execId,
    };
    await runVideoGeneration(nodeId, request);
    const updatedEl = useCanvasStore.getState().elements.find(e => e.id === nodeId);
    store.updateNodeStatus(nodeId, updatedEl?.type === 'aigenerating' ? 'pending' : 'success');
    return;
  }

  const request: GenRequest = {
    model: el.generation?.model ?? '',
    prompt: effectivePrompt,
    size: `${el.width ?? 560}x${el.height ?? 560}`,
    aspect: el.generation?.aspect,
    n: 1,
    w: el.width,
    h: el.height,
    references: el.generation?.references,
    execId,
    signal: getSignal(),
    onSuccess: (placeholderId: string) => {
      store.updateNodeStatus(nodeId, 'success');
      phIdToNodeId.delete(placeholderId);
    },
  };

  try {
    phIdToNodeId.set(nodeId, nodeId);
    await runGeneration([nodeId], request);
    if (isAborted()) return;

    const currentStatus = store.getRun(execId)?.nodeStates[nodeId]?.status;
    if (currentStatus === 'success') return;

    const updated = useCanvasStore.getState().elements.find(e => e.id === nodeId);
    if (!updated) {
      store.updateNodeStatus(nodeId, 'failed', '节点已被删除', 'unknown');
      phIdToNodeId.delete(nodeId);
      return;
    }
    if (updated.type === 'aigenerating') {
      const ag = updated as AIGeneratingElement;
      if (ag.error) {
        store.updateNodeStatus(nodeId, 'failed', ag.error.message, 'unknown');
        phIdToNodeId.delete(nodeId);
        return;
      }
      if (ag.pendingTask) {
        store.updateNodeStatus(nodeId, 'pending');
        return;
      }
    }
    store.updateNodeStatus(nodeId, 'success');
    phIdToNodeId.delete(nodeId);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      store.updateNodeStatus(nodeId, 'idle');
      phIdToNodeId.delete(nodeId);
      return;
    }
    const msg = err instanceof Error ? err.message : '未知错误';
    store.updateNodeStatus(nodeId, 'failed', msg, classifyError(err));
    phIdToNodeId.delete(nodeId);
  }
}

export async function retryNode(execId: string, nodeId: string): Promise<void> {
  const store = useExecutionStore.getState();
  if (!store.getRun(execId)) return;
  setController(new AbortController());
  setExecId(execId);
  try {
    store.retryNode(execId, nodeId);
    await executeNode(nodeId, execId);
  } finally {
    setController(null);
    setExecId(null);
  }
}

export async function retryRun(execId: string): Promise<void> {
  const run = useExecutionStore.getState().getRun(execId);
  if (!run) return;
  const failedIds = Object.values(run.nodeStates).filter(ns => ns.status === 'failed').map(ns => ns.nodeId);
  for (const nodeId of failedIds) await retryNode(execId, nodeId);
}

export async function restartRun(execId: string): Promise<void> {
  const run = useExecutionStore.getState().getRun(execId);
  if (!run) return;
  useExecutionStore.getState().cancelRun(execId);
  for (const nodeId of Object.keys(run.nodeStates)) await retryNode(execId, nodeId);
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
