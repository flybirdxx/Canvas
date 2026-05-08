import { v4 as uuidv4 } from 'uuid';
import type { Connection } from '@/types/canvas';
import type { CanvasTemplate, TemplateElement, TemplateConnection } from '@/data/templates';
import { useCanvasStore } from '@/store/useCanvasStore';

/**
 * Convert the center of the current browser viewport into canvas-unit coords,
 * matching the pivot convention used by `instantiateTemplate`.
 */
function getViewportPivot(stageConfig: { scale: number; x: number; y: number }) {
  return {
    x: (window.innerWidth / 2 - stageConfig.x) / stageConfig.scale,
    y: (window.innerHeight / 2 - stageConfig.y) / stageConfig.scale,
  };
}

/**
 * Serialize the current canvas elements and connections into a CanvasTemplate.
 * Nodes are positioned relative to the viewport center so that instantiating
 * the template places it at the user's current viewport.
 */
export function canvasToTemplate(
  name: string,
  category: string,
  description: string,
): CanvasTemplate {
  const { elements, connections, stageConfig } = useCanvasStore.getState();
  const pivot = getViewportPivot(stageConfig);

  // Phase 1 — elements
  const localIdMap = new Map<string, string>();
  const templateElements: TemplateElement[] = elements.map(el => {
    const localId = uuidv4();
    localIdMap.set(el.id, localId);

    const tpl: TemplateElement = {
      localId,
      type: el.type,
      offsetX: el.x - pivot.x,
      offsetY: el.y - pivot.y,
      width: el.width,
      height: el.height,
    };

    // Copy type-specific payloads (only set non-default values to keep template compact)
    const anyEl = el as any;
    if (anyEl.text !== undefined) tpl.text = anyEl.text;
    if (anyEl.fontSize !== undefined) tpl.fontSize = anyEl.fontSize;
    if (anyEl.fontFamily !== undefined) tpl.fontFamily = anyEl.fontFamily;
    if (anyEl.fill !== undefined) tpl.fill = anyEl.fill;
    if (anyEl.align !== undefined) tpl.align = anyEl.align;
    if (anyEl.src !== undefined) tpl.src = anyEl.src;
    if (anyEl.prompt !== undefined) tpl.prompt = anyEl.prompt;
    if (anyEl.generation !== undefined) tpl.generation = anyEl.generation;

    return tpl;
  });

  // Phase 2 — connections: map element ids to local ids, resolve port indices
  const templateConnections: TemplateConnection[] = connections
    .map(conn => {
      const fromLocalId = localIdMap.get(conn.fromId);
      const toLocalId = localIdMap.get(conn.toId);
      if (!fromLocalId || !toLocalId) return null;

      // Resolve port index from port id
      const fromEl = elements.find(e => e.id === conn.fromId);
      const toEl = elements.find(e => e.id === conn.toId);
      if (!fromEl || !toEl) return null;

      const fromPortIndex = fromEl.outputs?.findIndex(p => p.id === conn.fromPortId) ?? 0;
      const toPortIndex = toEl.inputs?.findIndex(p => p.id === conn.toPortId) ?? 0;

      return {
        fromLocalId,
        toLocalId,
        fromPortIndex: fromPortIndex >= 0 ? fromPortIndex : 0,
        toPortIndex: toPortIndex >= 0 ? toPortIndex : 0,
      } as TemplateConnection;
    })
    .filter((c): c is TemplateConnection => c !== null);

  const id = uuidv4();
  return {
    id,
    name,
    category: category as CanvasTemplate['category'],
    description,
    elements: templateElements,
    connections: templateConnections.length > 0 ? templateConnections : undefined,
  };
}
