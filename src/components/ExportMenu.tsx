import { useEffect, useRef, useState } from 'react';
import { Download, ChevronDown, Scissors, Frame, SquareDashed, FileImage, FileText } from 'lucide-react';
import { exportSelection, exportVisible } from '../utils/exportPng';
import { exportSelectionAsSvg } from '../utils/exportSvg';
import { exportViewportAsPdf, exportSelectionAsPdf } from '../utils/exportPdf';
import { exportAsStandaloneHtml } from '../utils/exportHtml';

/**
 * ExportMenu — paper-chip dropdown anchored in TopBar.
 *
 * Emits `canvas:start-marquee-export` via CustomEvent so InfiniteCanvas
 * can enter the marquee tool mode without a shared store.
 */
export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handle = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 0);  // close menu before any util-raised dialog
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="btn btn-ghost"
        title="导出 PNG"
        style={{ padding: '6px 10px', fontSize: 12 }}
      >
        <Download className="w-4 h-4" strokeWidth={1.6} />
        <span className="hidden md:inline">导出</span>
        <ChevronDown className="w-3 h-3 opacity-60" strokeWidth={1.6} />
      </button>

      {open && (
        <div
          className="chip-paper anim-pop"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: 'max-content',
            minWidth: 180,
            padding: 5,
            zIndex: 60,
            boxShadow: 'var(--shadow-ink-3)',
          }}
        >
          <MenuRow
            icon={<Scissors className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--signal)' }} />}
            label="导出选中"
            hotkey="⌘⇧E"
            onClick={() => handle(() => exportSelection())}
          />
          <MenuRow
            icon={<SquareDashed className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--accent)' }} />}
            label="框选导出"
            hotkey="E"
            onClick={() =>
              handle(() =>
                window.dispatchEvent(new CustomEvent('canvas:start-marquee-export')),
              )
            }
          />
          <MenuRow
            icon={<Frame className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--success)' }} />}
            label="导出可视区"
            onClick={() => handle(() => exportVisible())}
          />
          <div style={{ height: 1, background: 'var(--bg-3)', margin: '4px 0' }} />
          <MenuRow
            icon={<FileImage className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />}
            label="导出为 SVG"
            onClick={() => handle(() => exportSelectionAsSvg())}
          />
          <div style={{ height: 1, background: 'var(--bg-3)', margin: '4px 0' }} />
          <MenuRow
            icon={<FileText className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--signal)' }} />}
            label="导出为 PDF（视口尺寸）"
            onClick={() => handle(() => exportViewportAsPdf())}
          />
          <MenuRow
            icon={<FileText className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--accent)' }} />}
            label="导出为 PDF（A4）"
            onClick={() => handle(() => exportSelectionAsPdf())}
          />
          <div style={{ height: 1, background: 'var(--bg-3)', margin: '4px 0' }} />
          <MenuRow
            icon={<FileText className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />}
            label="导出为网页 (HTML)"
            onClick={() => handle(() => exportAsStandaloneHtml())}
          />
        </div>
      )}
    </div>
  );
}

function MenuRow({
  icon,
  label,
  hotkey,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hotkey?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 text-left transition-colors"
      style={{
        padding: '7px 9px',
        borderRadius: 'var(--r-sm)',
        background: 'transparent',
        border: '1px solid transparent',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div className="w-5 h-5 flex items-center justify-center shrink-0">{icon}</div>
      <span
        className="flex-1"
        style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-0)' }}
      >
        {label}
      </span>
      {hotkey && (
        <span
          className="mono"
          style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.04em' }}
        >
          {hotkey}
        </span>
      )}
    </button>
  );
}
