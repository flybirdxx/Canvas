import type { CanvasElement, Connection, FileElement, MediaElement } from '@/types/canvas';

export interface ResolvedVideoSource {
  label: string;
  url?: string;
  dataUrl?: string;
  fileRef?: string;
}

export function resolveUpstreamVideoSource(
  nodeId: string,
  elements: CanvasElement[],
  connections: Connection[],
): ResolvedVideoSource | null {
  const upstreamIds = connections.filter(conn => conn.toId === nodeId).map(conn => conn.fromId);

  for (const id of upstreamIds) {
    const element = elements.find(item => item.id === id);
    if (!element) continue;

    if (element.type === 'video') {
      const media = element as MediaElement;
      return {
        label: 'video',
        url: /^https?:\/\//i.test(media.src) ? media.src : undefined,
        dataUrl: media.src.startsWith('data:') ? media.src : undefined,
      };
    }

    if (element.type === 'file') {
      const file = element as FileElement;
      if (!file.mimeType.toLowerCase().startsWith('video/')) continue;
      return {
        label: file.name,
        url: /^https?:\/\//i.test(file.src) ? file.src : undefined,
        dataUrl: file.src.startsWith('data:') ? file.src : undefined,
        fileRef: file.blobKey,
      };
    }
  }

  return null;
}
