import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ResizableFloatingPanel.module.scss';

export interface ResizableFloatingPanelProps {
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  storageKey: string;
  defaultWidth: number;
  defaultHeight: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  anchor?: 'bottom-left' | 'bottom-right';
  style?: React.CSSProperties;
}

function readSize(
  storageKey: string,
  defaultWidth: number,
  defaultHeight: number,
  minWidth: number,
  maxWidth: number,
  minHeight: number,
  maxHeight: number
) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { width: defaultWidth, height: defaultHeight };
    const p = JSON.parse(raw) as { width?: number; height?: number };
    return {
      width: Math.min(maxWidth, Math.max(minWidth, p.width ?? defaultWidth)),
      height: Math.min(maxHeight, Math.max(minHeight, p.height ?? defaultHeight)),
    };
  } catch {
    return { width: defaultWidth, height: defaultHeight };
  }
}

export const ResizableFloatingPanel: React.FC<ResizableFloatingPanelProps> = ({
  children,
  className = '',
  bodyClassName = '',
  storageKey,
  defaultWidth,
  defaultHeight,
  minWidth = 280,
  maxWidth = 720,
  minHeight = 160,
  maxHeight = 560,
  anchor = 'bottom-left',
  style,
}) => {
  const [size, setSize] = useState(() =>
    readSize(storageKey, defaultWidth, defaultHeight, minWidth, maxWidth, minHeight, maxHeight)
  );
  const shellRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    edge: 'right' | 'bottom' | 'corner';
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(size));
    } catch {
      /* ignore */
    }
  }, [size, storageKey]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dw = e.clientX - drag.startX;
      const dh = e.clientY - drag.startY;
      const signW = anchor === 'bottom-right' ? -1 : 1;

      setSize((prev) => {
        let width = prev.width;
        let height = prev.height;
        if (drag.edge === 'right' || drag.edge === 'corner') {
          width = Math.min(maxWidth, Math.max(minWidth, drag.startW + dw * signW));
        }
        if (drag.edge === 'bottom' || drag.edge === 'corner') {
          height = Math.min(maxHeight, Math.max(minHeight, drag.startH - dh));
        }
        return { width, height };
      });
    },
    [anchor, maxWidth, minWidth, maxHeight, minHeight]
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [onPointerMove]);

  const startDrag = (edge: 'right' | 'bottom' | 'corner', e: React.PointerEvent) => {
    const el = shellRef.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startW: rect.width,
      startH: rect.height,
    };
    document.body.style.cursor =
      edge === 'corner' ? 'nwse-resize' : edge === 'right' ? 'ew-resize' : 'ns-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
  };

  const shellClass = [
    styles.shell,
    anchor === 'bottom-right' ? styles.anchorRight : styles.anchorLeft,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const bodyClass = ['ab-seamless-scroll', styles.body, bodyClassName].filter(Boolean).join(' ');

  return (
    <div
      ref={shellRef}
      className={shellClass}
      style={{ width: size.width, height: size.height, ...style }}
    >
      <div className={bodyClass}>{children}</div>
      <div
        className={styles.gripRight}
        onPointerDown={(e) => startDrag('right', e)}
        title="Resize width"
        aria-hidden
      />
      <div
        className={styles.gripBottom}
        onPointerDown={(e) => startDrag('bottom', e)}
        title="Resize height"
        aria-hidden
      />
      <div
        className={styles.gripCorner}
        onPointerDown={(e) => startDrag('corner', e)}
        title="Resize panel"
        aria-hidden
      />
    </div>
  );
};
