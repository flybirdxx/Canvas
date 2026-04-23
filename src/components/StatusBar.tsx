import { useEffect, useState } from 'react';
import { Cloud, CloudOff, Moon, Sun } from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';
import { useGenerationQueueStore } from '../store/useGenerationQueueStore';

/**
 * StatusBar — bottom-anchored paper chip.
 *
 * Left    : element / connection / selection counts
 * Center  : contextual hint (active tool, running queue tally)
 * Right   : zoom level, save state, theme toggle
 *
 * Deliberately monospaced + subdued so it fades into the paper when
 * there's nothing to say. No interactive targets larger than the
 * theme toggle — this is a read-out, not a toolbar.
 */
export function StatusBar() {
  const elements = useCanvasStore(s => s.elements);
  const connections = useCanvasStore(s => s.connections);
  const selectedIds = useCanvasStore(s => s.selectedIds);
  const activeTool = useCanvasStore(s => s.activeTool);
  const stageConfig = useCanvasStore(s => s.stageConfig);
  const lastSavedAt = useCanvasStore(s => s.lastSavedAt);
  const runningTasks = useGenerationQueueStore(s =>
    s.tasks.filter(t => t.status === 'running').length,
  );

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document === 'undefined') return 'light';
    const attr = document.documentElement.getAttribute('data-theme');
    return attr === 'dark' ? 'dark' : 'light';
  });

  // Tick for "seconds ago" recomputation.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('warm-paper-theme', next);
    } catch {/* storage blocked — silently ignore */}
    setTheme(next);
  };

  // Rehydrate theme from storage on first mount (data-theme already set
  // in index.html default, but user preference wins).
  useEffect(() => {
    try {
      const saved = localStorage.getItem('warm-paper-theme');
      if (saved === 'light' || saved === 'dark') {
        document.documentElement.setAttribute('data-theme', saved);
        setTheme(saved);
      }
    } catch {/* ignore */}
  }, []);

  const zoomPct = Math.round(stageConfig.scale * 100);

  return (
    <div
      className="chip-paper chip-paper--flat pointer-events-auto flex items-stretch gap-0 mono z-30"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 16,
        transform: 'translateX(-50%)',
        paddingLeft: 4,
        paddingRight: 4,
        fontSize: 11,
        color: 'var(--ink-2)',
      }}
    >
      {/* Left — counts */}
      <StatSegment>
        <StatCell label="元素" value={elements.length} />
        <StatCell label="连接" value={connections.length} />
        {selectedIds.length > 0 && (
          <StatCell label="选中" value={selectedIds.length} highlight="accent" />
        )}
      </StatSegment>

      <VertRule />

      {/* Center — hint */}
      <div className="flex items-center px-3" style={{ minWidth: 160, justifyContent: 'center' }}>
        {runningTasks > 0 ? (
          <span className="flex items-center gap-1.5">
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--accent)',
              }}
              className="anim-ink-diffuse"
            />
            <span style={{ color: 'var(--ink-1)' }}>{runningTasks} 生成中</span>
          </span>
        ) : (
          <span>{toolHint(activeTool)}</span>
        )}
      </div>

      <VertRule />

      {/* Right — zoom + save + theme */}
      <StatSegment>
        <StatCell label="缩放" value={`${zoomPct}%`} />
        <SaveCell lastSavedAt={lastSavedAt} />
      </StatSegment>

      <VertRule />

      <button
        onClick={toggleTheme}
        title={theme === 'light' ? '切换到深色（夜间纸）' : '切换到浅色（米白纸）'}
        className="btn btn-ghost btn-icon"
        style={{ width: 30, height: 30, padding: 0, margin: '2px 4px 2px 4px' }}
      >
        {theme === 'light'
          ? <Moon className="w-3.5 h-3.5" strokeWidth={1.6} />
          : <Sun className="w-3.5 h-3.5" strokeWidth={1.6} />}
      </button>
    </div>
  );
}

function StatSegment({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3 px-3 py-1.5">{children}</div>;
}

function VertRule() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 1,
        margin: '6px 0',
        background: 'var(--line-1)',
        opacity: 0.7,
      }}
    />
  );
}

function StatCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: 'accent' | 'signal';
}) {
  const color =
    highlight === 'accent' ? 'var(--accent)' :
    highlight === 'signal' ? 'var(--signal)' :
    'var(--ink-0)';
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span style={{ color: 'var(--ink-3)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ color, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </span>
  );
}

function SaveCell({ lastSavedAt }: { lastSavedAt: number | null }) {
  if (!lastSavedAt) {
    return (
      <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--ink-3)' }}>
        <CloudOff className="w-3 h-3" strokeWidth={1.6} />
        <span>未保存</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
      <Cloud className="w-3 h-3" strokeWidth={1.6} />
      <span>{timeAgo(lastSavedAt)}</span>
    </span>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 5_000) return '已保存';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toolHint(tool: string): string {
  switch (tool) {
    case 'select': return '选择 / 拖拽';
    case 'hand': return '画布平移';
    case 'rectangle': return '绘制矩形';
    case 'circle': return '绘制圆形';
    case 'text': return '点击添加文本';
    case 'sticky': return '贴纸便签';
    case 'image': return '图像节点';
    case 'video': return '视频节点';
    case 'audio': return '音频节点';
    default: return '准备就绪';
  }
}
