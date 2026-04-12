import { useEffect } from "react";

/**
 * Hook to handle click/touch outside a ref element
 * Works on both desktop (mouse) and mobile (touch) devices
 * @param ref - The ref to check if click is outside
 * @param callback - Function to call when click/touch is detected outside
 * @param isActive - Whether the handler should be active (helps avoid unnecessary listeners)
 */
export function useClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  callback: () => void,
  isActive: boolean = true
): void {
  useEffect(() => {
    if (!isActive) return;

    function handleClickOrTouchOutside(e: PointerEvent | MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    }

    // Use pointerdown instead of mousedown - handles both mouse and touch events
    // This works reliably on both desktop and mobile devices
    document.addEventListener("pointerdown", handleClickOrTouchOutside as EventListener);
    return () => {
      document.removeEventListener("pointerdown", handleClickOrTouchOutside as EventListener);
    };
  }, [ref, callback, isActive]);
}
