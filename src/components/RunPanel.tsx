// RunPanel.tsx — Story 1.3 + 1.4: 实时运行面板 + 取消/重试
import { useEffect, useRef, useState } from 'react';
import {
  useExecutionStore,
  type ExecutionRun,
  type ExecutionNodeStatus,
  getRunElapsedMs,
  getRunStats,
  isRunComplete,
} from '@/store/useExecutionStore';
import { useCanvasStore } from '@/store/useCanvasStore';
import { dispatchToast } from './Toast';
import { appendLog, clearLogs, subscribeLogs, type LogEntry } from '@/services/executionLogs';
import { cancelExecution, retryNode, restartRun } from '@/services/executionEngine';

const STATUS_LABEL: Record<ExecutionNodeStatus, string> = {
  idle: '空闲', queued: '排队中', running: '执行中', pending: '等待中', success: '成功', failed: '失败',
};
const STATUS_COLOR: Record<ExecutionNodeStatus, string> = {
  idle: '#999', queued: '#E6A23C', running: '#409EFF', pending: '#909399', success: '#67C23A', failed: '#F56C6C',
};
const STATUS_ICON: Record<ExecutionNodeStatus, string> = {
  idle: '○', queued: '◷', running: '◉', pending: '◌', success: '✓', failed: '✗',
};

/* -------------------------------------------------------------------- */
/*  Helpers                                                                */
/* -------------------------------------------------------------------- */

function getNodeName(nodeId: string, elements: ReturnType<typeof useCanvasStore.getState>['elements']): string {
  const el = elements.find((e) => e.id === nodeId);
  if (!el) return nodeId;
  return el.type === 'text' ? (el as any).text?.slice(0, 20) ?? el.type
    : el.type === 'sticky' ? (el as any).text?.slice(0, 20) ?? el.type
    : el.type;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* -------------------------------------------------------------------- */
/*  Log row component                                                      */
/* -------------------------------------------------------------------- */

function LogRow({ entry }: { entry: LogEntry }) {
  const levelColor = entry.level === 'error' ? '#F56C6C' : entry.level === 'warn' ? '#E6A23C' : 'var(--ink-1)';
  return (
    <div style={{ display: 'flex', gap: 6, fontSize: 11, lineHeight: 1.5, color: levelColor }}>
      <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{formatTime(entry.timestamp)}</span>
      <span style={{ color: 'var(--ink-3)', flexShrink: 0, width: 32 }}>{entry.level.toUpperCase()}</span>
      {entry.nodeId && <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{entry.nodeId.slice(0, 6)}</span>}
      <span style={{ color: 'inherit', wordBreak: 'break-word' }}>{entry.message}</span>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  Node row component                                                    */
/* -------------------------------------------------------------------- */

interface NodeRowProps {
  ns: { status: ExecutionNodeStatus; durationMs?: number; errorMessage?: string; retryCount?: number };
  nodeName: string;
  execId: string;
  nodeId: string;
  onRetry: (execId: string, nodeId: string) => void;
}

function NodeRow({ ns, nodeName, execId, nodeId, onRetry }: NodeRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ fontSize: 13, color: STATUS_COLOR[ns.status], width: 16, textAlign: 'center', flexShrink: 0 }}>
        {STATUS_ICON[ns.status]}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-0)' }}>
        {nodeName}
      </span>
      <span style={{ color: STATUS_COLOR[ns.status], flexShrink: 0, fontSize: 11 }}>
        {STATUS_LABEL[ns.status]}
      </span>
      {ns.retryCount !== undefined && ns.retryCount > 0 && (
        <span style={{ color: 'var(--ink-3)', flexShrink: 0, fontSize: 10 }}>
          重试{ns.retryCount}次
        </span>
      )}
      {ns.durationMs !== undefined && (
        <span style={{ color: 'var(--ink-2)', flexShrink: 0, fontSize: 10 }}>
          {formatMs(ns.durationMs)}
        </span>
      )}
      {ns.status === 'failed' && ns.errorMessage && (
        <span
          title={ns.errorMessage}
          style={{ color: '#F56C6C', fontSize: 10, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}
        >
          {ns.errorMessage.slice(0, 15)}
        </span>
      )}
      {ns.status === 'failed' && (
        <button
          onClick={() => onRetry(execId, nodeId)}
          title="重试此节点"
          style={{
            background: 'none', border: '1px solid #F56C6C', borderRadius: 4,
            color: '#F56C6C', fontSize: 10, cursor: 'pointer',
            padding: '1px 6px', flexShrink: 0,
          }}
        >
          重试
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  Main RunPanel component                                               */
/* -------------------------------------------------------------------- */

export function RunPanel() {
  const elements = useCanvasStore((s) => s.elements);
  const subscribe = useExecutionStore((s) => s.subscribe);

  const [isOpen, setIsOpen] = useState(false);
  const [activeExecId, setActiveExecId] = useState<string | undefined>(undefined);
  const [runs, setRuns] = useState<ExecutionRun[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalElapsed, setTotalElapsed] = useState(0);

  const logEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Subscribe to execution store ────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribe((state) => {
      setRuns([...state.runs]);

      // Auto-expand when a new run starts (queued node appears).
      if (state.runs.length > 0 && !isOpen) {
        setIsOpen(true);
      }

      // Sync activeExecId to the latest run if current is gone.
      if (activeExecId && !state.runs.find((r) => r.execId === activeExecId)) {
        setActiveExecId(state.runs.length > 0 ? state.runs[state.runs.length - 1].execId : undefined);
      }
    });

    // Init from current state.
    const initial = useExecutionStore.getState().runs;
    setRuns([...initial]);
    if (initial.length > 0 && !activeExecId) {
      setActiveExecId(initial[initial.length - 1].execId);
      setIsOpen(true);
    }

    return unsub;
  }, [subscribe]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Subscribe to global log stream ────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeLogs((newLogs) => setLogs([...newLogs]));
    return unsub;
  }, []);

  // ── Active run ticking clock ───────────────────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const run = runs.find((r) => r.execId === activeExecId);
      if (run) setTotalElapsed(getRunElapsedMs(run));
    }, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeExecId, runs]);

  // ── Auto-scroll logs ─────────────────────────────────────────────────
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  const activeRun = runs.find((r) => r.execId === activeExecId);
  const activeLogs = logs.filter((l) => l.execId === activeExecId);
  const stats = activeRun ? getRunStats(activeRun) : null;
  const isDone = activeRun ? isRunComplete(activeRun) : false;

  // Story 1.4: is there a node in running or queued state?
  const hasRunningOrQueued = activeRun
    ? Object.values(activeRun.nodeStates).some(
        (ns) => ns.status === 'running' || ns.status === 'queued',
      )
    : false;

  // Story 1.4: retry a single failed node.
  const handleRetry = async (execId: string, nodeId: string) => {
    await retryNode(execId, nodeId);
  };

  // Story 1.4: cancel all running/queued nodes.
  // F4 fix: cancelExecution now takes execId, calls cancelRun internally,
  // and scopes aigenerating cleanup to the cancelled run only.
  const handleCancel = () => {
    if (!activeExecId) return;
    cancelExecution(activeExecId);
    appendLog(activeExecId, 'warn', '用户取消执行');
    dispatchToast('已取消', 'info');
  };

  // Story 1.4: restart entire run from scratch.
  const handleRestartAll = async () => {
    if (!activeExecId) return;
    await restartRun(activeExecId);
  };

  // ── Empty state ──────────────────────────────────────────────────────
  if (!isOpen) {
    // Collapsed: show a slim summary bar.
    const totalRuns = runs.length;
    if (totalRuns === 0) return null;
    const latest = runs[runs.length - 1];
    const latestStats = getRunStats(latest);
    return (
      <div
        style={{
          position: 'absolute', bottom: 80, right: 24, zIndex: 30,
          background: 'var(--bg-2)', border: '1px solid var(--line-1)',
          borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-ink-2)',
          padding: '8px 14px', fontFamily: 'var(--font-sans)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 12,
        }}
        onClick={() => setIsOpen(true)}
        role="button"
        title="打开运行面板"
      >
        <span style={{ color: 'var(--ink-1)' }}>运行</span>
        {latestStats.success > 0 && <span style={{ color: '#67C23A' }}>✓{latestStats.success}</span>}
        {latestStats.running > 0 && <span style={{ color: '#409EFF' }}>◉{latestStats.running}</span>}
        {latestStats.failed > 0 && <span style={{ color: '#F56C6C' }}>✗{latestStats.failed}</span>}
      </div>
    );
  }

  return (
    <div
      className="anim-fade-in"
      style={{
        position: 'absolute', bottom: 80, right: 24, zIndex: 30,
        width: 360, maxHeight: 520,
        background: 'var(--bg-2)', border: '1px solid var(--line-1)',
        borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-ink-2)',
        fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--line-1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-0)' }}>运行面板</span>
          <button
            onClick={() => setIsOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 16, padding: '0 2px', lineHeight: 1 }}
            title="收起面板"
          >
            ×
          </button>
        </div>

        {/* Summary row */}
        {stats && (
          <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--ink-2)', flexWrap: 'wrap' }}>
            <span>共 {stats.total} 个节点</span>
            {stats.success > 0 && <span style={{ color: '#67C23A' }}>✓ {stats.success}</span>}
            {stats.running > 0 && <span style={{ color: '#409EFF' }}>◉ {stats.running}</span>}
            {stats.queued > 0 && <span style={{ color: '#E6A23C' }}>◷ {stats.queued}</span>}
            {stats.failed > 0 && <span style={{ color: '#F56C6C' }}>✗ {stats.failed}</span>}
            <span style={{ marginLeft: 'auto' }}>{formatMs(totalElapsed)}</span>
          </div>
        )}

        {/* Rejected banner */}
        {activeRun?.rejected && (
          <div style={{
            fontSize: 11, color: '#F56C6C',
            background: 'color-mix(in oklch, #F56C6C 8%, transparent)',
            borderRadius: 6, padding: '5px 8px', marginTop: 6,
          }}>
            {activeRun.rejected.reason}
          </div>
        )}
      </div>

      {/* ── Run tabs (if multiple runs) ─────────────────────────────── */}
      {runs.length > 1 && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--line-1)', flexShrink: 0, overflowX: 'auto' }}>
          {runs.map((r, i) => {
            const s = getRunStats(r);
            const done = isRunComplete(r);
            const isActive = r.execId === activeExecId;
            return (
              <button
                key={r.execId}
                onClick={() => setActiveExecId(r.execId)}
                style={{
                  padding: '5px 12px', fontSize: 11, cursor: 'pointer',
                  background: isActive ? 'var(--bg-1)' : 'transparent',
                  border: 'none', borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  color: done ? (s.failed > 0 ? '#F56C6C' : '#67C23A') : 'var(--ink-1)',
                  whiteSpace: 'nowrap',
                }}
              >
                #{i + 1} {done ? (s.failed > 0 ? `✗${s.failed}` : `✓${s.success}`) : `◉${s.running}`}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Node list ───────────────────────────────────────────────── */}
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--line-1)', flexGrow: 0, maxHeight: 160, overflowY: 'auto' }}>
        {activeRun ? (
          activeRun.executionOrder.map((nodeId) => {
            const ns = activeRun.nodeStates[nodeId];
            return (
              <div key={nodeId} style={{ marginBottom: 4 }}>
                <NodeRow
                  ns={ns}
                  nodeName={getNodeName(nodeId, elements)}
                  execId={activeExecId!}
                  nodeId={nodeId}
                  onRetry={handleRetry}
                />
              </div>
            );
          })
        ) : (
          <div style={{ fontSize: 12, color: 'var(--ink-2)', textAlign: 'center', padding: '8px 0' }}>
            暂无运行任务
          </div>
        )}
      </div>

      {/* ── Log area ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '5px 14px', borderBottom: '1px solid var(--line-1)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>日志 ({activeLogs.length})</span>
          <button
            onClick={clearLogs}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 10, padding: '2px 4px' }}
            title="清空日志"
          >
            清空
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {activeLogs.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', marginTop: 8 }}>
              无日志
            </div>
          ) : (
            activeLogs.map((entry) => <LogRow key={entry.id} entry={entry} />)
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* ── Footer hint + action buttons ─────────────────────────── */}
      <div style={{
        padding: '5px 14px', borderTop: '1px solid var(--line-1)',
        fontSize: 10, color: 'var(--ink-3)', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ flex: 1 }}>
          {isDone ? '执行完成' : stats?.pending !== undefined ? `${stats.pending} 个节点待执行` : '选中节点后点击运行'}
        </span>
        {/* Story 1.4: cancel button — only when nodes are running/queued */}
        {!isDone && hasRunningOrQueued && (
          <button
            onClick={handleCancel}
            style={{
              background: 'none', border: '1px solid #F56C6C', borderRadius: 4,
              color: '#F56C6C', fontSize: 10, cursor: 'pointer',
              padding: '2px 8px', flexShrink: 0,
            }}
          >
            全部取消
          </button>
        )}
        {/* Story 1.4: restart all — shown when run is done, regardless of failures */}
        {isDone && (
          <button
            onClick={handleRestartAll}
            style={{
              background: 'none', border: '1px solid #409EFF', borderRadius: 4,
              color: '#409EFF', fontSize: 10, cursor: 'pointer',
              padding: '2px 8px', flexShrink: 0,
            }}
          >
            重新运行全部
          </button>
        )}
      </div>
    </div>
  );
}
