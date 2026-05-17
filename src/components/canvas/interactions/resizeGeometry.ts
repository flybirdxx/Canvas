export const NODE_RESIZE_MIN_WIDTH = 60;
export const NODE_RESIZE_MIN_HEIGHT = 40;

interface ResizeStart {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ResizeDelta {
  x: number;
  y: number;
}

export function shouldLockNodeAspectRatio(element: {
  type?: string;
  mimeType?: string;
  thumbnailDataUrl?: string;
}): boolean {
  if (element.type === 'image' || element.type === 'aigenerating') return true;
  if (element.type === 'file') {
    const mimeType = String(element.mimeType || '').toLowerCase();
    if (mimeType.startsWith('image/')) return true;
    if ((mimeType.startsWith('video/') || mimeType.startsWith('audio/')) && element.thumbnailDataUrl) return true;
  }
  return false;
}

export function resolveNodeResize(args: {
  start: ResizeStart;
  delta: ResizeDelta;
  lockAspectRatio: boolean;
}): { x: number; y: number; width: number; height: number } {
  const { start, delta, lockAspectRatio } = args;
  let width = Math.max(NODE_RESIZE_MIN_WIDTH, start.width + delta.x);
  let height = Math.max(NODE_RESIZE_MIN_HEIGHT, start.height + delta.y);

  if (lockAspectRatio && start.width > 0 && start.height > 0) {
    const aspect = start.width / start.height;
    const rawWidth = start.width + delta.x;
    const rawHeight = start.height + delta.y;
    const absDeltaWidth = Math.abs(width - start.width);
    const absDeltaHeight = Math.abs(height - start.height);

    if (absDeltaWidth >= absDeltaHeight) {
      width = Math.max(NODE_RESIZE_MIN_WIDTH, rawWidth);
      height = width / aspect;
    } else {
      height = Math.max(NODE_RESIZE_MIN_HEIGHT, rawHeight);
      width = height * aspect;
    }
    if (width < NODE_RESIZE_MIN_WIDTH) {
      width = NODE_RESIZE_MIN_WIDTH;
      height = width / aspect;
    }
    if (height < NODE_RESIZE_MIN_HEIGHT) {
      height = NODE_RESIZE_MIN_HEIGHT;
      width = height * aspect;
    }
  }

  return { x: start.x, y: start.y, width, height };
}
