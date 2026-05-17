import { v4 as uuidv4 } from 'uuid';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import type { CanvasElement, Connection } from '@/types/canvas';
import type { QuickAddMenuState } from '@/hooks/canvas/useCanvasConnections';
import type { DrawingConnection } from '@/store/types';

interface PointerControllerArgs {
  activeTool: string;
  isSpacePressed: boolean;
  isPanningRef: React.MutableRefObject<boolean>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  stageConfig: { x: number; y: number; scale: number };
  elements: CanvasElement[];
  drawingConnection: DrawingConnection | null;
  selectionBox: unknown;
  marquee: { active: boolean; drawing: boolean };
  setQuickAddMenu: (menu: QuickAddMenuState | null) => void;
  startPan: (clientX: number, clientY: number) => void;
  updatePan: (stage: Konva.Stage, clientX: number, clientY: number) => void;
  endPan: () => boolean;
  startSelectionBox: (x: number, y: number) => void;
  updateSelectionBox: (x: number, y: number) => void;
  endSelectionBox: () => boolean;
  clearSelectionBox: () => void;
  startMarquee: (x: number, y: number) => void;
  updateMarquee: (x: number, y: number) => void;
  endMarquee: () => boolean;
  setDrawingConnection: (connection: DrawingConnection | null) => void;
  findPortUnderMouse: (
    elements: CanvasElement[],
    x: number,
    y: number,
    isDrawingFromOutput: boolean,
    fromPortType: string,
  ) => { element: CanvasElement; port: { id: string; type: string }; isInput: boolean } | null;
  addConnection: (connection: Connection) => void;
}

export function useCanvasPointerController(args: PointerControllerArgs) {
  const handlePointerDown = (e: KonvaEventObject<PointerEvent>) => {
    args.setQuickAddMenu(null);
    const point = getCanvasPoint(e);

    if (args.marquee.active && e.evt.button === 0) {
      if (!point) return;
      args.startMarquee(point.x, point.y);
      return;
    }
    if ((e.evt.button === 1 || (e.evt.button === 0 && args.isSpacePressed)) && !args.marquee.active) {
      e.evt.preventDefault();
      args.startPan(e.evt.clientX, e.evt.clientY);
      return;
    }
    if (args.activeTool === 'select' && e.target === e.target.getStage()) {
      if (!point) return;
      args.startSelectionBox(point.x, point.y);
    }
  };

  const handlePointerMove = (e: KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const point = getCanvasPoint(e);

    if (args.marquee.active && args.marquee.drawing) {
      if (!point) return;
      args.updateMarquee(point.x, point.y);
      return;
    }
    if (args.isPanningRef.current) {
      e.evt.preventDefault();
      args.updatePan(stage, e.evt.clientX, e.evt.clientY);
      return;
    }
    if (args.selectionBox) {
      if (!point) return;
      args.updateSelectionBox(point.x, point.y);
      return;
    }
    if (args.drawingConnection) {
      if (!point) return;
      if (args.drawingConnection.isDisconnecting) {
        args.setDrawingConnection({ ...args.drawingConnection, startX: point.x, startY: point.y });
      } else {
        args.setDrawingConnection({ ...args.drawingConnection, toX: point.x, toY: point.y });
      }
    }
  };

  const handlePointerUp = (e: KonvaEventObject<PointerEvent>) => {
    if (args.endMarquee()) return;
    if (args.endPan()) return;
    if (args.endSelectionBox()) return;
    if (!args.drawingConnection) return;

    const pointer = e.target.getStage()?.getPointerPosition();
    const point = getCanvasPoint(e);
    if (pointer && point) {
      completeDrawingConnection(args, args.drawingConnection, point, pointer);
    }
    args.setDrawingConnection(null);
  };

  const handleDblClick = (e: KonvaEventObject<MouseEvent>) => {
    if (e.target !== e.target.getStage()) return;
    args.clearSelectionBox();
    const pointer = e.target.getStage()?.getPointerPosition();
    if (!pointer) return;
    args.setQuickAddMenu({
      x: e.evt.clientX,
      y: e.evt.clientY,
      canvasX: (pointer.x - args.stageConfig.x) / args.stageConfig.scale,
      canvasY: (pointer.y - args.stageConfig.y) / args.stageConfig.scale,
    });
  };

  return { handlePointerDown, handlePointerMove, handlePointerUp, handleDblClick };
}

function completeDrawingConnection(
  args: PointerControllerArgs,
  drawingConnection: DrawingConnection,
  point: { x: number; y: number },
  pointer: { x: number; y: number },
): void {
  const target = args.findPortUnderMouse(
    args.elements,
    point.x,
    point.y,
    !drawingConnection.isDisconnecting,
    drawingConnection.fromPortType || 'any',
  );

  if (target && target.element.id !== drawingConnection.fromElementId) {
    const compatible =
      drawingConnection.fromPortType === 'any' ||
      target.port.type === 'any' ||
      drawingConnection.fromPortType === target.port.type;
    if (compatible) {
      args.addConnection({
        id: uuidv4(),
        fromId: drawingConnection.isDisconnecting ? target.element.id : drawingConnection.fromElementId!,
        fromPortId: drawingConnection.isDisconnecting ? target.port.id : drawingConnection.fromPortId!,
        toId: drawingConnection.isDisconnecting ? drawingConnection.fromElementId! : target.element.id,
        toPortId: drawingConnection.isDisconnecting ? drawingConnection.fromPortId! : target.port.id,
      });
    }
  } else if (!target && args.containerRef.current?.getBoundingClientRect()) {
    args.setQuickAddMenu({
      x: pointer.x,
      y: pointer.y,
      canvasX: point.x,
      canvasY: point.y,
      fromElementId: drawingConnection.fromElementId,
      fromPortId: drawingConnection.fromPortId,
      fromPortType: drawingConnection.fromPortType,
    });
  }
}

function getCanvasPoint(e: KonvaEventObject<PointerEvent | MouseEvent>): { x: number; y: number } | null {
  const stage = e.target.getStage();
  if (!stage) return null;
  const pointer = stage.getPointerPosition();
  if (!pointer) return null;
  const scale = stage.scaleX();
  return {
    x: (pointer.x - stage.x()) / scale,
    y: (pointer.y - stage.y()) / scale,
  };
}
