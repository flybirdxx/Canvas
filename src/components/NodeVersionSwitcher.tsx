import React from 'react';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';
import type { CanvasElement, NodeVersion } from '../types/canvas';

/**
 * Small floating bar rendered at the top-center of selected image/video
 * nodes that have 2+ versions. Lets the user cycle through the node's
 * generation history without opening any panel.
 *
 * Placement is handled by the parent (InfiniteCanvas overlay layer) — this
 * component only needs screen-space x/y and the element data.
 */
export interface NodeVersionSwitcherProps {
  element: CanvasElement;
  /** Top-center anchor in screen coords (already includes stage scale + translate). */
  x: number;
  y: number;
  /** Canvas scale; applied via CSS transform so the bar sizes with the node. */
  scale: number;
}

export function NodeVersionSwitcher({ element, x, y, scale }: NodeVersionSwitcherProps) {
  const updateElement = useCanvasStore(s => s.updateElement);

  const versions = ((element as any).versions as NodeVersion[] | undefined) ?? [];
  const activeIndex = ((element as any).activeVersionIndex as number | undefined) ?? versions.length - 1;

  if (versions.length < 2) return null;

  const safeIndex = Math.max(0, Math.min(activeIndex, versions.length - 1));
  const current = versions[safeIndex];
  const canPrev = safeIndex > 0;
  const canNext = safeIndex < versions.length - 1;

  const switchTo = (idx: number) => {
    if (idx < 0 || idx >= versions.length || idx === safeIndex) return;
    const target = versions[idx];
    updateElement(element.id, {
      src: target.src,
      activeVersionIndex: idx,
    } as Partial<CanvasElement>);
  };

  const prev = () => canPrev && switchTo(safeIndex - 1);
  const next = () => canNext && switchTo(safeIndex + 1);

  const tooltip = current.prompt
    ? `版本 ${safeIndex + 1} / ${versions.length} · ${current.prompt.slice(0, 60)}${current.prompt.length > 60 ? '…' : ''}`
    : `版本 ${safeIndex + 1} / ${versions.length}`;

  return (
    <div
      className="absolute z-10 pointer-events-auto"
      style={{
        left: x,
        top: y,
        transform: `scale(${scale}) translate(-50%, -100%)`,
        transformOrigin: 'top left',
      }}
    >
      <div
        className="chip-paper flex items-center select-none"
        title={tooltip}
        style={{
          marginBottom: 6,
          padding: '3px 6px',
          gap: 2,
          borderRadius: 'var(--r-pill)',
          fontSize: 11,
          fontWeight: 500,
          background: 'var(--ink-0)',
          color: 'var(--bg-0)',
          border: '1px solid var(--ink-1)',
          boxShadow: 'var(--shadow-ink-2)',
        }}
      >
        <History className="w-3 h-3 mx-0.5" strokeWidth={1.6} style={{ opacity: 0.7 }} />
        <button
          type="button"
          onClick={prev}
          disabled={!canPrev}
          className="flex items-center justify-center transition-colors"
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'transparent',
            color: 'inherit',
            opacity: canPrev ? 1 : 0.3,
            cursor: canPrev ? 'pointer' : 'not-allowed',
          }}
          title="上一版本"
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>

        <div className="flex items-center" style={{ gap: 2, padding: '0 4px' }}>
          {renderDots(versions.length, safeIndex, switchTo)}
        </div>

        <span
          className="mono"
          style={{ fontSize: 10.5, fontVariantNumeric: 'tabular-nums', opacity: 0.8, margin: '0 2px' }}
        >
          {safeIndex + 1}/{versions.length}
        </span>

        <button
          type="button"
          onClick={next}
          disabled={!canNext}
          className="flex items-center justify-center transition-colors"
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'transparent',
            color: 'inherit',
            opacity: canNext ? 1 : 0.3,
            cursor: canNext ? 'pointer' : 'not-allowed',
          }}
          title="下一版本"
        >
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}

// Show at most MAX_DOTS; if we exceed, keep first/last in view and ellipsis.
function renderDots(total: number, active: number, onPick: (i: number) => void) {
  const MAX_DOTS = 8;
  if (total <= MAX_DOTS) {
    return Array.from({ length: total }).map((_, i) => (
      <Dot key={i} index={i} active={i === active} onClick={() => onPick(i)} />
    ));
  }
  // Windowed: keep active centered where possible.
  const half = Math.floor(MAX_DOTS / 2);
  let start = Math.max(0, active - half);
  let end = start + MAX_DOTS;
  if (end > total) {
    end = total;
    start = end - MAX_DOTS;
  }
  const nodes: React.ReactNode[] = [];
  if (start > 0) {
    nodes.push(
      <span key="ellipsis-start" style={{ fontSize: 9, opacity: 0.5, margin: '0 -2px' }}>…</span>
    );
  }
  for (let i = start; i < end; i++) {
    nodes.push(<Dot key={i} index={i} active={i === active} onClick={() => onPick(i)} />);
  }
  if (end < total) {
    nodes.push(
      <span key="ellipsis-end" style={{ fontSize: 9, opacity: 0.5, margin: '0 -2px' }}>…</span>
    );
  }
  return nodes;
}

function Dot({ active, index, onClick }: { active: boolean; index: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`跳到版本 ${index + 1}`}
      className="transition-all"
      style={{
        width: active ? 6 : 4,
        height: active ? 6 : 4,
        borderRadius: '50%',
        background: active
          ? 'var(--bg-0)'
          : 'color-mix(in oklch, white 40%, transparent)',
        border: 'none',
        padding: 0,
      }}
    />
  );
}
