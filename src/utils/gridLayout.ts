/**
 * Layout helpers for batch generation: given an anchor node's rect and the
 * desired batch size N, return N {x,y,w,h} slots laid out to the right of
 * the anchor (a row for n<=2, a 2x2 grid for n=4, otherwise a 3-column flow).
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ANCHOR_GAP = 40; // canvas units between anchor right edge and first slot

/**
 * Return N slot rects placed to the right of `anchor`, preserving anchor's w/h.
 * The first slot sits at `(anchor.x + anchor.w + ANCHOR_GAP, anchor.y)`; subsequent
 * slots flow left-to-right, wrapping at the columns derived from N.
 */
export function computeBatchGrid(anchor: Rect, n: number, gap: number = 20): Rect[] {
  if (n <= 0) return [];
  const cols = pickCols(n);
  const originX = anchor.x + anchor.w + ANCHOR_GAP;
  const originY = anchor.y;
  const slots: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    slots.push({
      x: originX + col * (anchor.w + gap),
      y: originY + row * (anchor.h + gap),
      w: anchor.w,
      h: anchor.h,
    });
  }
  return slots;
}

function pickCols(n: number): number {
  if (n <= 1) return 1;
  if (n === 2) return 2;
  if (n === 4) return 2;
  return Math.min(3, n);
}
