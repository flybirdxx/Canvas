import { useEffect, useRef } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { syncAllScripts } from '../../services/storyboardSync';

export function useStoryboardSync(isDraggingOrResizingRef: React.MutableRefObject<boolean>) {
  const { elements, addElement, deleteElements } = useCanvasStore();
  
  const dragOrResizeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSyncAfterDragRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (isDraggingOrResizingRef.current) {
      flushSyncAfterDragRef.current = () => {
        const diff = syncAllScripts(elements);
        if (diff.idsToDelete.length > 0) {
          deleteElements(diff.idsToDelete);
        }
        for (const scene of diff.scenesToAdd) {
          addElement(scene);
        }
      };
      return;
    }

    const diff = syncAllScripts(elements);
    if (diff.idsToDelete.length > 0) {
      deleteElements(diff.idsToDelete);
    }
    for (const scene of diff.scenesToAdd) {
      addElement(scene);
    }
  }, [elements, deleteElements, addElement, isDraggingOrResizingRef]);

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
