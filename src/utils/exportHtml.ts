// src/utils/exportHtml.ts
import { useCanvasStore } from '../store/useCanvasStore';
import type { CanvasElement, Connection, ShapeElement, TextElement, ImageElement, StickyElement } from '../types/canvas';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text);
}

async function toDataUrl(src: string): Promise<string> {
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
        try { resolve(canvas.toDataURL('image/png')); }
        catch { resolve(src); }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  } catch {
    return src;
  }
}

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1);
  const cp = Math.max(40, dx * 0.45);
  return `M ${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`;
}

function connectionPath(conn: Connection, elements: CanvasElement[]): string {
  const fromEl = elements.find(e => e.id === conn.fromId);
  const toEl = elements.find(e => e.id === conn.toId);
  if (!fromEl || !toEl) return '';
  const fx = fromEl.x + fromEl.width;
  const fy = fromEl.y + fromEl.height / 2;
  const tx = toEl.x;
  const ty = toEl.y + toEl.height / 2;
  return bezierPath(fx, fy, tx, ty);
}

function renderNodeCard(el: CanvasElement): string {
  const id = escapeHtml(el.id);
  const w = el.width;
  const h = el.height;
  const bg = '#FFFFFF';
  const border = '1px solid var(--line-1,#e5e7eb)';

  switch (el.type) {
    case 'rectangle': {
      const s = el as ShapeElement;
      const style = `background:${s.fill};border-radius:${s.cornerRadius ?? 0}px;border:${s.stroke ? `${s.strokeWidth ?? 1}px solid ${s.stroke}` : 'none'};width:${w}px;height:${h}px;`;
      return `<div class="node node-rect" style="position:absolute;left:${el.x}px;top:${el.y}px;${style}"></div>`;
    }
    case 'circle': {
      const s = el as ShapeElement;
      const rx = w / 2, ry = h / 2;
      const cx = el.x + rx, cy = el.y + ry;
      const style = `width:${w}px;height:${h}px;border-radius:50%;background:${s.fill};border:${s.stroke ? `${s.strokeWidth ?? 1}px solid ${s.stroke}` : 'none'};`;
      return `<div class="node node-circle" style="position:absolute;left:${el.x}px;top:${el.y}px;${style}"></div>`;
    }
    case 'image': {
      const imgEl = el as ImageElement;
      const safeSrc = escapeHtml(imgEl.src);
      return `<div class="node node-image" style="position:absolute;left:${el.x}px;top:${el.y}px;width:${w}px;height:${h}px;overflow:hidden;border-radius:8px;border:${border};background:#f9fafb;">
  <img src="${safeSrc}" alt="" style="width:100%;height:100%;object-fit:cover;"/>
</div>`;
    }
    case 'text': {
      const t = el as TextElement;
      const cjk = hasChinese(t.text);
      const fontFamily = cjk
        ? "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif"
        : `'${t.fontFamily}', sans-serif`;
      return `<div class="node node-text" style="position:absolute;left:${el.x}px;top:${el.y}px;min-width:${w}px;min-height:${h}px;font-size:${t.fontSize}px;color:${t.fill};font-family:${fontFamily};white-space:pre-wrap;word-break:break-word;">
  ${escapeHtml(t.text)}
</div>`;
    }
    case 'sticky': {
      const s = el as StickyElement;
      const cjk = hasChinese(s.text);
      const fontFamily = cjk
        ? "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif"
        : "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
      return `<div class="node node-sticky" style="position:absolute;left:${el.x}px;top:${el.y}px;width:${w}px;min-height:${h}px;background:${s.fill};border-radius:6px;padding:12px;font-family:${fontFamily};font-size:14px;color:#1a1a1a;white-space:pre-wrap;word-break:break-word;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
  ${escapeHtml(s.text)}
</div>`;
    }
    default:
      return `<div class="node node-generic" style="position:absolute;left:${el.x}px;top:${el.y}px;width:${w}px;height:${h}px;background:#f9fafb;border:${border};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#9ca3af;">
  ${escapeHtml(el.type)}
</div>`;
  }
}

export async function exportAsStandaloneHtml(): Promise<boolean> {
  const { elements: allElements, connections, selectedIds } = useCanvasStore.getState();

  const elements = selectedIds.length > 0
    ? allElements.filter(e => selectedIds.includes(e.id))
    : allElements;

  if (elements.length === 0) {
    alert('没有可导出的节点。');
    return false;
  }

  const selectedSet = new Set(selectedIds);
  const relConns = connections.filter(
    c => selectedIds.length === 0 || (selectedSet.has(c.fromId) && selectedSet.has(c.toId)),
  );

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  const pad = 40;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const canvasW = maxX - minX;
  const canvasH = maxY - minY;

  const nodeCards = elements.map(renderNodeCard).join('\n');

  const svgConns = relConns
    .map(c => {
      const d = connectionPath(c, elements);
      if (!d) return '';
      return `<path d="${d}" stroke="#6b7280" stroke-width="2" fill="none" opacity="0.6"/>`;
    })
    .filter(Boolean)
    .join('\n');

  const nodesBase64 = new Map<string, string>();
  const imageEls = elements.filter((e): e is ImageElement => e.type === 'image');
  await Promise.all(
    imageEls.map(async (el) => {
      nodesBase64.set(el.src, await toDataUrl(el.src));
    }),
  );

  const resolvedCards = elements
    .map((el) => {
      if (el.type !== 'image') return null;
      const dataUrl = nodesBase64.get(el.src) ?? el.src;
      const safeSrc = escapeHtml(dataUrl);
      const w = el.width, h = el.height;
      return `<div class="node node-image" style="position:absolute;left:${el.x}px;top:${el.y}px;width:${w}px;height:${h}px;overflow:hidden;border-radius:8px;border:1px solid #e5e7eb;background:#f9fafb;">
  <img src="${safeSrc}" alt="" style="width:100%;height:100%;object-fit:cover;"/>
</div>`;
    })
    .filter(Boolean)
    .join('\n');

  const nodeCardsNoImg = elements.filter(e => e.type !== 'image').map(renderNodeCard).join('\n');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Canvas Export — AI 画布 Pro</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC&amp;display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #F5EFE4;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', sans-serif;
      padding: 40px;
    }
    .canvas-outer {
      background: #FFFFFF;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      padding: 24px;
      margin-bottom: 24px;
    }
    .canvas-header { margin-bottom: 16px; }
    .canvas-header h1 { font-size: 20px; font-weight: 600; color: #333; font-family: Georgia, serif; }
    .canvas-header p { font-size: 12px; color: #9ca3af; margin-top: 4px; }
    .canvas-container {
      position: relative;
      width: ${canvasW}px;
      height: ${canvasH}px;
      background: #F5EFE4;
      border-radius: 12px;
      overflow: hidden;
    }
    .node { pointer-events: none; }
    .connections-svg {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      overflow: visible;
    }
  </style>
</head>
<body>
  <div class="canvas-outer">
    <div class="canvas-header">
      <h1>AI 画布 Pro</h1>
      <p>导出时间：${new Date().toLocaleString('zh-CN')} · ${elements.length} 个节点 · ${relConns.length} 条连线</p>
    </div>
    <div class="canvas-container">
      ${svgConns ? `<svg class="connections-svg" viewBox="0 0 ${canvasW} ${canvasH}" preserveAspectRatio="none">${svgConns}</svg>` : ''}
      ${nodeCardsNoImg}
      ${resolvedCards}
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `canvas-export-${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
