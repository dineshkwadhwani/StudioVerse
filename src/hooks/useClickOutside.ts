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

    // Some mobile browsers can be inconsistent with pointer events.
    // Register fallback touch/mouse listeners so tapping outside always closes menus.
    document.addEventListener("pointerdown", handleClickOrTouchOutside as EventListener);
    document.addEventListener("touchstart", handleClickOrTouchOutside as EventListener, {
      passive: true,
    });
    document.addEventListener("mousedown", handleClickOrTouchOutside as EventListener);

    return () => {
      document.removeEventListener("pointerdown", handleClickOrTouchOutside as EventListener);
      document.removeEventListener("touchstart", handleClickOrTouchOutside as EventListener);
      document.removeEventListener("mousedown", handleClickOrTouchOutside as EventListener);
    };
  }, [ref, callback, isActive]);
}
