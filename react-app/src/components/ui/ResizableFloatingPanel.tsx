import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ResizableFloatingPanel.module.scss';

export type FloatingAnchor = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

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
  anchor?: FloatingAnchor;
  style?: React.CSSProperties;
}

interface PersistedState {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function readState(
  storageKey: string,
  defaults: { width: number; height: number },
  bounds: { minW: number; maxW: number; minH: number; maxH: number }
): PersistedState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { width: defaults.width, height: defaults.height };
    const p = JSON.parse(raw) as Partial<PersistedState>;
    return {
      width: clamp(p.width ?? defaults.width, bounds.minW, bounds.maxW),
      height: clamp(p.height ?? defaults.height, bounds.minH, bounds.maxH),
      x: typeof p.x === 'number' ? p.x : undefined,
      y: typeof p.y === 'number' ? p.y : undefined,
    };
  } catch {
    return { width: defaults.width, height: defaults.height };
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
  const [state, setState] = useState<PersistedState>(() =>
    readState(
      storageKey,
      { width: defaultWidth, height: defaultHeight },
      { minW: minWidth, maxW: maxWidth, minH: minHeight, maxH: maxHeight }
    )
  );
  const shellRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{
    edge: 'right' | 'bottom' | 'corner';
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);
  const moveRef = useRef<{
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, storageKey]);

  // Clamp to viewport on mount if persisted position is off-screen
  useEffect(() => {
    if (state.x === undefined || state.y === undefined) return;
    const maxX = Math.max(0, window.innerWidth - state.width);
    const maxY = Math.max(0, window.innerHeight - state.height);
    const x = clamp(state.x, 0, maxX);
    const y = clamp(state.y, 0, maxY);
    if (x !== state.x || y !== state.y) {
      setState((s) => ({ ...s, x, y }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Resize ----
  const onResizeMove = useCallback(
    (e: PointerEvent) => {
      const drag = resizeRef.current;
      if (!drag) return;
      const dw = e.clientX - drag.startX;
      const dh = e.clientY - drag.startY;
      // When user has dragged, position is locked via x/y so width grows to the right always.
      // When using right-anchor (no drag yet), width grows toward the left (sign flipped).
      const hasMoved = state.x !== undefined;
      const signW = !hasMoved && anchor.endsWith('right') ? -1 : 1;
      const signH = !hasMoved && anchor.startsWith('bottom') ? -1 : 1;

      setState((prev) => {
        let width = prev.width;
        let height = prev.height;
        if (drag.edge === 'right' || drag.edge === 'corner') {
          width = clamp(drag.startW + dw * signW, minWidth, maxWidth);
        }
        if (drag.edge === 'bottom' || drag.edge === 'corner') {
          height = clamp(drag.startH + dh * signH, minHeight, maxHeight);
        }
        return { ...prev, width, height };
      });
    },
    [anchor, maxWidth, minWidth, maxHeight, minHeight, state.x]
  );

  const endResize = useCallback(() => {
    resizeRef.current = null;
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', endResize);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [onResizeMove]);

  const startResize = (edge: 'right' | 'bottom' | 'corner', e: React.PointerEvent) => {
    const el = shellRef.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = el.getBoundingClientRect();
    resizeRef.current = {
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startW: rect.width,
      startH: rect.height,
    };
    document.body.style.cursor =
      edge === 'corner' ? 'nwse-resize' : edge === 'right' ? 'ew-resize' : 'ns-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', endResize);
  };

  // ---- Move (drag) ----
  const onMoveMove = useCallback((e: PointerEvent) => {
    const m = moveRef.current;
    if (!m) return;
    const el = shellRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const x = clamp(m.startLeft + (e.clientX - m.startX), 0, Math.max(0, window.innerWidth - w));
    const y = clamp(m.startTop + (e.clientY - m.startY), 0, Math.max(0, window.innerHeight - h));
    setState((s) => ({ ...s, x, y }));
  }, []);

  const endMove = useCallback(() => {
    moveRef.current = null;
    window.removeEventListener('pointermove', onMoveMove);
    window.removeEventListener('pointerup', endMove);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [onMoveMove]);

  const onShellPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Don't drag from interactive elements
    if (target.closest('button, input, select, textarea, a, [role="button"], [contenteditable="true"]')) return;
    // Don't drag from resize grips
    if (target.closest(`.${styles.gripRight}, .${styles.gripBottom}, .${styles.gripCorner}`)) return;
    // Only drag from a marked handle (or the top drag strip)
    if (!target.closest('.handle, [data-drag-handle]')) return;
    const el = shellRef.current;
    if (!el) return;
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    moveRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMoveMove);
    window.addEventListener('pointerup', endMove);
  };

  const resetPosition = () => {
    setState((s) => ({ ...s, x: undefined, y: undefined }));
  };

  const anchorClass =
    anchor === 'bottom-right'
      ? styles.anchorBottomRight
      : anchor === 'top-left'
      ? styles.anchorTopLeft
      : anchor === 'top-right'
      ? styles.anchorTopRight
      : styles.anchorBottomLeft;

  const shellClass = [styles.shell, anchorClass, className].filter(Boolean).join(' ');
  const bodyClass = ['ab-seamless-scroll', styles.body, bodyClassName].filter(Boolean).join(' ');

  // When user has dragged, override anchor positioning with absolute left/top
  const positionedStyle: React.CSSProperties =
    state.x !== undefined && state.y !== undefined
      ? { left: state.x, top: state.y, right: 'auto', bottom: 'auto' }
      : {};

  return (
    <div
      ref={shellRef}
      className={shellClass}
      style={{ width: state.width, height: state.height, ...positionedStyle, ...style }}
      onPointerDown={onShellPointerDown}
    >
      <div
        className={styles.gripTop}
        data-drag-handle
        onDoubleClick={resetPosition}
        title="Drag to move (double-click to reset position)"
        aria-hidden
      />
      <div className={bodyClass}>{children}</div>
      <div
        className={styles.gripRight}
        onPointerDown={(e) => startResize('right', e)}
        title="Resize width"
        aria-hidden
      />
      <div
        className={styles.gripBottom}
        onPointerDown={(e) => startResize('bottom', e)}
        title="Resize height"
        aria-hidden
      />
      <div
        className={styles.gripCorner}
        onPointerDown={(e) => startResize('corner', e)}
        title="Resize panel"
        aria-hidden
      />
    </div>
  );
};
