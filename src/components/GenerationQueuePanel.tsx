import { useMemo } from 'react';
import {
  CheckCircle2, AlertTriangle, RefreshCw, X, Trash2,
  ListTodo, ChevronDown, ChevronUp, Image as ImageIcon, Video, MapPin,
} from 'lucide-react';
import { useGenerationQueueStore, QueueTask } from '@/store/useGenerationQueueStore';
import { useCanvasStore } from '@/store/useCanvasStore';
import { retryGeneration } from '@/services/imageGeneration';

/**
 * GenerationQueuePanel — top-right paper chip.
 *
 * Collapsed  : single chip with running / failed / done meta counts.
 * Expanded   : vertical task list with per-task locate / retry / dismiss.
 *
 * Tone decisions (Warm Paper):
 *   - Running pulse: ink-bloom dot (no spinner) — matches AI generating halo.
 *   - Status colors use token semantics (signal / danger / success) over
 *     soft tinted chips, keeping the panel quiet.
 *   - Failed rows get a danger-soft wash; success rows auto-dismiss on
 *     their own (via store timer), so we don't need a separate visual.
 */
export function GenerationQueuePanel() {
  const tasks = useGenerationQueueStore(s => s.tasks);
  const panelOpen = useGenerationQueueStore(s => s.panelOpen);
  const togglePanel = useGenerationQueueStore(s => s.togglePanel);
  const removeTask = useGenerationQueueStore(s => s.removeTask);
  const clearFinished = useGenerationQueueStore(s => s.clearFinished);

  const setSelection = useCanvasStore(s => s.setSelection);
  const elements = useCanvasStore(s => s.elements);

  const { running, failed, done } = useMemo(() => {
    let r = 0, f = 0, d = 0;
    for (const t of tasks) {
      if (t.status === 'running') r++;
      else if (t.status === 'failed') f++;
      else d++;
    }
    return { running: r, failed: f, done: d };
  }, [tasks]);

  if (tasks.length === 0) return null;
  const hasFailed = failed > 0;

  // Header chip tint based on state priority (failed > running > idle).
  const headerTint = hasFailed
    ? { bg: 'var(--danger-soft)', fg: 'var(--danger)', border: 'color-mix(in oklch, var(--danger) 18%, transparent)' }
    : running > 0
      ? { bg: 'var(--accent-soft)', fg: 'var(--accent)', border: 'color-mix(in oklch, var(--accent) 18%, transparent)' }
      : { bg: 'var(--bg-2)', fg: 'var(--ink-0)', border: 'var(--line-1)' };

  return (
    <div
      className="z-30 pointer-events-auto select-none anim-fade-in"
      style={{
        position: 'absolute',
        top: 72,
        right: 16,
        width: 300,
      }}
    >
      {/* Header chip / handle */}
      <button
        type="button"
        onClick={togglePanel}
        className="w-full flex items-center gap-2 transition-colors"
        style={{
          padding: '8px 12px',
          background: headerTint.bg,
          color: headerTint.fg,
          border: `1px solid ${headerTint.border}`,
          borderRadius: panelOpen
            ? 'var(--r-md) var(--r-md) 0 0'
            : 'var(--r-md)',
          borderBottomColor: panelOpen ? 'transparent' : headerTint.border,
          boxShadow: panelOpen ? 'var(--shadow-ink-1)' : 'var(--shadow-ink-2)',
          cursor: 'pointer',
        }}
      >
        {running > 0 ? (
          <span
            className="anim-ink-diffuse"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent)',
            }}
          />
        ) : hasFailed ? (
          <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.8} />
        ) : (
          <ListTodo className="w-3.5 h-3.5" strokeWidth={1.8} />
        )}

        <span
          className="serif flex-1 text-left"
          style={{ fontSize: 12.5, fontWeight: 500 }}
        >
          生成队列
        </span>

        <div className="flex items-center gap-1 mono" style={{ fontSize: 10 }}>
          {running > 0 && <span className="chip-meta chip-meta--accent">{running} 运行</span>}
          {failed  > 0 && <span className="chip-meta chip-meta--danger">{failed} 失败</span>}
          {done    > 0 && <span className="chip-meta chip-meta--success">{done} 完成</span>}
        </div>

        {panelOpen
          ? <ChevronUp className="w-3.5 h-3.5 opacity-70" strokeWidth={1.6} />
          : <ChevronDown className="w-3.5 h-3.5 opacity-70" strokeWidth={1.6} />}
      </button>

      {panelOpen && (
        <div
          className="chip-paper flex flex-col overflow-hidden"
          style={{
            borderTop: 'none',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            maxHeight: 'calc(100vh - 160px)',
            boxShadow: 'var(--shadow-ink-2)',
          }}
        >
          <div className="paper-scroll overflow-y-auto flex-1 min-h-0">
            {[...tasks].reverse().map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onDismiss={() => removeTask(task.id)}
                onRetry={async () => {
                  await Promise.all(
                    task.placeholderIds.map(pid =>
                      retryGeneration(pid, task.id),
                    ),
                  );
                }}
                onLocate={() => {
                  const live = task.placeholderIds.find(pid =>
                    elements.some(el => el.id === pid),
                  );
                  if (live) setSelection([live]);
                }}
              />
            ))}
          </div>
          {(failed > 0 || done > 0) && (
            <div
              className="flex items-center justify-between hairline-t"
              style={{
                padding: '7px 11px',
                background: 'var(--bg-2)',
              }}
            >
              <span className="meta" style={{ fontSize: 10, textTransform: 'none', letterSpacing: 0 }}>
                {failed > 0 ? '失败需手动重试' : '完成条目自动消失'}
              </span>
              <button
                type="button"
                onClick={clearFinished}
                className="btn btn-ghost"
                style={{ padding: '3px 7px', fontSize: 10.5 }}
                title="清空所有非运行中任务"
              >
                <Trash2 className="w-3 h-3" strokeWidth={1.6} />
                清空
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TaskRowProps {
  task: QueueTask;
  onDismiss: () => void;
  onRetry: () => void | Promise<void>;
  onLocate: () => void;
}

function TaskRow({ task, onDismiss, onRetry, onLocate }: TaskRowProps) {
  const promptPreview = task.prompt.trim().split(/\r?\n/)[0] || '(空提示词)';
  const promptShort = promptPreview.length > 56
    ? promptPreview.slice(0, 56) + '…'
    : promptPreview;

  const statusIcon = (() => {
    if (task.status === 'running') {
      return (
        <span
          className="anim-ink-diffuse inline-block shrink-0"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--accent)',
            marginTop: 4,
          }}
        />
      );
    }
    if (task.status === 'failed') {
      return <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} style={{ color: 'var(--danger)' }} />;
    }
    if (task.status === 'success') {
      return <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} style={{ color: 'var(--success)' }} />;
    }
    return <X className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} style={{ color: 'var(--ink-3)' }} />;
  })();

  const modalityIcon = task.modality === 'video'
    ? <Video className="w-3 h-3" strokeWidth={1.6} style={{ color: 'var(--port-video)' }} />
    : <ImageIcon className="w-3 h-3" strokeWidth={1.6} style={{ color: 'var(--port-image)' }} />;

  const elapsed = (() => {
    const end = task.finishedAt ?? Date.now();
    const delta = Math.max(0, end - task.createdAt);
    const s = delta / 1000;
    return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`;
  })();

  const placeholderCount = task.placeholderIds.length;

  return (
    <div
      className="hairline-b flex flex-col gap-1 transition-colors"
      style={{
        padding: '9px 12px',
        background: task.status === 'failed' ? 'var(--danger-soft)' : 'transparent',
      }}
    >
      <div className="flex items-start gap-2">
        {statusIcon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5" style={{ fontSize: 10.5, color: 'var(--ink-2)' }}>
            {modalityIcon}
            <span className="mono truncate" style={{ maxWidth: 120 }}>{task.model}</span>
            {placeholderCount > 1 && (
              <span className="chip-meta" style={{ padding: '1px 6px', fontSize: 9.5 }}>×{placeholderCount}</span>
            )}
            {task.retryOfId && (
              <span className="chip-meta" style={{ padding: '1px 6px', fontSize: 9.5, color: 'var(--warning)', background: 'color-mix(in oklch, var(--warning) 14%, transparent)' }}>
                retry
              </span>
            )}
            <span className="ml-auto mono" style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>
              {elapsed}
            </span>
          </div>
          <div
            className="line-clamp-2 break-words"
            style={{ fontSize: 11.5, lineHeight: 1.4, color: 'var(--ink-0)' }}
            title={task.prompt}
          >
            {promptShort}
          </div>
          {task.status === 'failed' && task.error && (
            <div
              className="mt-0.5 line-clamp-2 break-words serif-it"
              style={{ fontSize: 10.5, lineHeight: 1.35, color: 'var(--danger)' }}
              title={task.error}
            >
              {task.error}
            </div>
          )}
        </div>
      </div>
      {task.status !== 'running' && (
        <div className="flex items-center gap-1" style={{ paddingLeft: 20 }}>
          <button
            type="button"
            onClick={onLocate}
            className="btn btn-ghost"
            style={{ padding: '2px 6px', fontSize: 10.5 }}
            title="选中画布上的该节点"
          >
            <MapPin className="w-3 h-3" strokeWidth={1.6} />
            定位
          </button>
          {task.status === 'failed' && (
            <button
              type="button"
              onClick={onRetry}
              className="btn btn-tonal"
              style={{ padding: '2px 7px', fontSize: 10.5 }}
              title="重新发起这次生成"
            >
              <RefreshCw className="w-3 h-3" strokeWidth={1.6} />
              重试
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onDismiss}
            className="btn btn-ghost btn-icon"
            style={{ width: 22, height: 22, padding: 0 }}
            title="从队列中移除这条"
          >
            <X className="w-3 h-3" strokeWidth={1.6} />
          </button>
        </div>
      )}
    </div>
  );
}
