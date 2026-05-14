import { useCallback, useEffect, useRef } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { syncAllScripts } from '@/services/storyboardSync';

export function useStoryboardSync(isDraggingOrResizingRef: React.MutableRefObject<boolean>) {
  const { elements, addElement, deleteElements, updateElement } = useCanvasStore();
  
  const dragOrResizeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSyncAfterDragRef = useRef<(() => void) | null>(null);

  // CR-5: skip diff when elements reference hasn't changed (no-op re-renders)
  const prevElementsRef = useRef<typeof elements>(elements);

  const applyDiff = useCallback(() => {
    const diff = syncAllScripts(elements);
    if (diff.idsToDelete.length > 0) {
      deleteElements(diff.idsToDelete);
    }
    for (const scene of diff.scenesToAdd) {
      addElement(scene);
    }
    // CR-3: update existing scene content when script changed
    for (const update of diff.scenesToUpdate) {
      updateElement(update.id, {
        sourceSceneNum: update.sourceSceneNum,
        title: update.title,
        content: update.content,
        lines: update.lines,
      });
    }
  }, [elements, deleteElements, addElement, updateElement]);

  useEffect(() => {
    // CR-5: skip when elements haven't changed — avoids full diff on unrelated state changes
    if (prevElementsRef.current === elements) return;
    prevElementsRef.current = elements;

    if (isDraggingOrResizingRef.current) {
      flushSyncAfterDragRef.current = applyDiff;
      return;
    }
    applyDiff();
  }, [elements, applyDiff, isDraggingOrResizingRef]);

  const flushSync = () => {
    if (flushSyncAfterDragRef.current) {
      const fn = flushSyncAfterDragRef.current;
      flushSyncAfterDragRef.current = null;
      if (dragOrResizeDebounceRef.current !== null) {
        clearTimeout(dragOrResizeDebounceRef.current);
        dragOrResizeDebounceRef.current = null;
      }
      dragOrResizeDebounceRef.current = setTimeout(() => {
        fn();
        dragOrResizeDebounceRef.current = null;
      }, 100);
    }
  };

  return { flushSync };
}
