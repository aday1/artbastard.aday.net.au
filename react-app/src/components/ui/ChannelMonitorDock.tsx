import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ChannelMonitorDock.module.scss';

const STORAGE_KEY = 'artbastard.channelDock';
const MIN_WIDTH = 160;
const MAX_WIDTH = 420;
const MIN_HEIGHT = 180;

interface DockPrefs {
  width: number;
  height: number | null;
}

function readPrefs(): DockPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { width: 240, height: null };
    const parsed = JSON.parse(raw) as DockPrefs;
    return {
      width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parsed.width ?? 240)),
      height: parsed.height ?? null,
    };
  } catch {
    return { width: 240, height: null };
  }
}

export interface ChannelMonitorDockProps {
  children: React.ReactNode;
  className?: string;
}

export const ChannelMonitorDock: React.FC<ChannelMonitorDockProps> = ({ children, className = '' }) => {
  const [prefs, setPrefs] = useState<DockPrefs>(readPrefs);
  const dockRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: 'width' | 'height'; startX: number; startY: number; startW: number; startH: number } | null>(
    null
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
    document.documentElement.style.setProperty('--channel-dock-width', `${prefs.width}px`);
  }, [prefs]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    const el = dockRef.current;
    if (!drag || !el) return;

    if (drag.mode === 'width') {
      const dx = drag.startX - e.clientX;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, drag.startW + dx));
      setPrefs((p) => ({ ...p, width: next }));
    } else {
      const dy = e.clientY - drag.startY;
      const next = Math.max(MIN_HEIGHT, drag.startH + dy);
      setPrefs((p) => ({ ...p, height: next }));
    }
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [onPointerMove]);

  const startDrag = (mode: 'width' | 'height', e: React.PointerEvent) => {
    const el = dockRef.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      mode,
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

  return (
    <div
      ref={dockRef}
      className={[styles.dock, className].filter(Boolean).join(' ')}
      style={{
        width: prefs.width,
        ...(prefs.height != null ? { height: prefs.height } : {}),
      }}
      role="region"
      aria-label="Active channel meters"
    >
      <div
        className={styles.gripTop}
        onPointerDown={(e) => startDrag('height', e)}
        title="Drag to resize height"
        aria-hidden
      />
      <div
        className={styles.gripLeft}
        onPointerDown={(e) => startDrag('width', e)}
        title="Drag to resize width"
        aria-hidden
      />
      <div className={styles.scroll}>{children}</div>
    </div>
  );
};
