export type ElementType = 'rectangle' | 'circle' | 'text' | 'image' | 'sticky' | 'video' | 'audio' | 'aigenerating';

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  isLocked?: boolean;
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

export type CanvasElement = ShapeElement | TextElement | ImageElement | StickyElement | MediaElement | AIGeneratingElement;
