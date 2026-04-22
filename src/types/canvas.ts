export type ElementType = 'rectangle' | 'circle' | 'text' | 'image' | 'sticky' | 'video' | 'audio' | 'aigenerating';

export type DataType = 'any' | 'text' | 'image' | 'video' | 'audio';

export interface Port {
  id: string;
  type: DataType;
  label?: string;
}

export interface GenerationConfig {
  model?: string;
  aspect?: string;
  quality?: string;
  count?: string;
  duration?: string;
}

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  isLocked?: boolean;
  inputs?: Port[];
  outputs?: Port[];
  /** Prompt used to (re)generate this node. Applies to image/video/text nodes. */
  prompt?: string;
  /** Generation parameters such as model/aspect/quality/count. */
  generation?: GenerationConfig;
}

export interface ShapeElement extends BaseElement {
  type: 'rectangle' | 'circle';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  // If we are generating from AI, we might store prompt metadata
  prompt?: string;
}

export interface StickyElement extends BaseElement {
  type: 'sticky';
  text: string;
  fill: string;
}

export interface MediaElement extends BaseElement {
  type: 'video' | 'audio';
  src: string;
}

export interface AIGeneratingElement extends BaseElement {
  type: 'aigenerating';
}

export interface Connection {
  id: string;
  fromId: string;
  fromPortId: string;
  toId: string;
  toPortId: string;
}

export type CanvasElement = ShapeElement | TextElement | ImageElement | StickyElement | MediaElement | AIGeneratingElement;
