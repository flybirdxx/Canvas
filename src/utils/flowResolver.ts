import type { CanvasElement, Connection } from '@/types/canvas';
import { formatPlanningText } from './planningText';

export interface UpstreamTextContribution {
  connectionId: string;
  sourceId: string;
  label: string;
  content: string;
}

function getOutgoingText(el: CanvasElement): string {
  switch (el.type) {
    case 'text':
    case 'sticky':
      return el.text.trim();
    case 'image':
    case 'video':
    case 'audio':
    case 'aigenerating':
      return (el.prompt ?? '').trim();
    case 'omniscript':
      return [
        ...(el.result?.segments ?? []).map(item => item.summary),
        ...(el.result?.structuredScript ?? []).map(item => item.copy),
        ...(el.result?.highlights ?? []).map(item => item.reason),
      ].filter(Boolean).join('\n');
    case 'planning':
      return formatPlanningText(el);
    default:
      return '';
  }
}

export function getUpstreamTextContributions(
  targetId: string,
  elements: CanvasElement[],
  connections: Connection[],
): UpstreamTextContribution[] {
  const target = elements.find(e => e.id === targetId);
  if (!target) return [];

  const elementsById = new Map(elements.map(e => [e.id, e]));
  const out: UpstreamTextContribution[] = [];

  for (const c of connections) {
    if (c.toId !== targetId) continue;
    const toPort = target.inputs?.find(p => p.id === c.toPortId);
    if (!toPort || (toPort.type !== 'text' && toPort.type !== 'any')) continue;

    const src = elementsById.get(c.fromId);
    if (!src) continue;
    const content = getOutgoingText(src);
    if (!content) continue;

    const firstLine = content.split(/\r?\n/).find(l => l.trim().length > 0) ?? content;
    out.push({
      connectionId: c.id,
      sourceId: src.id,
      label: `${textTypeLabel(src.type)}：${firstLine.trim().slice(0, 16)}${firstLine.length > 16 ? '...' : ''}`,
      content,
    });
  }

  return sortByCanvasPosition(out, elementsById);
}

export interface UpstreamImageContribution {
  connectionId: string;
  sourceId: string;
  src: string;
  label: string;
}

export function getUpstreamImageContributions(
  targetId: string,
  elements: CanvasElement[],
  connections: Connection[],
): UpstreamImageContribution[] {
  const target = elements.find(e => e.id === targetId);
  if (!target) return [];

  const elementsById = new Map(elements.map(e => [e.id, e]));
  const out: UpstreamImageContribution[] = [];

  for (const c of connections) {
    if (c.toId !== targetId) continue;
    const toPort = target.inputs?.find(p => p.id === c.toPortId);
    if (!toPort || (toPort.type !== 'image' && toPort.type !== 'any')) continue;

    const src = elementsById.get(c.fromId);
    if (!src) continue;

    if (src.type === 'image' && src.src) {
      out.push({ connectionId: c.id, sourceId: src.id, src: src.src, label: '图像' });
    } else if (src.type === 'file' && src.mimeType.toLowerCase().startsWith('image/') && src.src) {
      out.push({ connectionId: c.id, sourceId: src.id, src: src.src, label: src.name || '图像文件' });
    }
  }

  return sortByCanvasPosition(out, elementsById);
}

export function composeEffectivePrompt(
  localPrompt: string,
  upstream: UpstreamTextContribution[],
): string {
  return [...upstream.map(u => u.content.trim()), localPrompt.trim()]
    .filter(Boolean)
    .join('\n\n');
}

function sortByCanvasPosition<T extends { sourceId: string }>(
  items: T[],
  elementsById: Map<string, CanvasElement>,
): T[] {
  return items.sort((a, b) => {
    const sa = elementsById.get(a.sourceId);
    const sb = elementsById.get(b.sourceId);
    if (!sa || !sb) return 0;
    const dy = sa.y - sb.y;
    return Math.abs(dy) > 4 ? dy : sa.x - sb.x;
  });
}

function textTypeLabel(type: CanvasElement['type']): string {
  if (type === 'sticky') return '便签';
  if (type === 'image') return '图像提示';
  if (type === 'video') return '视频提示';
  if (type === 'audio') return '音频提示';
  if (type === 'omniscript') return 'OmniScript';
  if (type === 'planning') return '企划';
  return '文本';
}
