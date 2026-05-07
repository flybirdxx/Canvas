import React, { useState, useEffect } from 'react';
import { useExecutionStore, type ExecutionRun } from '../../../store/useExecutionStore';

/**
 * Warm-paper port palette.
 *
 * Konva's Circle takes a resolved color string — oklch tokens can't be
 * read from CSS vars in a canvas. These values mirror the --port-* vars
 * from tokens.css (close-enough sRGB approximations of the oklch source).
 */
export function getPortColor(type: string) {
  switch (type) {
    case 'text':  return '#4A88E9';   // blue
    case 'image': return '#FF6B6B';   // coral red
    case 'video': return '#9254DE';   // purple
    case 'audio': return '#52C41A';   // green
    default:      return '#999999';   // neutral gray
  }
}

/* -------------------------------------------------------------------- */
/*  Tokens (sRGB mirrors) — keeping Konva and DOM in visual sync        */
/* -------------------------------------------------------------------- */

export const INK_1 = '#666666';             // port label / selection border
export const PAPER_EDGE = 'rgba(40,30,20,0.12)'; // polaroid hairline
export const BG_1 = '#F5EFE4';              // --bg-1 sRGB mirror (warm paper)

/* Polaroid card classes — shared across rectangle / text / video / audio
   DOM overlays. We don't use backdrop blur: the canvas already has a
   paper ground, blur stacked on opaque paper produces muddy tones. */
export const POLAROID_STYLE: React.CSSProperties = {
  background: 'var(--bg-2)',
  borderRadius: '16px',
  overflow: 'hidden',
};

export function useExecutionBorder(nodeId: string): string {
  const [execRun, setExecRun] = useState<ExecutionRun | undefined>(undefined);
  useEffect(() => {
    const unsub = useExecutionStore.subscribe((state) => {
      setExecRun(state.runs.length > 0 ? state.runs[state.runs.length - 1] : undefined);
    });
    setExecRun(useExecutionStore.getState().getActiveRun());
    return unsub;
  }, []);

  if (!execRun) return 'transparent';
  const ns = execRun.nodeStates[nodeId];
  if (!ns) return 'transparent';
  switch (ns.status) {
    case 'queued':  return '#E6A23C';
    case 'running':  return '#409EFF';
    case 'success':  return '#67C23A';
    case 'failed':   return '#F56C6C';
    default:         return 'transparent';
  }
}