import type { OmniScriptResult } from '@/services/omniscript';

export type ElementType =
  | 'rectangle'
  | 'circle'
  | 'text'
  | 'image'
  | 'sticky'
  | 'video'
  | 'audio'
  | 'aigenerating'
  | 'file'
  | 'omniscript'
  | 'planning';

export type DataType = 'any' | 'text' | 'image' | 'video' | 'audio';

export interface Port {
  id: string;
  type: DataType;
  label?: string;
}

export interface AppliedPreset {
  id: string;
  snippet: string;
}

export interface GenerationConfig {
  model?: string;
  aspect?: string;
  quality?: string;
  qualityLevel?: string;
  count?: string;
  duration?: string;
  appliedPresets?: AppliedPreset[];
  references?: string[];
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
  prompt?: string;
  generation?: GenerationConfig;
  note?: string;
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

export interface NodeVersion {
  id: string;
  src: string;
  prompt?: string;
  createdAt: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  prompt?: string;
  versions?: NodeVersion[];
  activeVersionIndex?: number;
}

export interface StickyElement extends BaseElement {
  type: 'sticky';
  text: string;
  fill: string;
}

export interface MediaElement extends BaseElement {
  type: 'video' | 'audio';
  src: string;
  versions?: NodeVersion[];
  activeVersionIndex?: number;
}

export type GenErrorKind = 'missingKey' | 'network' | 'server' | 'empty' | 'unknown';

export interface AIGenerationError {
  kind: GenErrorKind;
  message: string;
  detail?: string;
  request: {
    modality?: 'image' | 'video';
    model: string;
    prompt: string;
    size: string;
    n?: number;
    w?: number;
    h?: number;
    references?: string[];
    maskImage?: string;
    durationSec?: number;
    seedImage?: string;
  };
}

export interface PendingGenerationTask {
  providerId: string;
  taskId: string;
  submittedAt: number;
  request: {
    model: string;
    prompt: string;
    size: string;
    aspect?: string;
    resolution?: string;
    qualityLevel?: string;
    n?: number;
    w?: number;
    h?: number;
    references?: string[];
    maskImage?: string;
    execId?: string;
    durationSec?: number;
    seedImage?: string;
  };
}

export interface AIGeneratingElement extends BaseElement {
  type: 'aigenerating';
  error?: AIGenerationError;
  pendingTask?: PendingGenerationTask;
  inheritedVersions?: NodeVersion[];
  inheritedPrompt?: string;
}

export interface FileElement extends BaseElement {
  type: 'file';
  name: string;
  mimeType: string;
  sizeBytes: number;
  src: string;
  persistence: 'data' | 'blob';
  blobKey?: string;
  thumbnailDataUrl?: string;
  durationMs?: number;
  pageCount?: number;
}

export interface OmniScriptElement extends BaseElement {
  type: 'omniscript';
  title: string;
  videoUrl?: string;
  videoDataUrl?: string;
  videoFileRef?: string;
  notes?: string;
  model?: string;
  analysisStatus: 'idle' | 'running' | 'success' | 'error';
  result?: OmniScriptResult;
  rawText?: string;
  error?: string;
}

export type PlanningNodeKind =
  | 'projectSeed'
  | 'storyBible'
  | 'characterPackage'
  | 'plot'
  | 'reference'
  | 'productionTask';

export type PlanningRequirementStatus = 'pending' | 'confirmed' | 'dismissed';
export type PlanningMaterialType = 'character' | 'scene' | 'prop' | 'image' | 'text' | 'video' | 'audio';
export type PropVisibility = 'full' | 'partial' | 'obscured' | 'markOnly';

export interface PlanningRequirement {
  id: string;
  title: string;
  materialType: PlanningMaterialType;
  description?: string;
  status: PlanningRequirementStatus;
  sourcePlotId?: string;
  necessity?: string;
}

export interface PlanningPropState {
  propId?: string;
  visibility: PropVisibility;
  note?: string;
  userConfirmed?: boolean;
}

export interface PlanningElement extends BaseElement {
  type: 'planning';
  kind: PlanningNodeKind;
  title: string;
  body: string;
  template?: 'shortDrama';
  requirements?: PlanningRequirement[];
  propStates?: PlanningPropState[];
  recommendedTaskType?: Extract<PlanningMaterialType, 'image' | 'text' | 'video' | 'audio'>;
  acceptanceCriteria?: string;
  sourcePlanningId?: string;
}

export interface Connection {
  id: string;
  fromId: string;
  fromPortId: string;
  toId: string;
  toPortId: string;
}

export type CanvasElement =
  | ShapeElement
  | TextElement
  | ImageElement
  | StickyElement
  | MediaElement
  | AIGeneratingElement
  | FileElement
  | OmniScriptElement
  | PlanningElement;

export function isImageWithContent(el: CanvasElement): el is ImageElement {
  return el.type === 'image' && !!el.src;
}

export function isMediaWithContent(el: CanvasElement): el is MediaElement {
  return (el.type === 'video' || el.type === 'audio') && !!el.src;
}
