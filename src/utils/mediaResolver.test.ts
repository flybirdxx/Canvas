import { describe, expect, it } from 'vitest';
import type { CanvasElement, Connection } from '@/types/canvas';
import { resolveUpstreamVideoSource } from './mediaResolver';

const target = { id: 'omni-1', type: 'omniscript', x: 0, y: 0, width: 320, height: 240 } as CanvasElement;

function connect(fromId: string): Connection {
  return {
    id: `${fromId}-to-omni`,
    fromId,
    fromPortId: 'out',
    toId: target.id,
    toPortId: 'in',
  };
}

describe('resolveUpstreamVideoSource', () => {
  it('resolves an upstream video node http source', () => {
    const video = {
      id: 'video-1',
      type: 'video',
      x: 0,
      y: 0,
      width: 320,
      height: 180,
      src: 'https://example.com/video.mp4',
    } as CanvasElement;

    expect(resolveUpstreamVideoSource(target.id, [video, target], [connect(video.id)])).toEqual({
      label: 'video',
      url: 'https://example.com/video.mp4',
      dataUrl: undefined,
    });
  });

  it('resolves an upstream video file node blob reference', () => {
    const file = {
      id: 'file-1',
      type: 'file',
      x: 0,
      y: 0,
      width: 240,
      height: 120,
      name: 'cover.mp4',
      mimeType: 'video/mp4',
      src: 'blob:local-video',
      blobKey: 'blob-key-1',
    } as CanvasElement;

    expect(resolveUpstreamVideoSource(target.id, [file, target], [connect(file.id)])).toEqual({
      label: 'cover.mp4',
      url: undefined,
      dataUrl: undefined,
      fileRef: 'blob-key-1',
    });
  });

  it('ignores non-video file nodes', () => {
    const file = {
      id: 'file-1',
      type: 'file',
      x: 0,
      y: 0,
      width: 240,
      height: 120,
      name: 'notes.txt',
      mimeType: 'text/plain',
      src: 'blob:notes',
    } as CanvasElement;

    expect(resolveUpstreamVideoSource(target.id, [file, target], [connect(file.id)])).toBeNull();
  });
});
