import { describe, expect, it } from 'vitest';
import type { CanvasElement } from '@/types/canvas';
import { getNodeExecutionKind } from './nodeExecutionPolicy';

function element(overrides: Partial<CanvasElement>): CanvasElement {
  return {
    id: 'node-1',
    type: 'text',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    text: '',
    fontSize: 14,
    fontFamily: 'serif',
    fill: '#000',
    ...overrides,
  } as CanvasElement;
}

describe('nodeExecutionPolicy', () => {
  it('blocks unreviewed planning draft nodes before generation', () => {
    expect(getNodeExecutionKind(element({
      type: 'image',
      src: '',
      planningDraft: {
        sourcePlanningId: 'plan-1',
        status: 'pendingReview',
      },
    }))).toBe('blockedDraft');
  });

  it('treats static and analysis nodes as non-generative', () => {
    for (const type of ['text', 'sticky', 'rectangle', 'circle', 'file', 'omniscript', 'planning'] as const) {
      expect(getNodeExecutionKind(element({
        type,
        ...(type === 'sticky' ? { text: '', fill: '#fff' } : {}),
        ...(type === 'file' ? {
          name: 'file.txt',
          mimeType: 'text/plain',
          sizeBytes: 1,
          src: '',
          persistence: 'data',
        } : {}),
        ...(type === 'omniscript' ? {
          title: 'OmniScript',
          analysisStatus: 'idle',
        } : {}),
        ...(type === 'planning' ? {
          kind: 'projectSeed',
          title: '项目种子',
          body: '',
        } : {}),
      }))).toBe('nonGenerative');
    }
  });

  it('treats media nodes with existing output as already satisfied', () => {
    expect(getNodeExecutionKind(element({ type: 'image', src: 'data:image/png;base64,x' }))).toBe('existingOutput');
    expect(getNodeExecutionKind(element({ type: 'video', src: 'https://cdn/video.mp4' }))).toBe('existingOutput');
    expect(getNodeExecutionKind(element({ type: 'audio', src: 'https://cdn/audio.mp3' }))).toBe('existingOutput');
  });

  it('routes empty image nodes to image generation and empty video/audio nodes to media generation', () => {
    expect(getNodeExecutionKind(element({ type: 'image', src: '' }))).toBe('imageGeneration');
    expect(getNodeExecutionKind(element({ type: 'video', src: '' }))).toBe('mediaGeneration');
    expect(getNodeExecutionKind(element({ type: 'audio', src: '' }))).toBe('mediaGeneration');
  });

  it('preserves aigenerating fallback behavior as image generation', () => {
    expect(getNodeExecutionKind(element({ type: 'aigenerating' }))).toBe('imageGeneration');
  });
});
