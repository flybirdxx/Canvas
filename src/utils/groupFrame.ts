import type { CanvasElement } from '@/types/canvas';
import type { GroupRecord } from '@/store/types';

export interface GroupFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const GROUP_FRAME_PADDING = 24;
export const GROUP_FRAME_MIN_WIDTH = 120;
export const GROUP_FRAME_MIN_HEIGHT = 90;

export function resolveGroupFrame(
  group: GroupRecord,
  elements: CanvasElement[],
  padding = GROUP_FRAME_PADDING,
): GroupFrame | null {
  if (group.frame) return group.frame;
  const children = elements.filter(element => group.childIds.includes(element.id));
  if (children.length < 2) return null;
  const minX = Math.min(...children.map(element => element.x));
  const minY = Math.min(...children.map(element => element.y));
  const maxX = Math.max(...children.map(element => element.x + element.width));
  const maxY = Math.max(...children.map(element => element.y + element.height));
  return {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(GROUP_FRAME_MIN_WIDTH, maxX - minX + padding * 2),
    height: Math.max(GROUP_FRAME_MIN_HEIGHT, maxY - minY + padding * 2),
  };
}

export function clampElementPositionInGroupFrame(
  element: CanvasElement,
  frame: GroupFrame,
  proposedX: number,
  proposedY: number,
) {
  const minX = frame.x;
  const minY = frame.y;
  const maxX = Math.max(minX, frame.x + frame.width - element.width);
  const maxY = Math.max(minY, frame.y + frame.height - element.height);
  return {
    x: clamp(proposedX, minX, maxX),
    y: clamp(proposedY, minY, maxY),
  };
}

export function expandFrameToIncludeElement(
  frame: GroupFrame,
  element: CanvasElement,
  padding = GROUP_FRAME_PADDING,
): GroupFrame {
  const minX = Math.min(frame.x, element.x - padding);
  const minY = Math.min(frame.y, element.y - padding);
  const maxX = Math.max(frame.x + frame.width, element.x + element.width + padding);
  const maxY = Math.max(frame.y + frame.height, element.y + element.height + padding);
  return {
    x: minX,
    y: minY,
    width: Math.max(GROUP_FRAME_MIN_WIDTH, maxX - minX),
    height: Math.max(GROUP_FRAME_MIN_HEIGHT, maxY - minY),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
