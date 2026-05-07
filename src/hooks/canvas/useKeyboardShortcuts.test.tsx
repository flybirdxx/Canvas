import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    // Clear all simulated keys
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should track Space, Alt, and Shift key states', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());
    
    expect(result.current.isSpacePressed).toBe(false);
    expect(result.current.isAltRef.current).toBe(false);
    expect(result.current.isShiftRef.current).toBe(false);

    // Simulate keydown Space
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    });
    expect(result.current.isSpacePressed).toBe(true);

    // Simulate keydown Alt
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }));
    });
    expect(result.current.isAltRef.current).toBe(true);

    // Simulate keydown Shift
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
    });
    expect(result.current.isShiftRef.current).toBe(true);

    // Simulate keyup
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    });
    expect(result.current.isSpacePressed).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt' }));
    });
    expect(result.current.isAltRef.current).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
    });
    expect(result.current.isShiftRef.current).toBe(false);
  });
});

