// src/utils/exportPdf.ts
import { jsPDF } from 'jspdf';
import { getStage } from './stageRegistry';

export async function exportViewportAsPdf(): Promise<boolean> {
  const stage = getStage();
  if (!stage) {
    alert('画布尚未就绪');
    return false;
  }

  const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });

  const pdf = new jsPDF({
    orientation: stage.width() > stage.height() ? 'landscape' : 'portrait',
    unit: 'px',
    format: [stage.width(), stage.height()],
  });

  pdf.addImage(dataUrl, 'PNG', 0, 0, stage.width(), stage.height());
  pdf.save(`canvas-${Date.now()}.pdf`);
  return true;
}

export async function exportSelectionAsPdf(): Promise<boolean> {
  const stage = getStage();
  if (!stage) {
    alert('画布尚未就绪');
    return false;
  }

  const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const imgWidth = pageWidth - margin * 2;
  const ratio = stage.width() / imgWidth;
  const imgHeight = stage.height() / ratio;

  pdf.addImage(dataUrl, 'PNG', margin, margin, imgWidth, Math.min(imgHeight, pageHeight - margin * 2));
  pdf.save(`canvas-${Date.now()}.pdf`);
  return true;
}
