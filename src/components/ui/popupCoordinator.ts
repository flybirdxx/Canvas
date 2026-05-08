import { useEffect, useRef } from 'react';

/**
 * Cross-popup coordinator — any popup (Dropdown / MoreMenu) that opens
 * broadcasts a claim event; all others receive it and close themselves
 * unless they are the claimant.

 * Extracted from NodeInputBar.tsx so it can be shared by Dropdown and
 * MoreMenu without code duplication.
 */
export const POPUP_CLAIM_EVENT = 'canvas:popup-claim';

export function claimPopup(id: number) {
  window.dispatchEvent(new CustomEvent(POPUP_CLAIM_EVENT, { detail: id }));
}

export function usePopupCoordinator(open: boolean, setOpen: (v: boolean) => void) {
  const idRef = useRef<number>(0);
  useEffect(() => {
    if (!open) return;
    idRef.current = Math.random();
    claimPopup(idRef.current);
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as number;
      if (detail !== idRef.current) setOpen(false);
    };
    window.addEventListener(POPUP_CLAIM_EVENT, handler);
    return () => window.removeEventListener(POPUP_CLAIM_EVENT, handler);
  }, [open, setOpen]);
}
