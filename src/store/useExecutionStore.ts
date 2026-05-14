// transient store — no persist
import { create } from 'zustand';

/** States that a node can be in during an execution run. */
export type ExecutionNodeStatus = 'idle' | 'queued' | 'running' | 'pending' | 'success' | 'failed';

/** Error kinds that can cause a node to enter the failed state. */
export type ExecutionErrorKind = 'api-limit' | 'network' | 'timeout' | 'unknown';

/** Per-node execution state for a single execution run. */
export interface ExecutionNodeState {
  nodeId: string;
  status: ExecutionNodeStatus;
  startedAt?: number;
  finishedAt?: number;
  /** Human-readable error message. */
  errorMessage?: string;
  /** Structured error kind for categorisation. */
  errorKind?: ExecutionErrorKind;
  /** Elapsed ms from startedAt to finishedAt. Computed on transition to terminal state. */
  durationMs?: number;
  /** Number of times this node has been retried. */
  retryCount?: number;
}

/** One execution run: keyed by a unique execId (a uuid per "Run" click). */
export interface ExecutionRun {
  execId: string;
  /** Execution order returned by topologicalSort: string[][] flattened to string[]. */
  executionOrder: string[];
  nodeStates: Record<string, ExecutionNodeState>;
  rejected?: { reason: string };
  startedAt: number;
  finishedAt?: number;
  completed: boolean;
}

/* -------------------------------------------------------------------- */
/*  State machine: legal transitions                                        */
/* -------------------------------------------------------------------- */

const LEGAL_TRANSITIONS: Record<ExecutionNodeStatus, ExecutionNodeStatus[]> = {
  idle:    ['queued', 'running'],
  queued:  ['running'],
  running: ['idle', 'success', 'failed', 'pending'],
  success: [],
  failed:  ['queued'], // Story 1.4
  pending: ['success', 'failed'],
};

function isLegalTransition(from: ExecutionNodeStatus, to: ExecutionNodeStatus): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Compute duration in ms.
 * Returns undefined if startedAt is not available.
 * Only call when transitioning to a terminal state (finishedAt is always defined).
 */
function computeDuration(startedAt: number | undefined, finishedAt: number): number | undefined {
  return startedAt !== undefined ? finishedAt - startedAt : undefined;
}

/* -------------------------------------------------------------------- */
/*  Store interface                                                        */
/* -------------------------------------------------------------------- */

interface ExecutionState {
  runs: ExecutionRun[];

  /**
   * Subscribe to store changes.
   * Exposed for RunPanel and other listeners.
   */
  subscribe: (listener: (state: ExecutionState) => void) => () => void;

  /**
   * Begin a new execution run.
   * All nodeIds initialise to 'idle'.
   * Called by executionEngine before topologicalSort results are available.
   */
  initRun: (execId: string, nodeIds: string[]) => void;

  /**
   * Apply the topological sort result: re-order the run's executionOrder
   * and transition all nodes to 'queued' in that order.
   * Must be called after topologicalSort succeeds.
   */
  commitExecutionOrder: (execId: string, levels: string[][]) => void;

  /**
   * Transition a node to the given status within a specific run.
   * Returns silently for illegal transitions after logging a warning.
   * Uses execId to disambiguate when the same nodeId appears in multiple runs.
   */
  updateNodeStatus: (
    nodeId: string,
    status: ExecutionNodeStatus,
    errorMessage?: string,
    errorKind?: ExecutionErrorKind,
    execId?: string,
  ) => void;

  /**
   * Mark the entire run as completed.
   * Guard: warns if not all nodes have reached a terminal state.
   */
  completeRun: (execId: string) => void;

  /**
   * Reject a run because a directed cycle was detected.
   * Fills executionOrder with the original nodeIds so UI renders correctly.
   */
  rejectRun: (execId: string, reason: string, nodeIds: string[]) => void;

  /**
   * Stop the active run, cancelling any pending nodes.
   * Bypasses the state machine — external cancellation is not subject to
   * the normal legal-transition rules. Nodes already in 'running' are also
   * cancelled (Story 1.4 will add a 'cancelling' intermediate state if needed).
   */
  cancelRun: (execId: string) => void;

  /**
   * Remove a specific run.
   */
  removeRun: (execId: string) => void;

  /**
   * Clear all runs.
   */
  clearRuns: () => void;

  /**
   * Retries a single failed node: failed → queued.
   * Increments the node's retryCount.
   * Returns silently if the node is not in 'failed' state.
   */
  retryNode: (execId: string, nodeId: string) => void;

  /**
   * Retries all failed nodes in a run: each failed → queued.
   * Increments each node's retryCount.
   */
  retryRun: (execId: string) => void;

  /**
   * Get a deep snapshot of the most recent run (immutable for callers).
   */
  getActiveRun: () => ExecutionRun | undefined;

  /**
   * Get a specific run by execId.
   */
  getRun: (execId: string) => ExecutionRun | undefined;
}

/* -------------------------------------------------------------------- */
/*  Singleton listener registry                                             */
/*  Persists for the lifetime of the module. Components must call the    */
/*  unsubscribe function returned by subscribe() on unmount.              */
/* -------------------------------------------------------------------- */

const _listeners = new Set<(state: ExecutionState) => void>();

function notify(state: ExecutionState) {
  _listeners.forEach(fn => fn(state));
}

/* -------------------------------------------------------------------- */
/*  Store implementation                                                  */
/* -------------------------------------------------------------------- */

export const useExecutionStore = create<ExecutionState>()((set, get) => ({
  runs: [],

  subscribe: (listener) => {
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  },

  initRun: (execId, nodeIds) => {
    const nodeStates: Record<string, ExecutionNodeState> = {};
    for (const id of nodeIds) {
      nodeStates[id] = { nodeId: id, status: 'idle' };
    }
    const run: ExecutionRun = {
      execId,
      executionOrder: [],
      nodeStates,
      startedAt: Date.now(),
      completed: false,
    };
    set(s => ({ runs: [...s.runs, run] }));
    notify(get());
  },

  commitExecutionOrder: (execId, levels) => {
    const flatOrder = levels.flat();
    set(s => {
      const idx = s.runs.findIndex(r => r.execId === execId);
      if (idx === -1) return s;

      const runs = [...s.runs];
      const run = { ...runs[idx] };

      run.executionOrder = flatOrder;

      // Transition every node from 'idle' → 'queued'.
      const nodeStates: Record<string, ExecutionNodeState> = {};
      for (const id of flatOrder) {
        const prev = run.nodeStates[id];
        nodeStates[id] = { ...prev, status: 'queued' };
      }
      // Carry over any nodes not in flatOrder (shouldn't happen, but safe).
      for (const [id, ns] of Object.entries(run.nodeStates)) {
        if (!nodeStates[id]) nodeStates[id] = ns;
      }
      run.nodeStates = nodeStates;

      runs[idx] = run;
      return { runs };
    });
    notify(get());
  },

  updateNodeStatus: (nodeId, status, errorMessage, errorKind, execId) => {
    set(s => {
      // Find the target run:
      // - If execId provided, match exactly.
      // - Otherwise fall back to last run that contains this nodeId (legacy callers).
      let targetIdx = -1;
      if (execId !== undefined) {
        targetIdx = s.runs.findIndex(r => r.execId === execId);
      } else {
        for (let i = s.runs.length - 1; i >= 0; i--) {
          if (s.runs[i].nodeStates[nodeId] !== undefined) {
            targetIdx = i;
            break;
          }
        }
      }
      if (targetIdx === -1) return s;

      const runs = [...s.runs];
      const run = { ...runs[targetIdx] };
      const prev = run.nodeStates[nodeId];

      // ── Illegal transition guard ─────────────────────────────────────
      if (!isLegalTransition(prev.status, status)) {
        console.warn(
          `[executionStore] illegal transition: node=${nodeId} ` +
          `from=${prev.status} to=${status}. Ignoring.`,
        );
        return s;
      }

      const now = Date.now();
      const isTerminal = status === 'success' || status === 'failed';

      // durationMs is only computed when transitioning to a terminal state.
      const durationMs = isTerminal
        ? computeDuration(prev.startedAt, now)
        : undefined;

      run.nodeStates = { ...run.nodeStates };
      run.nodeStates[nodeId] = {
        ...prev,
        status,
        startedAt: status === 'running' ? (prev.startedAt ?? now) : prev.startedAt,
        finishedAt: isTerminal ? now : prev.finishedAt,
        errorMessage: errorMessage ?? prev.errorMessage,
        errorKind: errorKind ?? prev.errorKind,
        durationMs: durationMs ?? prev.durationMs,
      };

      // Stamp the run's finishedAt when any node reaches a terminal state.
      if (isTerminal) {
        run.finishedAt = now;
      }

      runs[targetIdx] = run;
      return { runs };
    });
    notify(get());
  },

  completeRun: (execId) => {
    set(s => {
      const idx = s.runs.findIndex(r => r.execId === execId);
      if (idx === -1) return s;
      const run = s.runs[idx];
      if (!isRunComplete(run)) {
        console.warn(
          `[executionStore] completeRun(${execId}) called but ` +
          `not all nodes are terminal: ${JSON.stringify(getRunStats(run))}`,
        );
        return s;
      }
      const runs = [...s.runs];
      runs[idx] = { ...run, completed: true, finishedAt: Date.now() };
      return { runs };
    });
    notify(get());
  },

  rejectRun: (execId, reason, nodeIds) => {
    set(s => {
      const idx = s.runs.findIndex(r => r.execId === execId);
      if (idx === -1) return s;
      const runs = [...s.runs];
      const run = { ...runs[idx] };
      // Fill executionOrder with original nodeIds so UI renders correctly.
      run.executionOrder = [...nodeIds];
      runs[idx] = {
        ...run,
        rejected: { reason },
        completed: true,
        finishedAt: Date.now(),
      };
      return { runs };
    });
    notify(get());
  },

  cancelRun: (execId: string) => {
    // Cancellation bypasses the state machine: external abort signal,
    // not a normal status transition. Nodes return to 'idle' so they
    // can be re-run without stale state (startedAt/durationMs cleared).
    set(s => {
      const idx = s.runs.findIndex(r => r.execId === execId);
      if (idx === -1) return s;
      const runs = [...s.runs];
      const run = { ...runs[idx] };
      const nodeStates: Record<string, ExecutionNodeState> = {};
      for (const [id, ns] of Object.entries(run.nodeStates)) {
        if (ns.status === 'success' || ns.status === 'failed') {
          // Terminal states are not affected by cancellation.
          nodeStates[id] = ns;
        } else {
          // Non-terminal → reset to idle (clears startedAt/durationMs).
          nodeStates[id] = {
            ...ns,
            status: 'idle',
            startedAt: undefined,
            finishedAt: undefined,
            errorMessage: undefined,
            errorKind: undefined,
            durationMs: undefined,
          };
        }
      }
      run.nodeStates = nodeStates;
      runs[idx] = run;
      return { runs };
    });
    notify(get());
  },

  removeRun: (execId) => {
    set(s => ({ runs: s.runs.filter(r => r.execId !== execId) }));
    notify(get());
  },

  clearRuns: () => {
    set({ runs: [] });
    notify(get());
  },

  retryNode: (execId, nodeId) => {
    set(s => {
      const idx = s.runs.findIndex(r => r.execId === execId);
      if (idx === -1) return s;
      const run = s.runs[idx];
      const prev = run.nodeStates[nodeId];
      if (!prev || prev.status !== 'failed') return s;

      const runs = [...s.runs];
      runs[idx] = {
        ...run,
        nodeStates: {
          ...run.nodeStates,
          [nodeId]: {
            ...prev,
            status: 'queued',
            startedAt: undefined,
            finishedAt: undefined,
            errorMessage: undefined,
            errorKind: undefined,
            durationMs: undefined,
            retryCount: (prev.retryCount ?? 0) + 1,
          },
        },
      };
      return { runs };
    });
    notify(get());
  },

  retryRun: (execId) => {
    set(s => {
      const idx = s.runs.findIndex(r => r.execId === execId);
      if (idx === -1) return s;
      const run = s.runs[idx];
      const runs = [...s.runs];
      const nodeStates: Record<string, ExecutionNodeState> = {};
      for (const [id, ns] of Object.entries(run.nodeStates)) {
        if (ns.status === 'failed') {
          // Reset failed nodes back to queued for re-execution.
          nodeStates[id] = {
            ...ns,
            status: 'queued',
            startedAt: undefined,
            finishedAt: undefined,
            errorMessage: undefined,
            errorKind: undefined,
            durationMs: undefined,
            retryCount: (ns.retryCount ?? 0) + 1,
          };
        } else if (ns.status === 'success') {
          // Skip successful nodes.
          nodeStates[id] = ns;
        } else {
          // idle / queued / running: leave as-is.
          nodeStates[id] = ns;
        }
      }
      runs[idx] = {
        ...run,
        nodeStates,
        completed: false,
        finishedAt: undefined,
      };
      return { runs };
    });
    notify(get());
  },

  getActiveRun: () => {
    const runs = get().runs;
    if (runs.length === 0) return undefined;
    const last = runs[runs.length - 1];
    // Deep snapshot so callers cannot mutate store internals.
    return {
      ...last,
      nodeStates: { ...last.nodeStates },
    };
  },

  getRun: (execId) => {
    return get().runs.find(r => r.execId === execId);
  },
}));

/* -------------------------------------------------------------------- */
/*  Convenience helpers (not part of store state)                          */
/* -------------------------------------------------------------------- */

/**
 * Return the total elapsed ms since the run started.
 * Returns 0 if the run hasn't started yet.
 */
export function getRunElapsedMs(run: ExecutionRun): number {
  const end = run.finishedAt ?? Date.now();
  return end - run.startedAt;
}

/**
 * Return the count of nodes in each status for a given run.
 */
export function getRunStats(run: ExecutionRun) {
  const states = Object.values(run.nodeStates);
  return {
    total:   states.length,
    idle:    states.filter(s => s.status === 'idle').length,
    queued:  states.filter(s => s.status === 'queued').length,
    running: states.filter(s => s.status === 'running').length,
    success: states.filter(s => s.status === 'success').length,
    failed:  states.filter(s => s.status === 'failed').length,
    pending: states.filter(s => s.status === 'pending').length,
  };
}

/**
 * Return true when all nodes in the run have reached a terminal state.
 */
export function isRunComplete(run: ExecutionRun): boolean {
  return Object.values(run.nodeStates).every(
    s => s.status === 'success' || s.status === 'failed',
  );
}
