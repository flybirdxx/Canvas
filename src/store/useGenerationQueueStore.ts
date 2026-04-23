import { create } from 'zustand';

export type QueueTaskStatus = 'running' | 'success' | 'failed' | 'cancelled';

export interface QueueTask {
  /** Unique task id (not related to any element id). */
  id: string;
  modality: 'image' | 'video';
  /** Wire-level model id that was invoked. */
  model: string;
  /** Prompt as sent (after upstream merge / preset snippets). */
  prompt: string;
  /** Placeholder elements this task is filling. One task may spawn multiple
   *  placeholders (e.g., image batch n>1). Retries use the single
   *  placeholderId that errored. */
  placeholderIds: string[];
  status: QueueTaskStatus;
  createdAt: number;
  finishedAt?: number;
  /** Error message surfaced when status === 'failed'. */
  error?: string;
  /** For retry: tasks spawned via retryGeneration reference the original. */
  retryOfId?: string;
}

interface GenerationQueueState {
  tasks: QueueTask[];
  /** Whether the queue panel is currently open (collapsed badge vs. list). */
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  /** Register a new task. Returns the task id for later completion. */
  enqueue: (task: Omit<QueueTask, 'status' | 'createdAt'> & { status?: QueueTaskStatus }) => string;
  completeTask: (id: string, status: 'success' | 'failed' | 'cancelled', error?: string) => void;
  /** Remove a single task from the queue immediately (no animation). */
  removeTask: (id: string) => void;
  /** Clear all tasks that aren't currently running. */
  clearFinished: () => void;
}

/**
 * F16: visibility-oriented generation queue. Does NOT enforce concurrency
 * — providers already handle their own rate limits and parallelism.
 * Every {@link runGeneration} / {@link runVideoGeneration} call registers
 * exactly one task; batch (n>1) is still ONE task because the underlying
 * API call is one request that either fully succeeds or uniformly fails.
 *
 * Successful tasks disappear automatically after a short grace period so
 * the panel stays quiet in the happy path, but failed tasks persist until
 * the user either retries them or clicks the clear button — consistent
 * with how placeholder errors already work inline on the canvas.
 */
export const useGenerationQueueStore = create<GenerationQueueState>()((set, get) => ({
  tasks: [],
  panelOpen: true,

  setPanelOpen: (open) => set({ panelOpen: open }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

  enqueue: (input) => {
    const id = input.id;
    const task: QueueTask = {
      id,
      modality: input.modality,
      model: input.model,
      prompt: input.prompt,
      placeholderIds: input.placeholderIds,
      status: input.status ?? 'running',
      createdAt: Date.now(),
      retryOfId: input.retryOfId,
    };
    set((s) => ({ tasks: [...s.tasks, task] }));
    return id;
  },

  completeTask: (id, status, error) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? { ...t, status, finishedAt: Date.now(), error: error ?? t.error }
          : t,
      ),
    }));
    // Auto-sweep success/cancel entries a few seconds later so the panel
    // stays clean during normal use. Failed tasks stay pinned.
    if (status === 'success' || status === 'cancelled') {
      const AUTO_DISMISS_MS = 4000;
      setTimeout(() => {
        const target = get().tasks.find((t) => t.id === id);
        // Don't remove if the task was re-status'd to failed by a later
        // observer (shouldn't happen, but defensive).
        if (target && (target.status === 'success' || target.status === 'cancelled')) {
          get().removeTask(id);
        }
      }, AUTO_DISMISS_MS);
    }
  },

  removeTask: (id) =>
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  clearFinished: () =>
    set((s) => ({ tasks: s.tasks.filter((t) => t.status === 'running') })),
}));
