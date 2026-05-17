import { describe, expect, it, vi } from 'vitest';
import {
  clearDragOffset,
  clearGroupDragOffsets,
  getDragOffset,
  getDragOffsetsSnapshot,
  setDragOffset,
  setGroupDragOffsets,
  subscribeDragOffsets,
} from './dragOffsets';

describe('dragOffsets', () => {
  it('notifies subscribers when single-node drag offsets change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDragOffsets(listener);

    setDragOffset('node-1', 12, 8);

    expect(getDragOffset('node-1')).toEqual({ dx: 12, dy: 8 });
    expect(getDragOffsetsSnapshot()).toBeGreaterThan(0);
    expect(listener).toHaveBeenCalledTimes(1);

    clearDragOffset('node-1');
    expect(getDragOffset('node-1')).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('notifies subscribers when group drag offsets change and clear', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDragOffsets(listener);

    setGroupDragOffsets([
      { id: 'node-1', dx: 20, dy: 10 },
      { id: 'node-2', dx: 20, dy: 10 },
    ]);

    expect(getDragOffset('node-1')).toEqual({ dx: 20, dy: 10 });
    expect(getDragOffset('node-2')).toEqual({ dx: 20, dy: 10 });
    expect(listener).toHaveBeenCalledTimes(1);

    clearGroupDragOffsets(['node-1', 'node-2']);
    expect(getDragOffset('node-1')).toBeUndefined();
    expect(getDragOffset('node-2')).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
