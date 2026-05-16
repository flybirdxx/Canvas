import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGlobalShortcuts } from './useGlobalShortcuts';
import { useCanvasStore } from '@/store/useCanvasStore';

describe('useGlobalShortcuts planning node', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      elements: [],
      selectedIds: [],
      activeTool: 'select',
      stageConfig: { x: 0, y: 0, scale: 1 },
    } as Partial<ReturnType<typeof useCanvasStore.getState>>);
  });

  it('creates a project seed planning node with P', () => {
    renderHook(() => useGlobalShortcuts());

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));

    const [node] = useCanvasStore.getState().elements;
    expect(node.type).toBe('planning');
    if (node.type !== 'planning') throw new Error('expected planning node');
    expect(node.kind).toBe('projectSeed');
    expect(node.title).toBe('项目种子');
    expect(node.body).toContain('一句想法：');
    expect(useCanvasStore.getState().selectedIds).toEqual([node.id]);
  });
});
