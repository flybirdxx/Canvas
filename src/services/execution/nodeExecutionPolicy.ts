import type { CanvasElement } from '@/types/canvas';
import { getNodeDefinition } from '@/registry/nodeRegistry';

export type NodeExecutionKind =
  | 'blockedDraft'
  | 'nonGenerative'
  | 'existingOutput'
  | 'imageGeneration'
  | 'mediaGeneration';

export function getNodeExecutionKind(element: CanvasElement): NodeExecutionKind {
  if (element.planningDraft?.status === 'pendingReview') return 'blockedDraft';
  if (hasExistingOutput(element)) return 'existingOutput';

  if (element.type === 'aigenerating') return 'imageGeneration';

  const mode = getNodeDefinition(element.type).execution;
  if (mode === 'none') return 'nonGenerative';
  if (mode === 'video' || mode === 'audio') return 'mediaGeneration';
  return 'imageGeneration';
}

function hasExistingOutput(element: CanvasElement): boolean {
  return (element.type === 'image' || element.type === 'video' || element.type === 'audio') && !!element.src;
}
