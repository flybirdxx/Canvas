import { Undo2, Redo2, LayoutTemplate, Settings, Sparkles, Share2 } from 'lucide-react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { ExportMenu } from '../ExportMenu';
import { SaveControls } from '../SaveControls';

/**
 * TopBar — the editorial masthead.
 *
 * Centered, single paper chip. Contents, in reading order:
 *   [ wordmark  ·  doc title ] | [ undo | redo ] | [ templates | export | save ] | [ settings ] | [ AI | share ]
 *
 * The chip "floats" above the canvas with a soft paper lift shadow.
 * Size is responsive: collapses inner labels below ~960px.
 */
export function TopBar({
  onOpenSettings,
  onOpenTemplates,
}: {
  onOpenSettings: () => void;
  onOpenTemplates: () => void;
}) {
  const undo = useCanvasStore(s => s.undo);
  const redo = useCanvasStore(s => s.redo);
  const past = useCanvasStore(s => s.past);
  const future = useCanvasStore(s => s.future);

  return (
    <div
      className="chip-paper anim-fade-in z-30 flex items-stretch pointer-events-auto"
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: 4,
        gap: 2,
      }}
    >
      {/* Wordmark + document title */}
      <div className="flex items-center gap-3 px-3" style={{ minHeight: 32 }}>
        <span
          className="wordmark"
          style={{
            fontSize: 18,
            lineHeight: 1,
            color: 'var(--ink-0)',
          }}
          title="AI Canvas · Warm Paper Studio"
        >
          Canvas<span style={{ color: 'var(--accent)' }}>.</span>
        </span>
        <div
          aria-hidden="true"
          style={{ width: 1, height: 16, background: 'var(--line-1)', opacity: 0.7 }}
        />
        <div className="flex flex-col leading-tight">
          <span className="serif-it" style={{ fontSize: 12, color: 'var(--ink-1)' }}>
            未命名设计
          </span>
          <span className="meta" style={{ fontSize: 9.5 }}>
            .canvas · local
          </span>
        </div>
      </div>

      <VertRule />

      {/* Undo / Redo */}
      <div className="flex items-center" style={{ gap: 2, padding: '0 4px' }}>
        <ChromeIconBtn
          onClick={undo}
          disabled={past.length === 0}
          title="撤销 (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" strokeWidth={1.6} />
        </ChromeIconBtn>
        <ChromeIconBtn
          onClick={redo}
          disabled={future.length === 0}
          title="重做 (Ctrl+Shift+Z)"
        >
          <Redo2 className="w-4 h-4" strokeWidth={1.6} />
        </ChromeIconBtn>
      </div>

      <VertRule />

      {/* Templates */}
      <div className="flex items-center" style={{ padding: '0 4px' }}>
        <button
          onClick={onOpenTemplates}
          className="btn btn-ghost"
          title="模板市场"
          style={{ padding: '6px 10px', fontSize: 12 }}
        >
          <LayoutTemplate className="w-4 h-4" strokeWidth={1.6} />
          <span className="hidden md:inline">模板</span>
        </button>
      </div>

      <VertRule />

      {/* Export + Save  (these components self-style via .chip-paper / .btn) */}
      <div className="flex items-center gap-1" style={{ padding: '0 4px' }}>
        <ExportMenu />
        <SaveControls />
      </div>

      <VertRule />

      {/* Settings */}
      <div className="flex items-center" style={{ padding: '0 4px' }}>
        <ChromeIconBtn onClick={onOpenSettings} title="设置">
          <Settings className="w-4 h-4" strokeWidth={1.6} />
        </ChromeIconBtn>
      </div>

      <VertRule />

      {/* AI workspace + Share */}
      <div className="flex items-center gap-1.5" style={{ padding: '0 4px' }}>
        <button
          className="btn btn-tonal"
          style={{ padding: '6px 10px', fontSize: 12 }}
          title="AI 工作区"
        >
          <Sparkles className="w-3.5 h-3.5" strokeWidth={1.8} />
          <span className="hidden md:inline">AI 工作区</span>
        </button>
        <button
          className="btn btn-primary"
          style={{ padding: '6px 12px', fontSize: 12 }}
          title="分享"
        >
          <Share2 className="w-3.5 h-3.5" strokeWidth={1.8} />
          <span className="hidden md:inline">分享</span>
        </button>
      </div>
    </div>
  );
}

function VertRule() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 1,
        margin: '6px 0',
        background: 'var(--line-1)',
        opacity: 0.6,
      }}
    />
  );
}

function ChromeIconBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="btn btn-ghost btn-icon"
      style={{ width: 30, height: 30, padding: 0 }}
    >
      {children}
    </button>
  );
}
