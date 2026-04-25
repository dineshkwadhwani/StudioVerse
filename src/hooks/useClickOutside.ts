import { useEffect, useRef } from "react";

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
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!isActive) return;

    function handleClickOrTouchOutside(e: PointerEvent | MouseEvent | TouchEvent) {
      const target = e.target;
      if (ref.current && target instanceof Node && !ref.current.contains(target)) {
        callbackRef.current();
      }
    }

    function handleEscapeKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        callbackRef.current();
      }
    }

    // Some mobile browsers can be inconsistent with pointer events.
    // Register fallback touch/mouse listeners so tapping outside always closes menus.
    // Use capture phase so outside clicks still close menus even when descendants stop propagation.
    document.addEventListener("pointerdown", handleClickOrTouchOutside as EventListener, true);
    document.addEventListener("touchstart", handleClickOrTouchOutside as EventListener, {
      capture: true,
      passive: true,
    });
    document.addEventListener("mousedown", handleClickOrTouchOutside as EventListener, true);
    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("pointerdown", handleClickOrTouchOutside as EventListener, true);
      document.removeEventListener("touchstart", handleClickOrTouchOutside as EventListener, true);
      document.removeEventListener("mousedown", handleClickOrTouchOutside as EventListener, true);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [ref, isActive]);
}
