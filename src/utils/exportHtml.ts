// src/utils/exportHtml.ts
import { useCanvasStore } from '../store/useCanvasStore';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function exportAsStandaloneHtml(): boolean {
  const { elements, connections } = useCanvasStore.getState();

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Canvas Export — AI 画布 Pro</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #F5EFE4;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 40px;
    }
    .canvas-grid {
      display: grid;
      gap: 24px;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    }
    .card {
      background: #FFFFFF;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      overflow: hidden;
    }
    .card img { width: 100%; border-radius: 8px; margin-bottom: 8px; }
    .card .type { font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 4px; }
    .card .text { font-size: 14px; color: #333; line-height: 1.5; white-space: pre-wrap; }
    .card .meta { font-size: 10px; color: #bbb; margin-top: 8px; }
    h1 { font-size: 20px; font-weight: 600; color: #333; margin-bottom: 8px; }
    p.subtitle { font-size: 12px; color: #999; margin-bottom: 24px; }
  </style>
</head>
<body>
  <h1>AI 画布 Pro · Exported Canvas</h1>
  <p class="subtitle">导出时间：${new Date().toLocaleString('zh-CN')} · ${elements.length} 个节点 · ${connections.length} 条连线</p>
  <div class="canvas-grid">
    ${elements.map(el => {
      const card = [];
      card.push('<div class="card">');
      card.push('<div class="type">' + escapeHtml(el.type) + '</div>');
      const imgSrc = (el as any).src;
      if (el.type === 'image' && imgSrc) {
        card.push('<img src="' + imgSrc + '" alt="" />');
      }
      const textContent = (el as any).text;
      if (el.type === 'text' && textContent) {
        card.push('<div class="text">' + escapeHtml(textContent) + '</div>');
      }
      if (el.type === 'sticky' && textContent) {
        card.push('<div class="text">' + escapeHtml(textContent) + '</div>');
      }
      card.push('<div class="meta">ID: ' + el.id.slice(0, 8) + ' · ' + el.width + '×' + el.height + '</div>');
      card.push('</div>');
      return card.join('\n');
    }).join('\n')}
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
