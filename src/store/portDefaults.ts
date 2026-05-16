import { v4 as uuidv4 } from 'uuid';
import type { ElementType, Port } from '@/types/canvas';

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
  omniscript: {
    inputs: [{ type: 'video', label: 'Video' }],
    outputs: [{ type: 'text', label: 'Report' }],
  },
  planning: {
    inputs: [{ type: 'any', label: 'Context' }],
    outputs: [{ type: 'text', label: 'Plan' }],
  },
};

export function makePorts(templates: PortTemplate[]): Port[] {
  return templates.map(t => ({ id: uuidv4(), ...t }));
}
