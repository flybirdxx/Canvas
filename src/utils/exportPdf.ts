// src/utils/exportPdf.ts
import { jsPDF } from 'jspdf';
import { getStage } from './stageRegistry';
import { useCanvasStore } from '@/store/useCanvasStore';

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text);
}

function collectText(elements: ReturnType<typeof useCanvasStore.getState>['elements']): string {
  return elements
    .map(el => {
      if (el.type === 'text') return (el as any).text ?? '';
      if (el.type === 'sticky') return (el as any).text ?? '';
      if (el.type === 'script') return (el as any).markdown ?? '';
      if (el.type === 'scene') return ((el as any).title ?? '') + ' ' + ((el as any).content ?? '');
      return '';
    })
    .join(' ');
}

type PageSize = 'a4' | 'a3' | 'letter' | 'viewport';

const PAGE_FORMATS: Record<Exclude<PageSize, 'viewport'>, { w: number; h: number }> = {
  a4: { w: 595.28, h: 841.89 },
  a3: { w: 841.89, h: 1190.55 },
  letter: { w: 612, h: 792 },
};

function buildPdfImage(stage: any, x: number, y: number, w: number, h: number): string {
  try {
    return stage.toDataURL({ x, y, width: w, height: h, pixelRatio: 2, mimeType: 'image/png' });
  } catch (e) {
    console.error('PDF rasterize failed', e);
    throw new Error('导出失败：素材可能存在跨域限制，请尝试导出为 SVG 格式。');
  }
}

export async function exportViewportAsPdf(): Promise<boolean> {
  const stage = getStage();
  if (!stage) {
    alert('画布尚未就绪');
    return false;
  }

  try {
    const W = stage.width();
    const H = stage.height();
    const dataUrl = buildPdfImage(stage, 0, 0, W, H);

    const pdf = new jsPDF({
      orientation: W > H ? 'landscape' : 'portrait',
      unit: 'px',
      format: [W, H],
    });

    pdf.addImage(dataUrl, 'PNG', 0, 0, W, H);
    pdf.save(`canvas-viewport-${Date.now()}.pdf`);
    return true;
  } catch (e: any) {
    alert(e.message ?? '导出 PDF 失败');
    return false;
  }
}

export async function exportSelectionAsPdf(): Promise<boolean> {
  return exportAsCustomPdf('a4');
}

export async function exportAsCustomPdf(size: PageSize = 'a4'): Promise<boolean> {
  const stage = getStage();
  const { elements: allElements, selectedIds, stageConfig } = useCanvasStore.getState();

  if (!stage) {
    alert('画布尚未就绪');
    return false;
  }

  try {
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
    const pad = 24;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const contentW = maxX - minX;
    const contentH = maxY - minY;

    let pageW: number, pageH: number;
    let orientation: 'portrait' | 'landscape' = 'portrait';

    if (size === 'viewport') {
      pageW = contentW;
      pageH = contentH;
    } else {
      const fmt = PAGE_FORMATS[size];
      pageW = fmt.w;
      pageH = fmt.h;
      orientation = contentW > contentH ? 'landscape' : 'portrait';
      if (orientation === 'landscape') [pageW, pageH] = [pageH, pageW];
    }

    const margin = 20;
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;
    const scale = Math.min(availW / contentW, availH / contentH, 1);
    const drawW = contentW * scale;
    const drawH = contentH * scale;
    const offsetX = margin + (availW - drawW) / 2;
    const offsetY = margin + (availH - drawH) / 2;

    const screenX = stageConfig.x + minX * stageConfig.scale;
    const screenY = stageConfig.y + minY * stageConfig.scale;
    const screenW = contentW * stageConfig.scale;
    const screenH = contentH * stageConfig.scale;

    const dataUrl = buildPdfImage(stage, screenX, screenY, screenW, screenH);

    const pdf = new jsPDF({ orientation, unit: 'pt', format: [pageW, pageH] });

    const allText = collectText(elements);
    if (hasChinese(allText)) {
      try {
        await embedChineseFont(pdf);
      } catch {
        // non-critical — text in rasterized canvas is unaffected
      }
    }

    pdf.addImage(dataUrl, 'PNG', offsetX, offsetY, drawW, drawH);
    pdf.save(`canvas-${size}-${Date.now()}.pdf`);
    return true;
  } catch (e: any) {
    alert(e.message ?? '导出 PDF 失败');
    return false;
  }
}

const CHINESE_FONT_CSS = `
@font-face {
  font-family: 'NotoSansCJKsc';
  src: url('https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf') format('opentype');
}
`;

async function embedChineseFont(pdf: jsPDF): Promise<void> {
  const fontUrl = 'https://cdn.jsdelivr.net/npm/jspdf-font-noto-cjk@1.0.0/NotoSansCJKsc-Regular.ttf';

  let fontData: ArrayBuffer;
  try {
    const response = await fetch(fontUrl, { mode: 'cors' });
    if (!response.ok) {
      const altUrl = 'https://fonts.gstatic.com/standalone/s/noto+sans+sc/v13/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu0-K4.woff2';
      const altResponse = await fetch(altUrl, { mode: 'cors' });
      if (!altResponse.ok) return;
      const buf = await altResponse.arrayBuffer();
      fontData = buf;
    } else {
      fontData = await response.arrayBuffer();
    }
  } catch {
    return;
  }

  const binary = String.fromCharCode(...new Uint8Array(fontData));
  const base64 = btoa(binary);
  pdf.addFileToVFS('NotoSansCJKsc-Regular.ttf', base64);
  pdf.addFont('NotoSansCJKsc-Regular.ttf', 'NotoSansCJKsc', 'Normal');
  pdf.setFont('NotoSansCJKsc');
}
