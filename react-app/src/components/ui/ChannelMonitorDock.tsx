import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LucideIcon } from './LucideIcon';
import styles from './ChannelMonitorDock.module.scss';

const STORAGE_KEY = 'artbastard.channelDock.layout.v2';
const LEGACY_STORAGE_KEY = 'artbastard.channelDock';
const MIN_WIDTH = 140;
const MAX_WIDTH = 460;
const MIN_HEIGHT = 150;
const MAX_HEIGHT = 520;
const COLLAPSED_SIZE = 54;

type DockPosition = 'right' | 'bottom' | 'floating';

interface DockLayout {
  dock: DockPosition;
  width: number;
  height: number;
  x: number;
  y: number;
  collapsed: boolean;
  hidden: boolean;
}

type DragMode = 'width' | 'height' | 'move';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function shouldDefaultBottomDock() {
  if (!isBrowser()) return false;
  return window.location.hash.includes('/mobile') || window.matchMedia('(max-width: 900px)').matches;
}

function getLegacyWidth() {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { width?: number };
    return typeof parsed.width === 'number' ? parsed.width : null;
  } catch {
    return null;
  }
}

function defaultLayout(): DockLayout {
  const bottom = shouldDefaultBottomDock();
  const viewportWidth = isBrowser() ? window.innerWidth : 1280;
  const viewportHeight = isBrowser() ? window.innerHeight : 800;
  const legacyWidth = getLegacyWidth();
  const width = clamp(legacyWidth ?? (bottom ? viewportWidth - 24 : 220), MIN_WIDTH, MAX_WIDTH);
  const height = clamp(bottom ? 220 : 280, MIN_HEIGHT, Math.min(MAX_HEIGHT, viewportHeight - 96));

  return {
    dock: bottom ? 'bottom' : 'right',
    width,
    height,
    x: clamp(viewportWidth - width - 24, 12, Math.max(12, viewportWidth - width - 12)),
    y: clamp(96, 12, Math.max(12, viewportHeight - height - 12)),
    collapsed: false,
    hidden: false,
  };
}

function normalizeLayout(layout: Partial<DockLayout>): DockLayout {
  const defaults = defaultLayout();
  const width = clamp(layout.width ?? defaults.width, MIN_WIDTH, MAX_WIDTH);
  const height = clamp(layout.height ?? defaults.height, MIN_HEIGHT, MAX_HEIGHT);
  const viewportWidth = isBrowser() ? window.innerWidth : 1280;
  const viewportHeight = isBrowser() ? window.innerHeight : 800;

  return {
    dock: layout.dock ?? defaults.dock,
    width,
    height,
    x: clamp(layout.x ?? defaults.x, 12, Math.max(12, viewportWidth - width - 12)),
    y: clamp(layout.y ?? defaults.y, 12, Math.max(12, viewportHeight - height - 12)),
    collapsed: Boolean(layout.collapsed),
    hidden: Boolean(layout.hidden),
  };
}

function readSavedLayout(): DockLayout {
  if (!isBrowser()) return defaultLayout();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultLayout();
    return normalizeLayout(JSON.parse(raw) as Partial<DockLayout>);
  } catch {
    return defaultLayout();
  }
}

export interface ChannelMonitorDockProps {
  children: React.ReactNode;
  className?: string;
}

export const ChannelMonitorDock: React.FC<ChannelMonitorDockProps> = ({ children, className = '' }) => {
  const [layout, setLayout] = useState<DockLayout>(readSavedLayout);
  const dockRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startLayoutX: number;
    startLayoutY: number;
  } | null>(null);

  const setDockReserve = useCallback((next: DockLayout) => {
    if (!isBrowser()) return;
    const responsiveBottom = window.matchMedia('(max-width: 900px)').matches;
    const reserve =
      next.hidden || next.dock !== 'right' || responsiveBottom
        ? 0
        : next.collapsed
          ? COLLAPSED_SIZE
          : next.width;
    document.documentElement.style.setProperty('--ab-channel-dock-inline-reserve', `${reserve}px`);
  }, []);

  useEffect(() => {
    setDockReserve(layout);
    return () => {
      if (isBrowser()) {
        document.documentElement.style.setProperty('--ab-channel-dock-inline-reserve', '0px');
      }
    };
  }, [layout, setDockReserve]);

  const updateLayout = (patch: Partial<DockLayout>) => {
    setLayout((current) => normalizeLayout({ ...current, ...patch }));
  };

  const saveLayout = () => {
    if (!isBrowser()) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
      /* ignore */
    }
  };

  const restoreLayout = () => {
    if (isBrowser()) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    setLayout(defaultLayout());
  };

  const onPointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    setLayout((current) => {
      if (drag.mode === 'width') {
        const delta = current.dock === 'right' ? drag.startX - e.clientX : e.clientX - drag.startX;
        return normalizeLayout({ ...current, width: drag.startW + delta });
      }

      if (drag.mode === 'height') {
        const delta = current.dock === 'bottom' ? drag.startY - e.clientY : e.clientY - drag.startY;
        return normalizeLayout({ ...current, height: drag.startH + delta });
      }

      const viewportWidth = isBrowser() ? window.innerWidth : 1280;
      const viewportHeight = isBrowser() ? window.innerHeight : 800;
      return normalizeLayout({
        ...current,
        dock: 'floating',
        x: clamp(drag.startLayoutX + e.clientX - drag.startX, 12, viewportWidth - current.width - 12),
        y: clamp(drag.startLayoutY + e.clientY - drag.startY, 12, viewportHeight - current.height - 12),
      });
    });
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [onPointerMove]);

  const startDrag = (mode: DragMode, e: React.PointerEvent) => {
    const el = dockRef.current;
    if (!el || layout.collapsed) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startW: rect.width,
      startH: rect.height,
      startLayoutX: layout.x,
      startLayoutY: layout.y,
    };
    document.body.style.cursor =
      mode === 'move' ? 'move' : mode === 'width' ? 'ew-resize' : 'ns-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
  };

  if (layout.hidden) {
    return (
      <button
        type="button"
        className={styles.hiddenLauncher}
        onClick={() => updateLayout({ hidden: false, collapsed: false })}
        title="Show activity meters"
      >
        <LucideIcon name="Eye" size={18} />
        <span>Activity</span>
      </button>
    );
  }

  const dockClasses = [
    styles.dock,
    styles[`dock${layout.dock[0].toUpperCase()}${layout.dock.slice(1)}` as keyof typeof styles],
    layout.collapsed ? styles.collapsed : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const dockStyle: React.CSSProperties =
    layout.dock === 'right'
      ? { width: layout.collapsed ? COLLAPSED_SIZE : layout.width }
      : layout.dock === 'bottom'
        ? { height: layout.collapsed ? COLLAPSED_SIZE : layout.height }
        : {
            width: layout.collapsed ? COLLAPSED_SIZE : layout.width,
            height: layout.collapsed ? COLLAPSED_SIZE : layout.height,
            left: layout.x,
            top: layout.y,
          };

  if (layout.collapsed) {
    return (
      <div
        ref={dockRef}
        className={dockClasses}
        style={dockStyle}
        role="region"
        aria-label="Collapsed activity meters"
      >
        <button
          type="button"
          className={styles.collapsedButton}
          onClick={() => updateLayout({ collapsed: false })}
          title="Expand activity meters"
        >
          <LucideIcon name="Maximize2" size={18} />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={dockRef}
      className={dockClasses}
      style={dockStyle}
      role="region"
      aria-label="Active channel meters"
    >
      <header
        className={`${styles.toolbar} ${layout.dock === 'floating' ? styles.draggableToolbar : ''}`}
        onPointerDown={layout.dock === 'floating' ? (e) => startDrag('move', e) : undefined}
      >
        <span className={styles.toolbarTitle}>
          <LucideIcon name="Activity" size={14} />
          Activity
        </span>
        <div className={styles.toolbarActions} onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`${styles.iconButton} ${layout.dock === 'right' ? styles.active : ''}`}
            onClick={() => updateLayout({ dock: 'right', hidden: false, collapsed: false })}
            title="Dock right"
            aria-pressed={layout.dock === 'right'}
          >
            <LucideIcon name="PanelRight" size={14} />
          </button>
          <button
            type="button"
            className={`${styles.iconButton} ${layout.dock === 'bottom' ? styles.active : ''}`}
            onClick={() => updateLayout({ dock: 'bottom', hidden: false, collapsed: false })}
            title="Dock bottom"
            aria-pressed={layout.dock === 'bottom'}
          >
            <LucideIcon name="PanelBottom" size={14} />
          </button>
          <button
            type="button"
            className={`${styles.iconButton} ${layout.dock === 'floating' ? styles.active : ''}`}
            onClick={() => updateLayout({ dock: 'floating', hidden: false, collapsed: false })}
            title="Float panel"
            aria-pressed={layout.dock === 'floating'}
          >
            <LucideIcon name="Move" size={14} />
          </button>
          <button type="button" className={styles.textButton} onClick={saveLayout} title="Save layout">
            <LucideIcon name="Save" size={14} />
            <span>Save</span>
          </button>
          <button type="button" className={styles.textButton} onClick={restoreLayout} title="Restore layout">
            <LucideIcon name="RotateCcw" size={14} />
            <span>Restore</span>
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => updateLayout({ collapsed: true })}
            title="Collapse activity meters"
          >
            <LucideIcon name="Minimize2" size={14} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => updateLayout({ hidden: true })}
            title="Hide activity meters"
          >
            <LucideIcon name="EyeOff" size={14} />
          </button>
        </div>
      </header>

      {layout.dock === 'bottom' || layout.dock === 'floating' ? (
        <div
          className={styles.gripTop}
          onPointerDown={(e) => startDrag('height', e)}
          title="Drag to resize height"
          aria-hidden
        />
      ) : null}
      {layout.dock === 'right' || layout.dock === 'floating' ? (
        <div
          className={styles.gripLeft}
          onPointerDown={(e) => startDrag('width', e)}
          title="Drag to resize width"
          aria-hidden
        />
      ) : null}
      <div className={styles.scroll}>{children}</div>
    </div>
  );
};
