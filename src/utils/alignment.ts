import type { CanvasElement } from '@/types/canvas';

/**
 * Pure positional math for selection-based alignment / distribution / grid.
 * All functions take the full selection and return a list of `{id, x, y}`
 * updates — they never mutate the input. Callers commit via
 * `updateElementPosition` so each movement remains in the undo stack as a
 * single logical step.
 *
 * Element rect is `{x, y, width, height}` (top-left origin). All outputs
 * are in the same canvas coordinate space as the inputs.
 */

export interface PositionUpdate {
  id: string;
  x: number;
  y: number;
}

type Rectish = Pick<CanvasElement, 'id' | 'x' | 'y' | 'width' | 'height'>;

function minLeft(els: Rectish[]): number {
  return Math.min(...els.map(e => e.x));
}
function maxRight(els: Rectish[]): number {
  return Math.max(...els.map(e => e.x + e.width));
}
function minTop(els: Rectish[]): number {
  return Math.min(...els.map(e => e.y));
}
function maxBottom(els: Rectish[]): number {
  return Math.max(...els.map(e => e.y + e.height));
}

// ---------------- Alignment (6 directions) ----------------

export function alignLeft(els: Rectish[]): PositionUpdate[] {
  if (els.length < 2) return [];
  const left = minLeft(els);
  return els.map(e => ({ id: e.id, x: left, y: e.y }));
}

export function alignRight(els: Rectish[]): PositionUpdate[] {
  if (els.length < 2) return [];
  const right = maxRight(els);
  return els.map(e => ({ id: e.id, x: right - e.width, y: e.y }));
}

export function alignCenterHorizontal(els: Rectish[]): PositionUpdate[] {
  if (els.length < 2) return [];
  const center = (minLeft(els) + maxRight(els)) / 2;
  return els.map(e => ({ id: e.id, x: center - e.width / 2, y: e.y }));
}

export function alignTop(els: Rectish[]): PositionUpdate[] {
  if (els.length < 2) return [];
  const top = minTop(els);
  return els.map(e => ({ id: e.id, x: e.x, y: top }));
}

export function alignBottom(els: Rectish[]): PositionUpdate[] {
  if (els.length < 2) return [];
  const bottom = maxBottom(els);
  return els.map(e => ({ id: e.id, x: e.x, y: bottom - e.height }));
}

export function alignCenterVertical(els: Rectish[]): PositionUpdate[] {
  if (els.length < 2) return [];
  const middle = (minTop(els) + maxBottom(els)) / 2;
  return els.map(e => ({ id: e.id, x: e.x, y: middle - e.height / 2 }));
}

// ---------------- Distribution ----------------

/**
 * Evenly distribute **inner gaps** horizontally: the leftmost and rightmost
 * elements stay put; the middle elements are placed so that the gap between
 * each consecutive pair's right/left edges is identical. Needs ≥ 3 elements
 * for a non-trivial effect.
 */
export function distributeHorizontal(els: Rectish[]): PositionUpdate[] {
  if (els.length < 3) return [];
  const sorted = [...els].sort((a, b) => a.x - b.x);
  const totalWidth = sorted.reduce((sum, e) => sum + e.width, 0);
  const left = sorted[0].x;
  const right = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width;
  const span = right - left;
  const freeSpace = span - totalWidth;
  const gap = freeSpace / (sorted.length - 1);
  // Walk left-to-right, cursor = running right edge.
  const updates: PositionUpdate[] = [];
  let cursor = left;
  for (const e of sorted) {
    updates.push({ id: e.id, x: cursor, y: e.y });
    cursor += e.width + gap;
  }
  return updates;
}

export function distributeVertical(els: Rectish[]): PositionUpdate[] {
  if (els.length < 3) return [];
  const sorted = [...els].sort((a, b) => a.y - b.y);
  const totalHeight = sorted.reduce((sum, e) => sum + e.height, 0);
  const top = sorted[0].y;
  const bottom = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height;
  const span = bottom - top;
  const freeSpace = span - totalHeight;
  const gap = freeSpace / (sorted.length - 1);
  const updates: PositionUpdate[] = [];
  let cursor = top;
  for (const e of sorted) {
    updates.push({ id: e.id, x: e.x, y: cursor });
    cursor += e.height + gap;
  }
  return updates;
}

// ---------------- Grid (auto-layout) ----------------

/**
 * Arrange the selection into a uniform grid. Columns default to the square
 * root of `n` so the grid is close to 1:1 in counts; each cell takes the
 * bounding size of the widest + tallest element in the selection (plus gap).
 * Origin is the bounding box's top-left — the grid replaces where the
 * selection currently occupies.
 */
export function arrangeGrid(els: Rectish[], gap = 40): PositionUpdate[] {
  if (els.length < 2) return [];
  const n = els.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const cellW = Math.max(...els.map(e => e.width));
  const cellH = Math.max(...els.map(e => e.height));
  const originX = minLeft(els);
  const originY = minTop(els);

  // Stable order: keep the user's current reading order (top→bottom, left→right).
  const sorted = [...els].sort((a, b) => {
    if (Math.abs(a.y - b.y) > cellH / 2) return a.y - b.y;
    return a.x - b.x;
  });

  return sorted.map((e, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Center each element within its cell so varying sizes look balanced.
    return {
      id: e.id,
      x: originX + col * (cellW + gap) + (cellW - e.width) / 2,
      y: originY + row * (cellH + gap) + (cellH - e.height) / 2,
    };
  });
}
