import { getStage } from './stageRegistry';

export function exportSelectionAsSvg(): boolean {
  const stage = getStage();
  if (!stage) {
    alert('画布尚未就绪，无法导出。');
    return false;
  }

  const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${stage.width()}" height="${stage.height()}" viewBox="0 0 ${stage.width()} ${stage.height()}">
  <image width="${stage.width()}" height="${stage.height()}" xlink:href="${dataUrl}"/>
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
