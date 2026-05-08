import type { CanvasElement, ImageElement, MediaElement, TextElement, StickyElement, ShapeElement, AIGeneratingElement, FileElement, ScriptElement, SceneElement } from './canvas'; 
export function isImageElement(el: CanvasElement): el is ImageElement { 
  return el.type === 'image'; 
}  
export function isVideoElement(el: CanvasElement): el is MediaElement {  
  return el.type === 'video';  
}  
export function isAudioElement(el: CanvasElement): el is MediaElement {  
  return el.type === 'audio';  
}  
export function isMediaElement(el: CanvasElement): el is MediaElement {  
  return el.type === 'video' || el.type === 'audio';  
} 
export function isTextElement(el: CanvasElement): el is TextElement {  
  return el.type === 'text';  
}  
export function isStickyElement(el: CanvasElement): el is StickyElement {  
  return el.type === 'sticky';  
}  
export function isShapeElement(el: CanvasElement): el is ShapeElement {  
  return el.type === 'rectangle' || el.type === 'circle';  
}  
export function isAIGeneratingElement(el: CanvasElement): el is AIGeneratingElement {  
  return el.type === 'aigenerating';  
} 
export function isFileElement(el: CanvasElement): el is FileElement {  
  return el.type === 'file';  
}  
export function isScriptElement(el: CanvasElement): el is ScriptElement {  
  return el.type === 'script';  
}  
export function isSceneElement(el: CanvasElement): el is SceneElement {  
  return el.type === 'scene';  
} 
