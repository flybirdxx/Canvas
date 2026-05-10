import type { CanvasElement, Connection } from '@/types/canvas';
import { composeScenePrompt } from '@/services/scenePromptComposer';

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
 * Merge all child scene texts from a script element, sorted by sceneNum.
 */
function getScriptText(script: any, elements: CanvasElement[]): string {
  const childScenes = elements
    .filter((e): e is any => e.type === 'scene' && e.scriptId === script.id)
    .sort((a, b) => (a.sceneNum ?? 0) - (b.sceneNum ?? 0));
  const parts: string[] = [];
  for (const scene of childScenes) {
    const sceneText = composeScenePrompt(scene);
    if (sceneText) parts.push(sceneText);
  }
  return parts.join('\n\n');
}

/**
 * Pull the textual content a given element carries for downstream consumers.
 * Rules:
 *  - text / sticky node → its `text` field
 *  - image / video / audio / generating node → its user-authored `prompt`
 *  - scene → its structured lines composed into a prompt
 *  - script → aggregated text of all child scenes (sorted by sceneNum)
 *  - shapes → empty (no semantic content)
 *
 * Returning `''` (rather than `undefined`) keeps callers simple — an empty
 * contribution is dropped silently.
 */
function getOutgoingText(el: CanvasElement, elements: CanvasElement[]): string {
  switch (el.type) {
    case 'text':
    case 'sticky':
      return ((el as any).text ?? '').trim();
    case 'image':
    case 'video':
    case 'audio':
    case 'aigenerating':
      return ((el as any).prompt ?? '').trim();
    // E7 Story 4: scene as a text source — compose its structured lines into a prompt
    case 'scene':
      return composeScenePrompt(el as any);
    // E7 Epic 6: script as aggregated text source — merge all child scene prompts
    case 'script':
      return getScriptText(el as any, elements);
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
    const content = getOutgoingText(src, elements);
    if (!content) continue;

    const firstLine = content.split(/\r?\n/).find(l => l.trim().length > 0) ?? content;
    const typeLabel =
      src.type === 'text' ? '文本'
      : src.type === 'sticky' ? '便签'
      : src.type === 'scene' ? '分镜'
      : src.type === 'script' ? '剧本'
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

  // 按源元素在画布上的位置排序（从上到下、从左到右），使拼接顺序可预测：
  // 用户可以通过调整源节点的画布位置来控制最终 prompt 中内容的先后。
  out.sort((a, b) => {
    const sa = elementsById.get(a.sourceId);
    const sb = elementsById.get(b.sourceId);
    if (!sa || !sb) return 0;
    const dy = sa.y - sb.y;
    if (Math.abs(dy) > 4) return dy;
    return sa.x - sb.x;
  });

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
 * whose target port type is `'image'` or `'any'` and whose source is one of:
 *   - `image` 节点（AI 生成结果或 ToolDock "Image" 占位节点）
 *   - `file` 节点且 MIME 为 image/\*（用户上传/拖入的图片附件）
 * 两条路径产出同构的 `{ src, label }`，下游 gateway / NodeInputBar 不用关心
 * 这是生成图还是上传图。Results preserve connection order so callers that
 * only need "the first one" get deterministic behavior.
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
    if (!src) continue;

    let url: string | undefined;
    let label: string;
    if (src.type === 'image') {
      url = (src as any).src;
      const promptPreview = ((src as any).prompt ?? '').trim().slice(0, 20);
      label = promptPreview
        ? `图像 · ${promptPreview}${promptPreview.length >= 20 ? '…' : ''}`
        : '图像';
    } else if (src.type === 'file') {
      const mt = String((src as any).mimeType || '').toLowerCase();
      if (!mt.startsWith('image/')) continue; // 非图文件不是图源
      url = (src as any).src;
      const name = String((src as any).name || '').trim();
      const preview = name.length > 20 ? `${name.slice(0, 20)}…` : name;
      label = preview ? `图像 · ${preview}` : '图像';
    // E7 Story 4: scene as an image source — follow its linkedImageId
    } else if (src.type === 'scene') {
      const linkedId = (src as any).linkedImageId;
      if (!linkedId) continue;
      const linked = elementsById.get(linkedId) as any;
      if (!linked || !linked.src) continue;
      url = linked.src;
      label = `分镜${(src as any).sceneNum} · ${(src as any).title || '未命名'}`;
    } else {
      continue;
    }

    if (!url) continue;
    out.push({ connectionId: c.id, sourceId: src.id, src: url, label });
  }

  // 同样按源元素画布位置排序，与文本贡献顺序保持一致。
  out.sort((a, b) => {
    const sa = elementsById.get(a.sourceId);
    const sb = elementsById.get(b.sourceId);
    if (!sa || !sb) return 0;
    const dy = sa.y - sb.y;
    if (Math.abs(dy) > 4) return dy;
    return sa.x - sb.x;
  });

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
