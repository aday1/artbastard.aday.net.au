import { useCallback, useEffect, useRef } from 'react';

const BODY_DRAG_CLASS = 'ab-fader-dragging';

export function useRangeTouchGuard(disabled = false) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const draggingRef = useRef(false);

  const endDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.classList.remove(BODY_DRAG_CLASS);
  }, []);

  const startDrag = useCallback(() => {
    if (disabled) return;
    draggingRef.current = true;
    document.body.classList.add(BODY_DRAG_CLASS);
  }, [disabled]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || disabled) return;

    const onTouchMove = (e: TouchEvent) => {
      if (draggingRef.current) {
        e.preventDefault();
      }
    };

    input.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    window.addEventListener('touchend', endDrag);
    window.addEventListener('touchcancel', endDrag);

    return () => {
      input.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      window.removeEventListener('touchend', endDrag);
      window.removeEventListener('touchcancel', endDrag);
      endDrag();
    };
  }, [disabled, endDrag]);

  return {
    inputRef,
    onPointerDown: startDrag,
    onTouchStart: startDrag,
    onPointerUp: endDrag,
    onTouchEnd: endDrag,
  };
}
