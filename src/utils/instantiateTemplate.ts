import { v4 as uuidv4 } from 'uuid';
import type {
  CanvasTemplate,
  TemplateElement,
  TemplateConnection,
} from '../data/templates';
import type { CanvasElement, Connection } from '../types/canvas';
import { useCanvasStore } from '../store/useCanvasStore';

/**
 * Convert the center of the current browser viewport into canvas-unit coords,
 * accounting for the active stage translate + scale. This becomes the pivot
 * point that template offsets are added to.
 */
function getViewportCenterInCanvas(stageConfig: { scale: number; x: number; y: number }) {
  return {
    x: (window.innerWidth / 2 - stageConfig.x) / stageConfig.scale,
    y: (window.innerHeight / 2 - stageConfig.y) / stageConfig.scale,
  };
}

/**
 * Build a CanvasElement from a TemplateElement, translating to absolute coords.
 * `inputs`/`outputs` are deliberately left undefined so that addElement's
 * port-seeding path runs — this keeps port ids consistent with the rest of
 * the app and makes port-index lookups in the connection phase well-defined.
 */
function materializeElement(
  tpl: TemplateElement,
  pivot: { x: number; y: number },
): CanvasElement {
  const base: any = {
    id: uuidv4(),
    type: tpl.type,
    x: pivot.x + tpl.offsetX,
    y: pivot.y + tpl.offsetY,
    width: tpl.width,
    height: tpl.height,
  };

  switch (tpl.type) {
    case 'text':
      base.text = tpl.text ?? '';
      base.fontSize = tpl.fontSize ?? 16;
      base.fontFamily = tpl.fontFamily ?? 'Arial';
      base.fill = tpl.fill ?? '#111827';
      base.align = tpl.align ?? 'left';
      break;
    case 'image':
      base.src = tpl.src ?? '';
      if (tpl.prompt !== undefined) base.prompt = tpl.prompt;
      if (tpl.generation) base.generation = tpl.generation;
      break;
    case 'video':
    case 'audio':
      base.src = tpl.src ?? '';
      if (tpl.prompt !== undefined) base.prompt = tpl.prompt;
      if (tpl.generation) base.generation = tpl.generation;
      break;
    case 'sticky':
      base.text = tpl.text ?? '';
      base.fill = tpl.fill ?? '#fef3c7';
      break;
    case 'rectangle':
    case 'circle':
      base.fill = tpl.fill ?? '#e5e7eb';
      break;
    default:
      // other types not supported in templates yet — no-op
      break;
  }

  return base as CanvasElement;
}

/**
 * Spawn a whole template on the current canvas at viewport center.
 * Returns the list of newly-created element ids so the caller can select
 * them. Connections fail gracefully (skipped) when referenced ports are
 * missing rather than aborting the whole instantiation.
 */
export function instantiateTemplate(template: CanvasTemplate): string[] {
  const state = useCanvasStore.getState();
  const pivot = getViewportCenterInCanvas(state.stageConfig);

  // Phase 1 — create elements, remembering local → real id mapping.
  const idMap = new Map<string, string>();
  const newIds: string[] = [];
  for (const tpl of template.elements) {
    const el = materializeElement(tpl, pivot);
    idMap.set(tpl.localId, el.id);
    newIds.push(el.id);
    state.addElement(el);
  }

  // Phase 2 — resolve ports and wire connections. Each addElement seeds
  // inputs/outputs into the store, so we read them back here before linking.
  const conns: TemplateConnection[] = template.connections ?? [];
  if (conns.length > 0) {
    // Re-read state after element insertion — the reference may have changed.
    const updated = useCanvasStore.getState();
    const byId = new Map(updated.elements.map((e) => [e.id, e]));

    for (const c of conns) {
      const fromId = idMap.get(c.fromLocalId);
      const toId = idMap.get(c.toLocalId);
      if (!fromId || !toId) continue;

      const fromEl = byId.get(fromId);
      const toEl = byId.get(toId);
      if (!fromEl || !toEl) continue;

      const fromPort = fromEl.outputs?.[c.fromPortIndex ?? 0];
      const toPort = toEl.inputs?.[c.toPortIndex ?? 0];
      if (!fromPort || !toPort) continue;

      const connection: Connection = {
        id: uuidv4(),
        fromId,
        fromPortId: fromPort.id,
        toId,
        toPortId: toPort.id,
      };
      updated.addConnection(connection);
    }
  }

  // Select everything we just dropped so the user sees the bounding box.
  useCanvasStore.getState().setSelection(newIds);
  return newIds;
}
