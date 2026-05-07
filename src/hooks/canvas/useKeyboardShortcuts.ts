import { useEffect, useRef, useState } from 'react';

export function useKeyboardShortcuts() {
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const isAltRef = useRef(false);
  const isShiftRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
      if (e.key === 'Alt') isAltRef.current = true;
      if (e.key === 'Shift') isShiftRef.current = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
      if (e.key === 'Alt') isAltRef.current = false;
      if (e.key === 'Shift') isShiftRef.current = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return {
    isSpacePressed,
    isAltRef,
    isShiftRef,
  };
}
