import { describe, expect, it } from 'vitest';
import { resolveNodeResize, shouldLockNodeAspectRatio } from './resizeGeometry';

describe('resizeGeometry', () => {
  it('resizes freeform nodes with minimum dimensions', () => {
    expect(resolveNodeResize({
      start: { x: 10, y: 20, width: 100, height: 80 },
      delta: { x: -80, y: -60 },
      lockAspectRatio: false,
    })).toEqual({ x: 10, y: 20, width: 60, height: 40 });
  });

  it('locks image aspect ratio using the dominant drag axis', () => {
    expect(resolveNodeResize({
      start: { x: 0, y: 0, width: 200, height: 100 },
      delta: { x: 100, y: 10 },
      lockAspectRatio: true,
    })).toEqual({ x: 0, y: 0, width: 300, height: 150 });

    expect(resolveNodeResize({
      start: { x: 0, y: 0, width: 200, height: 100 },
      delta: { x: 10, y: 100 },
      lockAspectRatio: true,
    })).toEqual({ x: 0, y: 0, width: 400, height: 200 });
  });

  it('detects aspect-locked visual media nodes', () => {
    expect(shouldLockNodeAspectRatio({ type: 'image' })).toBe(true);
    expect(shouldLockNodeAspectRatio({ type: 'aigenerating' })).toBe(true);
    expect(shouldLockNodeAspectRatio({ type: 'file', mimeType: 'image/png' })).toBe(true);
    expect(shouldLockNodeAspectRatio({ type: 'file', mimeType: 'video/mp4', thumbnailDataUrl: 'data:image/png;base64,x' })).toBe(true);
    expect(shouldLockNodeAspectRatio({ type: 'file', mimeType: 'video/mp4' })).toBe(false);
    expect(shouldLockNodeAspectRatio({ type: 'text' })).toBe(false);
  });
});
