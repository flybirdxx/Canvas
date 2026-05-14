import { useCanvasStore } from '@/store/useCanvasStore';
import { useExecutionStore, isRunComplete } from '@/store/useExecutionStore';
import type { AIGeneratingElement, PendingGenerationTask } from '@/types/canvas';
import { pollImageTaskByProviderId, pollVideoTaskByProviderId } from './gateway';
import { replacePlaceholderWithImage, setPlaceholderError } from './imageGeneration';
import { completeVideoPlaceholder, setPlaceholderVideoError, type VideoGenRequest } from './videoGeneration';

const inFlight = new Set<string>();

export function resumePendingImageTasks(): void {
  const pendings = useCanvasStore.getState().elements.filter(
    (el): el is AIGeneratingElement =>
      el.type === 'aigenerating' &&
      !!el.pendingTask &&
      !el.error,
  );

  for (const el of pendings) {
    const pending = el.pendingTask!;
    if (isVideoPending(pending)) {
      void resumeSingleVideo(el.id, pending);
    } else {
      void resumeSingleImage(el.id, pending);
    }
  }
}

function isVideoPending(pending: PendingGenerationTask): boolean {
  return typeof pending.request.durationSec === 'number';
}

function toVideoRequest(pending: PendingGenerationTask): VideoGenRequest {
  return {
    model: pending.request.model,
    prompt: pending.request.prompt,
    size: pending.request.size,
    w: pending.request.w ?? 560,
    h: pending.request.h ?? 560,
    durationSec: pending.request.durationSec ?? 5,
    seedImage: pending.request.seedImage,
    execId: pending.request.execId,
  };
}

function resolveRunNodeId(execId: string, placeholderId: string): string | undefined {
  const run = useExecutionStore.getState().getRun(execId);
  if (!run) return undefined;
  return run.nodeStates[placeholderId] ? placeholderId : undefined;
}

function updateRunAfterResolve(
  execId: string | undefined,
  placeholderId: string,
  status: 'success' | 'failed',
  errorMessage?: string,
): void {
  if (!execId) return;
  const nodeId = resolveRunNodeId(execId, placeholderId);
  if (!nodeId) return;

  const execStore = useExecutionStore.getState();
  execStore.updateNodeStatus(nodeId, status, errorMessage, undefined, execId);
  const run = execStore.getRun(execId);
  if (run && isRunComplete(run)) execStore.completeRun(execId);
}

async function resumeSingleImage(placeholderId: string, pending: PendingGenerationTask): Promise<void> {
  if (inFlight.has(placeholderId)) return;
  inFlight.add(placeholderId);
  try {
    const result = await pollImageTaskByProviderId(pending.providerId, pending.taskId);
    const el = useCanvasStore.getState().elements.find(e => e.id === placeholderId);
    if (!el || el.type !== 'aigenerating') return;

    if (result.ok === true) {
      const url = result.urls[0];
      if (url) {
        replacePlaceholderWithImage(placeholderId, url, pending.request.prompt, pending.request.model, pending.request.execId);
        updateRunAfterResolve(pending.request.execId, placeholderId, 'success');
      } else {
        updateRunAfterResolve(pending.request.execId, placeholderId, 'failed', '任务已完成但未返回图像');
        setPlaceholderError(placeholderId, { kind: 'empty', message: '任务已完成但未返回图像', request: pending.request });
      }
      return;
    }

    if (result.ok === 'pending') return;
    if (result.kind === 'missingKey' || result.kind === 'network') return;

    updateRunAfterResolve(pending.request.execId, placeholderId, 'failed', result.message);
    setPlaceholderError(placeholderId, {
      kind: result.kind,
      message: result.message,
      detail: result.detail,
      request: pending.request,
    });
  } finally {
    inFlight.delete(placeholderId);
  }
}

async function resumeSingleVideo(placeholderId: string, pending: PendingGenerationTask): Promise<void> {
  if (inFlight.has(placeholderId)) return;
  inFlight.add(placeholderId);
  try {
    const result = await pollVideoTaskByProviderId(pending.providerId, pending.taskId);
    const el = useCanvasStore.getState().elements.find(e => e.id === placeholderId);
    if (!el || el.type !== 'aigenerating') return;

    const request = toVideoRequest(pending);
    if (result.ok === true) {
      const url = result.urls[0];
      if (url) {
        completeVideoPlaceholder(placeholderId, url, request);
        updateRunAfterResolve(pending.request.execId, placeholderId, 'success');
      } else {
        updateRunAfterResolve(pending.request.execId, placeholderId, 'failed', '任务已完成但未返回视频');
        setPlaceholderVideoError(placeholderId, { kind: 'empty', message: '任务已完成但未返回视频', request });
      }
      return;
    }

    if (result.ok === 'pending') return;
    if (result.kind === 'missingKey' || result.kind === 'network') return;

    updateRunAfterResolve(pending.request.execId, placeholderId, 'failed', result.message);
    setPlaceholderVideoError(placeholderId, {
      kind: result.kind,
      message: result.message,
      detail: result.detail,
      request,
    });
  } finally {
    inFlight.delete(placeholderId);
  }
}
