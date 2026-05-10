// Port defaults for element types - single source of truth 
  
import type { Port, ElementType } from '@/types/canvas'; 
  
export interface PortTemplate {  
  type: Port['type'];  
  label: string;  
} 
  
export const PORT_DEFAULTS: Record<ElementType, { inputs: PortTemplate[]; outputs: PortTemplate[] }> = { 
  image: {  
    inputs: [{ type: 'text', label: 'Prompt' }, { type: 'image', label: 'Ref' }],  
    outputs: [{ type: 'image', label: 'Image' }],  
  },  
  video: {  
    inputs: [{ type: 'image', label: 'Image' }],  
    outputs: [{ type: 'video', label: 'Video' }],  
  }, 
  audio: {  
    inputs: [{ type: 'text', label: 'Prompt' }],  
    outputs: [{ type: 'audio', label: 'Audio' }],  
  },  
  text: {  
    inputs: [],  
    outputs: [{ type: 'text', label: 'Text' }],  
  }, 
  rectangle: {  
    inputs: [{ type: 'any', label: 'In' }],  
    outputs: [{ type: 'any', label: 'Out' }],  
  },  
  circle: {  
    inputs: [{ type: 'any', label: 'In' }],  
    outputs: [{ type: 'any', label: 'Out' }],  
  },  
  sticky: {  
    inputs: [{ type: 'any', label: 'In' }],  
    outputs: [{ type: 'any', label: 'Out' }],  
  }, 
  aigenerating: {  
    inputs: [],  
    outputs: [],  
  },  
  file: {  
    inputs: [],  
    outputs: [],  
  },  
  script: {
    inputs: [],
    // E7 Epic 6: Script as "剧本容器" — single text output aggregating all child scenes' content.
    // When connected to an Image node's Prompt input, the merged content is used as effective prompt.
    outputs: [{ type: 'text', label: '剧本' }],
  },
  scene: {
    inputs: [{ type: 'text', label: 'Prompt' }],
    outputs: [{ type: 'image', label: 'Image' }, { type: 'text', label: 'Text' }],
  },
}; 
  
import { v4 as uuidv4 } from 'uuid'; 
  
/** Convert port templates to full Port objects with generated IDs. */  
export function makePorts(templates: PortTemplate[]): Port[] {  
  return templates.map(t => ({ id: uuidv4(), ...t }));  
} 
