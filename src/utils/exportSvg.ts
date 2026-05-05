import { getStage } from './stageRegistry';
import { useCanvasStore } from '../store/useCanvasStore';
import type { CanvasElement, Connection, ShapeElement, TextElement, ImageElement, StickyElement } from '../types/canvas';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text);
}

function toDataUrl(imgSrc: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(imgSrc); return; }
      ctx.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(imgSrc);
      }
    };
    img.onerror = () => resolve(imgSrc);
    img.src = imgSrc;
  });
}

function bezierPath(
  x1: number, y1: number, x2: number, y2: number,
  fromPortX: number, fromPortY: number,
  toPortX: number, toPortY: number,
): string {
  const dx = Math.abs(x2 - x1);
  const cp = Math.max(40, dx * 0.45);
  return `M ${fromPortX} ${fromPortY} C ${fromPortX + cp} ${fromPortY}, ${toPortX - cp} ${toPortY}, ${toPortX} ${toPortY}`;
}

function connectionPath(conn: Connection, elements: CanvasElement[]): string {
  const fromEl = elements.find(e => e.id === conn.fromId);
  const toEl = elements.find(e => e.id === conn.toId);
  if (!fromEl || !toEl) return '';

  const fromPort = fromEl.outputs?.find(p => p.id === conn.fromPortId);
  const toPort = toEl.inputs?.find(p => p.id === conn.toPortId);

  const fx = fromEl.x + fromEl.width;
  const fy = fromEl.y + fromEl.height / 2;
  const tx = toEl.x;
  const ty = toEl.y + toEl.height / 2;

  return bezierPath(fromEl.x, fromEl.y, toEl.x, toEl.y, fx, fy, tx, ty);
}

async function renderImageToDataUrl(src: string): Promise<string> {
  if (src.startsWith('data:')) return src;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    return new Promise((resolve) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(src); return; }
        ctx.drawImage(img, 0, 0);
        try {
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(src);
        }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  } catch {
    return src;
  }
}

function renderElementSvg(el: CanvasElement, imageDataUrls: Map<string, string>): string {
  switch (el.type) {
    case 'rectangle': {
      const s = el as ShapeElement;
      const rx = s.cornerRadius ?? 0;
      const strokeAttr = s.stroke ? ` stroke="${s.stroke}" stroke-width="${s.strokeWidth ?? 1}"` : '';
      if (rx > 0) {
        return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${rx}" ry="${rx}" fill="${s.fill}"${strokeAttr}/>`;
      }
      return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${s.fill}"${strokeAttr}/>`;
    }
    case 'circle': {
      const s = el as ShapeElement;
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const rx = el.width / 2;
      const ry = el.height / 2;
      const strokeAttr = s.stroke ? ` stroke="${s.stroke}" stroke-width="${s.strokeWidth ?? 1}"` : '';
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${s.fill}"${strokeAttr}/>`;
    }
    case 'image': {
      const imgEl = el as ImageElement;
      const dataUrl = imageDataUrls.get(imgEl.src) ?? imgEl.src;
      const safeUrl = escapeXml(dataUrl);
      return `<image href="${safeUrl}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" preserveAspectRatio="xMidYMid slice"/>`;
    }
    case 'text': {
      const t = el as TextElement;
      const cjk = hasChinese(t.text);
      const fontFamily = cjk
        ? "font-family=\"'Noto Sans SC', 'Source Han Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif\""
        : `font-family="'${t.fontFamily}', sans-serif"`;
      return `<text x="${el.x}" y="${el.y + t.fontSize}" font-size="${t.fontSize}" fill="${t.fill}"${fontFamily}>${escapeXml(t.text)}</text>`;
    }
    case 'sticky': {
      const s = el as StickyElement;
      const cjk = hasChinese(s.text);
      const fontFamily = cjk
        ? "font-family=\"'Noto Sans SC', 'Source Han Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif\""
        : "font-family=\"'Noto Sans SC', 'Source Han Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif\"";
      return `<text x="${el.x + 8}" y="${el.y + 24}" font-size="14" fill="#1a1a1a"${fontFamily}>${escapeXml(s.text)}</text>`;
    }
    default:
      return '';
  }
}

export async function exportSelectionAsSvg(): Promise<boolean> {
  const stage = getStage();
  const store = useCanvasStore.getState();
  const { elements: allElements, connections, selectedIds } = store;

  if (!stage) {
    alert('画布尚未就绪，无法导出。');
    return false;
  }

  const elements = selectedIds.length > 0
    ? allElements.filter(e => selectedIds.includes(e.id))
    : allElements;

  if (elements.length === 0) {
    alert('没有可导出的节点。');
    return false;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  const pad = 20;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const W = maxX - minX;
  const H = maxY - minY;

  const selectedSet = new Set(selectedIds);
  const relevantConns = connections.filter(
    c => selectedSet.has(c.fromId) && selectedSet.has(c.toId),
  );

  const imageSrcs = elements
    .filter((e): e is ImageElement => e.type === 'image')
    .map(e => e.src)
    .filter(src => !src.startsWith('data:'));

  const imageDataUrls = new Map<string, string>();
  await Promise.all(
    imageSrcs.map(async (src) => {
      imageDataUrls.set(src, await renderImageToDataUrl(src));
    }),
  );

  const connPaths = relevantConns
    .map(c => {
      const d = connectionPath(c, elements);
      if (!d) return '';
      return `<path d="${d}" stroke="var(--ink-2,#374151)" stroke-width="2" fill="none"/>`;
    })
    .filter(Boolean);

  const elSvg = elements.map(el => renderElementSvg(el, imageDataUrls)).filter(Boolean);

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${W}" height="${H}" viewBox="${minX} ${minY} ${W} ${H}">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC&amp;display=swap');
  </style>
  ${connPaths.join('\n  ')}
  ${elSvg.join('\n  ')}
</svg>`;

  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `canvas-${Date.now()}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
