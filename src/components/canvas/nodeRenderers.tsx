import type React from 'react';
import type { CanvasElement } from '@/types/canvas';
import {
  ImageNode, TextNode, ShapeNode, StickyNode, MediaNode,
  AIGeneratingNode, FileNode, OmniScriptNode, PlanningNode,
} from './nodes';

type NodeRenderer = (element: CanvasElement, size: { width: number; height: number }) => React.JSX.Element | null;

const NODE_RENDERERS: Record<CanvasElement['type'], NodeRenderer> = {
  rectangle: (el) => el.type === 'rectangle' ? <ShapeNode el={el} /> : null,
  circle: (el) => el.type === 'circle' ? <ShapeNode el={el} /> : null,
  text: (el) => el.type === 'text' ? <TextNode el={el} /> : null,
  image: (el) => el.type === 'image' ? <ImageNode el={el} /> : null,
  sticky: (el) => el.type === 'sticky' ? <StickyNode el={el} /> : null,
  video: (el) => el.type === 'video' ? <MediaNode el={el} /> : null,
  audio: (el) => el.type === 'audio' ? <MediaNode el={el} /> : null,
  aigenerating: (el) => el.type === 'aigenerating' ? <AIGeneratingNode el={el} /> : null,
  file: (el) => el.type === 'file' ? <FileNode el={el} /> : null,
  omniscript: (el, size) => el.type === 'omniscript'
    ? <OmniScriptNode el={el} width={size.width} height={size.height} />
    : null,
  planning: (el) => el.type === 'planning' ? <PlanningNode el={el} /> : null,
};

export function renderNodeContent(
  element: CanvasElement,
  size: { width: number; height: number },
): React.JSX.Element | null {
  const renderer = NODE_RENDERERS[element.type as CanvasElement['type']];
  return renderer ? renderer(element, size) : null;
}
