import { useState, useMemo } from 'react';
import { History, ChevronRight, Eraser } from 'lucide-react';
import { useCanvasStore, HistorySnapshot } from '@/store/useCanvasStore';

function formatTime(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function HistoryPanel() {
  const past = useCanvasStore(s => s.past);
  const future = useCanvasStore(s => s.future);
  const elements = useCanvasStore(s => s.elements);
  const connections = useCanvasStore(s => s.connections);
  const currentLabel = useCanvasStore(s => s.currentLabel);
  const currentTimestamp = useCanvasStore(s => s.currentTimestamp);
  const jumpToHistory = useCanvasStore(s => s.jumpToHistory);
  const clearHistory = useCanvasStore(s => s.clearHistory);

  const [isOpen, setIsOpen] = useState(false);

  const entries = useMemo(() => {
    const current: HistorySnapshot = {
      elements,
      connections,
      label: currentLabel,
      timestamp: currentTimestamp,
    };
    return [...past, current, ...future];
  }, [past, future, elements, connections, currentLabel, currentTimestamp]);

  const currentIdx = past.length;
  const totalChanges = past.length + future.length;

  return (
    <div
      className="absolute z-20 flex items-end gap-2 anim-fade-in"
      style={{ bottom: 68, right: 16 }}
    >
      {isOpen && (
        <div
          className="chip-paper flex flex-col overflow-hidden"
          style={{
            width: 288,
            maxHeight: '50vh',
            boxShadow: 'var(--shadow-ink-2)',
          }}
        >
          <div
            className="hairline-b flex items-center justify-between"
            style={{ padding: '9px 12px', background: 'var(--bg-2)' }}
          >
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5" strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />
              <span
                className="serif"
                style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-0)' }}
              >
                历史记录
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 'var(--r-sm)',
                  color: 'var(--ink-2)',
                  background: 'var(--bg-0)',
                  border: '1px solid var(--line-1)',
                }}
              >
                {entries.length}
              </span>
            </div>
            <button
              onClick={() => {
                if (confirm('确定要清空历史记录吗？（画布内容不会变化）')) clearHistory();
              }}
              disabled={totalChanges === 0}
              className="btn btn-ghost btn-icon"
              style={{
                width: 24,
                height: 24,
                padding: 0,
                opacity: totalChanges === 0 ? 0.3 : 1,
              }}
              title="清空历史记录"
            >
              <Eraser className="w-3.5 h-3.5" strokeWidth={1.6} />
            </button>
          </div>

          <div className="paper-scroll overflow-y-auto flex-1">
            {entries.length === 0 && (
              <div
                style={{
                  padding: 24,
                  textAlign: 'center',
                  fontSize: 11,
                  color: 'var(--ink-3)',
                }}
              >
                暂无历史
              </div>
            )}
            {entries.map((entry, idx) => {
              const isCurrent = idx === currentIdx;
              const isFuture = idx > currentIdx;
              return (
                <button
                  key={`${entry.timestamp}-${idx}`}
                  onClick={() => jumpToHistory(idx)}
                  className="w-full text-left flex items-center gap-2 transition-colors"
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--line-1)',
                    background: isCurrent
                      ? 'color-mix(in oklch, var(--accent) 10%, var(--bg-0))'
                      : 'transparent',
                    opacity: isFuture ? 0.55 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent) e.currentTarget.style.background = 'var(--bg-2)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) e.currentTarget.style.background = 'transparent';
                  }}
                  title={`跳转到此步骤 · ${formatTime(entry.timestamp)}`}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: isCurrent
                        ? 'var(--accent)'
                        : isFuture
                          ? 'var(--line-2)'
                          : 'var(--ink-2)',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="truncate"
                      style={{
                        fontSize: 12,
                        fontWeight: isCurrent ? 600 : 500,
                        color: isCurrent ? 'var(--accent)' : 'var(--ink-0)',
                      }}
                    >
                      {entry.label}
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: 9.5, color: 'var(--ink-3)', marginTop: 1 }}
                    >
                      {formatTime(entry.timestamp)} · {entry.elements.length} 元素 · {entry.connections.length} 连线
                    </div>
                  </div>
                  {isCurrent && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 'var(--r-sm)',
                        color: 'var(--accent-fg)',
                        background: 'var(--accent)',
                      }}
                    >
                      当前
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(v => !v)}
        className={isOpen ? 'btn btn-primary' : 'btn btn-ghost'}
        style={{
          padding: '6px 10px',
          fontSize: 11,
          borderRadius: 'var(--r-md)',
          gap: 6,
          ...(isOpen ? {} : { background: 'var(--bg-0)', border: '1px solid var(--line-1)', boxShadow: 'var(--shadow-ink-1)' }),
        }}
        title="历史记录"
      >
        <History className="w-3.5 h-3.5" strokeWidth={1.6} />
        <span style={{ fontWeight: 500 }}>历史</span>
        <span
          className="mono"
          style={{
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 'var(--r-sm)',
            background: isOpen ? 'color-mix(in oklch, white 20%, transparent)' : 'var(--bg-2)',
            color: isOpen ? 'var(--accent-fg)' : 'var(--ink-2)',
          }}
        >
          {currentIdx + 1}/{entries.length}
        </span>
        <ChevronRight
          className="w-3 h-3 transition-transform"
          strokeWidth={1.8}
          style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
        />
      </button>
    </div>
  );
}
