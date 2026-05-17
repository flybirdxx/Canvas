import type { CanvasElement, DataType, Port } from '@/types/canvas';

export interface PortLayoutEntry {
  port: Port;
  index: number;
  isInput: boolean;
  localX: number;
  localY: number;
  canvasX: number;
  canvasY: number;
}

export interface PortLayout {
  inputs: PortLayoutEntry[];
  outputs: PortLayoutEntry[];
}

export function getPortLayout(element: CanvasElement): PortLayout {
  return {
    inputs: layoutPorts(element, element.inputs ?? [], true),
    outputs: layoutPorts(element, element.outputs ?? [], false),
  };
}

export function findPortLayoutHit(args: {
  element: CanvasElement;
  x: number;
  y: number;
  isDrawingFromOutput: boolean;
  fromPortType: string;
  threshold?: number;
}): { port: Port; isInput: boolean } | null {
  const threshold = args.threshold ?? 20;
  const layout = getPortLayout(args.element);
  const candidates = args.isDrawingFromOutput ? layout.inputs : layout.outputs;

  for (const entry of candidates) {
    if (Math.hypot(entry.canvasX - args.x, entry.canvasY - args.y) < threshold) {
      return { port: entry.port, isInput: entry.isInput };
    }
  }

  if (!isInsideElement(args.element, args.x, args.y)) return null;
  const compatible = candidates.find(entry => isCompatiblePort(entry.port.type, args.fromPortType));
  return compatible ? { port: compatible.port, isInput: compatible.isInput } : null;
}

function layoutPorts(element: CanvasElement, ports: Port[], isInput: boolean): PortLayoutEntry[] {
  const spacing = element.height / (ports.length + 1);
  return ports.map((port, index) => {
    const localX = isInput ? 0 : element.width;
    const localY = spacing * (index + 1);
    return {
      port,
      index,
      isInput,
      localX,
      localY,
      canvasX: element.x + localX,
      canvasY: element.y + localY,
    };
  });
}

function isCompatiblePort(portType: DataType, fromPortType: string): boolean {
  return portType === 'any' || fromPortType === 'any' || portType === fromPortType;
}

function isInsideElement(element: CanvasElement, x: number, y: number): boolean {
  return x >= element.x &&
    x <= element.x + element.width &&
    y >= element.y &&
    y <= element.y + element.height;
}
