import { useEffect, useRef } from 'react';

/** Sets --fader-length on the host from its pixel height (for rotate(-90deg) range inputs). */
export function useVerticalFaderLength<T extends HTMLElement>() {
  const hostRef = useRef<T>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const sync = () => {
      const h = el.clientHeight;
      if (h > 0) {
        el.style.setProperty('--fader-length', `${h}px`);
      }
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return hostRef;
}
