import { useCanvasStore } from '../store/useCanvasStore';
import { getStage } from './stageRegistry';

/**
 * PNG export utilities driven by the Konva Stage registered in `stageRegistry`.
 *
 * NOTE: Konva's `Stage.toDataURL({x,y,width,height})` uses viewport pixel coords,
 * so all rects passed here must be screen-space (not canvas-space). Selection
 * export therefore converts canvas-space AABBs via `screen = stageX + canvas * scale`.
 *
 * Limitation (known): nodes rendered via `<Html>` overlays (text, sticky, etc.)
 * are DOM elements outside Konva's rendering pipeline and will not appear in the
 * exported PNG. Native Konva nodes (images, shapes) export as expected.
 */

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function timestampFilename(prefix: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${prefix}-${stamp}.png`;
}

/**
 * Export an arbitrary screen-space rectangle from the current stage.
 * Returns true on success, false when stage or rect is invalid.
 */
export function exportStageRect(rect: ScreenRect, filename: string): boolean {
  const stage = getStage();
  if (!stage) {
    alert('画布尚未就绪，无法导出。');
    return false;
  }
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  try {
    const dataUrl = stage.toDataURL({
      x: rect.x,
      y: rect.y,
      width,
      height,
      pixelRatio: 2,
      mimeType: 'image/png',
    });
    downloadDataUrl(dataUrl, filename);
    return true;
  } catch (e) {
    console.error('exportStageRect failed', e);
    alert('导出失败，可能因素材跨域被浏览器禁止导出。');
    return false;
  }
}

/** Export the currently visible stage viewport. */
export function exportVisible(): boolean {
  const stage = getStage();
  if (!stage) {
    alert('画布尚未就绪。');
    return false;
  }
  return exportStageRect(
    { x: 0, y: 0, width: stage.width(), height: stage.height() },
    timestampFilename('canvas-visible'),
  );
}

/**
 * Export the AABB of currently selected elements, padded by `paddingCanvas`
 * canvas units. Alerts and no-ops when the selection is empty.
 */
export function exportSelection(paddingCanvas: number = 24): boolean {
  const { elements, selectedIds, stageConfig } = useCanvasStore.getState();
  if (selectedIds.length === 0) {
    alert('请先选中要导出的节点。');
    return false;
  }
  const sel = elements.filter(e => selectedIds.includes(e.id));
  if (sel.length === 0) {
    alert('未找到选中节点。');
    return false;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of sel) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  minX -= paddingCanvas;
  minY -= paddingCanvas;
  maxX += paddingCanvas;
  maxY += paddingCanvas;

  const screenRect: ScreenRect = {
    x: stageConfig.x + minX * stageConfig.scale,
    y: stageConfig.y + minY * stageConfig.scale,
    width: (maxX - minX) * stageConfig.scale,
    height: (maxY - minY) * stageConfig.scale,
  };

  return exportStageRect(screenRect, timestampFilename('canvas-selection'));
}

/**
 * Export an arbitrary rect given in canvas units (used by the marquee tool).
 */
export function exportCanvasRect(canvasRect: { x: number; y: number; w: number; h: number }): boolean {
  const { stageConfig } = useCanvasStore.getState();
  const screenRect: ScreenRect = {
    x: stageConfig.x + canvasRect.x * stageConfig.scale,
    y: stageConfig.y + canvasRect.y * stageConfig.scale,
    width: canvasRect.w * stageConfig.scale,
    height: canvasRect.h * stageConfig.scale,
  };
  return exportStageRect(screenRect, timestampFilename('canvas-region'));
}
