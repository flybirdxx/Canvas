import type { CanvasElement, Connection } from '../types/canvas';

/**
 * A single upstream contribution feeding into a target node via a connection.
 * Used by the NodeInputBar to render a read-only preview chip row above the
 * textarea and to compose the effective prompt sent to the API.
 */
export interface UpstreamTextContribution {
  /** The connection id — use this to remove the link (`deleteConnections`). */
  connectionId: string;
  /** Element id of the upstream source. */
  sourceId: string;
  /** Display label, e.g. "文本节点 · 开头几个字…" */
  label: string;
  /** Full text content being contributed downstream. */
  content: string;
}

/**
 * Pull the textual content a given element carries for downstream consumers.
 * Rules:
 *  - text / sticky node → its `text` field
 *  - image / video / audio / generating node → its user-authored `prompt`
 *  - shapes → empty (no semantic content)
 *
 * Returning `''` (rather than `undefined`) keeps callers simple — an empty
 * contribution is dropped silently.
 */
function getOutgoingText(el: CanvasElement): string {
  switch (el.type) {
    case 'text':
    case 'sticky':
      return ((el as any).text ?? '').trim();
    case 'image':
    case 'video':
    case 'audio':
    case 'aigenerating':
      return ((el as any).prompt ?? '').trim();
    default:
      return '';
  }
}

/**
 * Compute the list of incoming connections that should contribute prompt text
 * to `targetId`. We walk all connections whose `toId === targetId` AND whose
 * target port is of type 'text' / 'any', then resolve the upstream source's
 * outgoing text. Empty contributions are filtered.
 */
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
    if (!toPort) continue;
    // Accept text-carrying ports: prompt inputs are 'text', catch-all 'any'.
    if (toPort.type !== 'text' && toPort.type !== 'any') continue;

    const src = elementsById.get(c.fromId);
    if (!src) continue;
    const content = getOutgoingText(src);
    if (!content) continue;

    const firstLine = content.split(/\r?\n/).find(l => l.trim().length > 0) ?? content;
    const typeLabel =
      src.type === 'text' ? '文本'
      : src.type === 'sticky' ? '便签'
      : src.type === 'image' ? '图像提示'
      : src.type === 'video' ? '视频提示'
      : src.type === 'audio' ? '音频提示'
      : src.type;
    const preview = firstLine.trim().slice(0, 16);

    out.push({
      connectionId: c.id,
      sourceId: src.id,
      label: `${typeLabel}：${preview}${firstLine.length > 16 ? '…' : ''}`,
      content,
    });
  }

  return out;
}

/**
 * A single upstream image feeding into a target via a connection. Used by
 * the NodeInputBar (video mode) to auto-populate `seedImage` for image→video
 * generation, and to render a small thumbnail chip showing where the seed
 * frame came from.
 */
export interface UpstreamImageContribution {
  connectionId: string;
  sourceId: string;
  /** Image data URL or hosted URL from the source element. */
  src: string;
  /** Display label for the chip tooltip, e.g. "图像节点 · prompt 前缀…" */
  label: string;
}

/**
 * Compute incoming image connections for `targetId`. Accepts connections
 * whose target port type is `'image'` or `'any'` and whose source is an
 * `image` node with a non-empty `src`. Results preserve connection order so
 * callers that only need "the first one" get deterministic behavior.
 */
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
    if (!toPort) continue;
    if (toPort.type !== 'image' && toPort.type !== 'any') continue;

    const src = elementsById.get(c.fromId);
    if (!src || src.type !== 'image') continue;
    const url = (src as any).src as string | undefined;
    if (!url) continue;

    const promptPreview = ((src as any).prompt ?? '').trim().slice(0, 20);
    const label = promptPreview
      ? `图像 · ${promptPreview}${promptPreview.length >= 20 ? '…' : ''}`
      : '图像';

    out.push({
      connectionId: c.id,
      sourceId: src.id,
      src: url,
      label,
    });
  }

  return out;
}

/**
 * Compose the effective prompt for generation. Upstream contributions come
 * first (so they act as "context"/"base"), then the node's own local prompt.
 * Sections are separated by blank lines for readability; providers parse the
 * whole thing as a single prompt string.
 */
export function composeEffectivePrompt(
  localPrompt: string,
  upstream: UpstreamTextContribution[],
): string {
  const parts: string[] = [];
  for (const u of upstream) {
    if (u.content.trim()) parts.push(u.content.trim());
  }
  if (localPrompt.trim()) parts.push(localPrompt.trim());
  return parts.join('\n\n');
}
