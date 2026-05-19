import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ResizableDockPanel.module.scss';

export interface ResizableDockPanelProps {
  children: React.ReactNode;
  className?: string;
  scrollClassName?: string;
  storageKey: string;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  defaultHeight?: number | null;
  minHeight?: number;
  maxHeight?: number;
  resizeRight?: boolean;
  resizeBottom?: boolean;
  resizeLeft?: boolean;
  widthCssVar?: string;
  ariaLabel?: string;
}

function readPrefs(
  storageKey: string,
  defaultWidth: number,
  minWidth: number,
  maxWidth: number,
  defaultHeight: number | null
): { width: number; height: number | null } {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { width: defaultWidth, height: defaultHeight };
    const parsed = JSON.parse(raw) as { width?: number; height?: number | null };
    return {
      width: Math.min(maxWidth, Math.max(minWidth, parsed.width ?? defaultWidth)),
      height: parsed.height ?? defaultHeight,
    };
  } catch {
    return { width: defaultWidth, height: defaultHeight };
  }
}

export const ResizableDockPanel: React.FC<ResizableDockPanelProps> = ({
  children,
  className = '',
  scrollClassName = '',
  storageKey,
  defaultWidth,
  minWidth = 160,
  maxWidth = 520,
  defaultHeight = null,
  minHeight = 120,
  maxHeight = 900,
  resizeRight = true,
  resizeBottom = false,
  resizeLeft = false,
  widthCssVar,
  ariaLabel = 'Resizable panel',
}) => {
  const [prefs, setPrefs] = useState(() =>
    readPrefs(storageKey, defaultWidth, minWidth, maxWidth, defaultHeight)
  );
  const dockRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: 'width' | 'height';
    sign: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
    if (widthCssVar) {
      document.documentElement.style.setProperty(widthCssVar, `${prefs.width}px`);
    }
  }, [prefs, storageKey, widthCssVar]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.mode === 'width') {
        const dx = (e.clientX - drag.startX) * drag.sign;
        const next = Math.min(maxWidth, Math.max(minWidth, drag.startW + dx));
        setPrefs((p) => ({ ...p, width: next }));
      } else {
        const dy = (e.clientY - drag.startY) * drag.sign;
        const next = Math.min(maxHeight, Math.max(minHeight, drag.startH + dy));
        setPrefs((p) => ({ ...p, height: next }));
      }
    },
    [maxWidth, minWidth, maxHeight, minHeight]
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [onPointerMove]);

  const startDrag = (
    mode: 'width' | 'height',
    sign: number,
    e: React.PointerEvent
  ) => {
    const el = dockRef.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      mode,
      sign,
      startX: e.clientX,
      startY: e.clientY,
      startW: rect.width,
      startH: rect.height,
    };
    document.body.style.cursor = mode === 'width' ? 'ew-resize' : 'ns-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
  };

  const scrollClasses = ['ab-seamless-scroll', styles.scroll, scrollClassName]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={dockRef}
      className={[styles.panel, className].filter(Boolean).join(' ')}
      style={{
        width: prefs.width,
        ...(prefs.height != null ? { height: prefs.height } : {}),
      }}
      role="region"
      aria-label={ariaLabel}
    >
      {resizeBottom && (
        <div
          className={styles.gripTop}
          onPointerDown={(e) => startDrag('height', 1, e)}
          title="Drag to resize height"
          aria-hidden
        />
      )}
      {resizeLeft && (
        <div
          className={styles.gripLeft}
          onPointerDown={(e) => startDrag('width', 1, e)}
          title="Drag to resize width"
          aria-hidden
        />
      )}
      <div className={scrollClasses}>{children}</div>
      {resizeRight && (
        <div
          className={styles.gripRight}
          onPointerDown={(e) => startDrag('width', -1, e)}
          title="Drag to resize width"
          aria-hidden
        />
      )}
    </div>
  );
};
