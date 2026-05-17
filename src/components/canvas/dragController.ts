import type { CanvasElement } from '@/types/canvas';
import type { GroupFrame } from '@/utils/groupFrame';
import { clampElementPositionInGroupFrame } from '@/utils/groupFrame';

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface NodeDragBoundInput {
  element: CanvasElement;
  proposed: CanvasPoint;
  origin?: CanvasPoint;
  drawingConnection: boolean;
  groupFrame?: GroupFrame | null;
  computeSnap?: (
    id: string,
    proposedX: number,
    proposedY: number,
    originX: number,
    originY: number,
    width: number,
    height: number,
  ) => CanvasPoint;
}

export interface DragCoordinateAdapter {
  toCanvas: (point: CanvasPoint) => CanvasPoint;
  toAbsolute: (point: CanvasPoint) => CanvasPoint;
}

export function resolveNodeDragBound(input: NodeDragBoundInput): CanvasPoint {
  const { element, proposed, origin, drawingConnection, groupFrame, computeSnap } = input;
  if (drawingConnection) return { x: element.x, y: element.y };

  let next = proposed;
  if (computeSnap && origin) {
    next = computeSnap(
      element.id,
      proposed.x,
      proposed.y,
      origin.x,
      origin.y,
      element.width,
      element.height,
    );
  }

  if (groupFrame) {
    return clampElementPositionInGroupFrame(element, groupFrame, next.x, next.y);
  }

  return next;
}

export function resolveNodeDragBoundAbsolute(
  input: Omit<NodeDragBoundInput, 'proposed'> & {
    proposedAbsolute: CanvasPoint;
    coordinates: DragCoordinateAdapter;
  },
): CanvasPoint {
  const proposedCanvas = input.coordinates.toCanvas(input.proposedAbsolute);
  const boundedCanvas = resolveNodeDragBound({
    element: input.element,
    proposed: proposedCanvas,
    origin: input.origin,
    drawingConnection: input.drawingConnection,
    groupFrame: input.groupFrame,
    computeSnap: input.computeSnap,
  });
  return input.coordinates.toAbsolute(boundedCanvas);
}

export function getNodeDragDelta(element: CanvasElement, visualPosition: CanvasPoint): CanvasPoint {
  return {
    x: visualPosition.x - element.x,
    y: visualPosition.y - element.y,
  };
}

export function resolveNodeVisualPosition(input: {
  element: CanvasElement;
  visualPosition: CanvasPoint;
  groupFrame?: GroupFrame | null;
}): CanvasPoint {
  if (!input.groupFrame) return input.visualPosition;
  return clampElementPositionInGroupFrame(
    input.element,
    input.groupFrame,
    input.visualPosition.x,
    input.visualPosition.y,
  );
}

export function getFrameDragDelta(startFrame: GroupFrame, visualPosition: CanvasPoint): CanvasPoint {
  return {
    x: visualPosition.x - startFrame.x,
    y: visualPosition.y - startFrame.y,
  };
}

export function getGroupChildDragOffsets(
  childIds: string[],
  elements: CanvasElement[],
  delta: CanvasPoint,
) {
  return childIds
    .filter(childId => elements.some(element => element.id === childId))
    .map(id => ({ id, dx: delta.x, dy: delta.y }));
}
