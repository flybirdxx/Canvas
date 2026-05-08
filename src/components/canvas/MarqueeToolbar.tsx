/**
 * MarqueeToolbar — floating toolbar for the export-marquee workflow.
 *
 * Shown when the marquee mode is active. Provides:
 *   - A hint banner while drawing
 *   - Confirm / Re-draw / Cancel buttons after the region is drawn
 *
 * Extracted from InfiniteCanvas L656-L731.
 */
import React from 'react';
import { Check, RotateCcw, X } from 'lucide-react';

interface MarqueeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface MarqueeToolbarProps {
  drawing: boolean;
  rect: MarqueeRect | null;
  stageConfig: { x: number; y: number; scale: number };
  onExport: (rect: MarqueeRect) => void;
  onReset: () => void;
  onCancel: () => void;
}

export function MarqueeToolbar({ drawing, rect, stageConfig, onExport, onReset, onCancel }: MarqueeToolbarProps) {
  // Phase 1: Drawing hint or no rect yet
  if (!rect || drawing) {
    return (
      <div
        className="absolute z-30 pointer-events-none anim-fade-in"
        style={{
          top: 120,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '5px 12px',
          borderRadius: 'var(--r-pill)',
          background: 'var(--accent)',
          color: 'var(--accent-fg)',
          fontSize: 12,
          fontWeight: 500,
          boxShadow: 'var(--shadow-ink-2)',
        }}
      >
        {drawing ? '松开以确认范围' : '拖拽框选要导出的区域（Esc 取消）'}
      </div>
    );
  }

  // Phase 2: Rect drawn — show action toolbar
  if (rect.w <= 0 || rect.h <= 0) return null;

  const screenX = stageConfig.x + rect.x * stageConfig.scale;
  const screenY = stageConfig.y + rect.y * stageConfig.scale;
  const screenW = rect.w * stageConfig.scale;
  const toolbarTop = Math.max(8, screenY - 44);
  const toolbarLeft = screenX + screenW / 2;

  return (
    <div
      className="chip-paper absolute z-30 flex items-center gap-1"
      style={{
        left: toolbarLeft,
        top: toolbarTop,
        transform: 'translateX(-50%)',
        padding: '3px 4px',
        borderRadius: 'var(--r-pill)',
        boxShadow: 'var(--shadow-ink-3)',
      }}
    >
      <button
        type="button"
        onClick={() => onExport(rect)}
        className="btn btn-primary"
        style={{ padding: '5px 12px', fontSize: 11, borderRadius: 'var(--r-pill)' }}
      >
        <Check className="w-3.5 h-3.5" strokeWidth={1.8} />
        导出此区域
      </button>
      <button
        type="button"
        onClick={onReset}
        className="btn btn-ghost"
        style={{ padding: '5px 10px', fontSize: 11, borderRadius: 'var(--r-pill)' }}
        title="重新框选"
      >
        <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.6} />
        重新框
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="btn btn-ghost btn-icon"
        style={{ width: 26, height: 26, padding: 0, borderRadius: '50%' }}
        title="取消 (Esc)"
      >
        <X className="w-3.5 h-3.5" strokeWidth={1.6} />
      </button>
    </div>
  );
}
