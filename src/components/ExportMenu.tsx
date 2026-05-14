import { useEffect, useRef, useState } from 'react';
import {
  Download,
  ChevronDown,
  ChevronRight,
  Scissors,
  Frame,
  SquareDashed,
  FileImage,
  FileText,
  FileJson,
  Globe,
  Film,
  Archive,
  Upload,
} from 'lucide-react';
import { exportSelection, exportVisible } from '@/utils/exportPng';
import { exportSelectionAsSvg } from '@/utils/exportSvg';
import { exportViewportAsPdf, exportSelectionAsPdf, exportAsCustomPdf } from '@/utils/exportPdf';
import { exportAsStandaloneHtml } from '@/utils/exportHtml';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { SceneElement } from '@/types/canvas';
import { ExportMp4Dialog } from './ExportMp4Dialog';
import { ExportZipDialog } from './ExportZipDialog';
import { ImportZipDialog } from './ImportZipDialog';

/* ---------- helpers ---------- */

const SEP = (
  <div style={{ height: 1, background: 'var(--bg-3)', margin: '3px 0' }} />
);

function SectionHdr({ label }: { label: string }) {
  return (
    <div
      className="mono"
      style={{
        padding: '5px 9px 3px',
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: '0.08em',
        color: 'var(--ink-3)',
        textTransform: 'uppercase' as const,
      }}
    >
      {label}
    </div>
  );
}

/**
 * ExportMenu — paper-chip dropdown anchored in TopBar.
 *
 * Emits `canvas:start-marquee-export` via CustomEvent so InfiniteCanvas
 * can enter the marquee tool mode without a shared store.
 */
export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [mp4DialogOpen, setMp4DialogOpen] = useState(false);
  const [zipDialogOpen, setZipDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { viewMode, elements } = useCanvasStore();

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
    setTimeout(fn, 0); // close menu before any util-raised dialog
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost"
        title="导出"
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
          {/* ——— 图片导出 ——— */}
          <SectionHdr label="图片导出" />
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
          <MenuRow
            icon={<FileImage className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />}
            label="导出为 SVG"
            onClick={() => handle(async () => {
              const ok = await exportSelectionAsSvg();
              if (!ok) {/* error already alerted by the util */ }
            })}
          />

          {SEP}

          {/* ——— 文档导出 ——— */}
          <SectionHdr label="文档导出" />
          <MenuRow
            icon={<FileText className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--signal)' }} />}
            label="PDF（视口尺寸）"
            onClick={() => handle(() => exportViewportAsPdf())}
          />
          <PdfSizeSubmenu />

          {SEP}

          {/* ——— 网页 ——— */}
          <SectionHdr label="网页" />
          <MenuRow
            icon={<Globe className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />}
            label="导出为网页 (HTML)"
            onClick={() => handle(async () => {
              const ok = await exportAsStandaloneHtml();
              if (!ok) {/* error already alerted */}
            })}
          />

          {SEP}

          {/* ——— 画布存档 ——— */}
          <SectionHdr label="画布存档" />
          <MenuRow
            icon={<Archive className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--accent)' }} />}
            label="导出 ZIP"
            onClick={() => {
              handle(() => {
                setZipDialogOpen(true);
              });
            }}
          />
          <MenuRow
            icon={<Upload className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />}
            label="导入 ZIP"
            onClick={() => {
              handle(() => {
                setImportDialogOpen(true);
              });
            }}
          />

          {viewMode === 'storyboard' && (
            <>
              {SEP}
              {/* ——— 分镜视频 ——— */}
              <SectionHdr label="分镜视频" />
              <MenuRow
                icon={<Film className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--accent)' }} />}
                label="导出 MP4"
                onClick={() => {
                  setOpen(false);
                  setTimeout(() => setMp4DialogOpen(true), 50);
                }}
              />
            </>
          )}

        </div>
      )}

      {mp4DialogOpen && (
        <ExportMp4Dialog
          sceneCount={elements.filter((e): e is SceneElement => e.type === 'scene').length}
          onClose={() => setMp4DialogOpen(false)}
        />
      )}

      {zipDialogOpen && (
        <ExportZipDialog onClose={() => setZipDialogOpen(false)} />
      )}

      {importDialogOpen && (
        <ImportZipDialog onClose={() => setImportDialogOpen(false)} />
      )}
    </div>
  );
}

function PdfSizeSubmenu() {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
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
        <div className="w-5 h-5 flex items-center justify-center shrink-0">
          <FileJson className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--accent)' }} />
        </div>
        <span className="flex-1" style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-0)' }}>
          PDF（选中节点）
        </span>
        <ChevronRight className="w-3 h-3 opacity-60" strokeWidth={1.6} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            left: '100%',
            top: 0,
            minWidth: 160,
            padding: 5,
            background: 'var(--bg-0)',
            borderRadius: 'var(--r-sm)',
            boxShadow: 'var(--shadow-ink-3)',
            border: '1px solid var(--line-1)',
            zIndex: 61,
          }}
        >
          <button
            type="button"
            className="w-full text-left"
            style={{ padding: '6px 9px', borderRadius: 'var(--r-sm)', background: 'transparent', border: '1px solid transparent', cursor: 'pointer', fontSize: 12, color: 'var(--ink-0)' }}
            onClick={() => { setOpen(false); exportSelectionAsPdf(); }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            A4 纵向
          </button>
          <button
            type="button"
            className="w-full text-left"
            style={{ padding: '6px 9px', borderRadius: 'var(--r-sm)', background: 'transparent', border: '1px solid transparent', cursor: 'pointer', fontSize: 12, color: 'var(--ink-0)' }}
            onClick={() => { setOpen(false); exportAsCustomPdf('a3'); }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            A3
          </button>
          <button
            type="button"
            className="w-full text-left"
            style={{ padding: '6px 9px', borderRadius: 'var(--r-sm)', background: 'transparent', border: '1px solid transparent', cursor: 'pointer', fontSize: 12, color: 'var(--ink-0)' }}
            onClick={() => { setOpen(false); exportAsCustomPdf('letter'); }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            Letter
          </button>
          <button
            type="button"
            className="w-full text-left"
            style={{ padding: '6px 9px', borderRadius: 'var(--r-sm)', background: 'transparent', border: '1px solid transparent', cursor: 'pointer', fontSize: 12, color: 'var(--ink-0)' }}
            onClick={() => { setOpen(false); exportAsCustomPdf('viewport'); }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            自定义（节点尺寸）
          </button>
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
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
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
