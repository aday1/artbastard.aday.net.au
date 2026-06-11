import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LucideIcon } from './LucideIcon';
import styles from './ContextMenu.module.scss';

export type ContextMenuItem =
  | {
      id: string;
      label: string;
      icon?: string;
      disabled?: boolean;
      danger?: boolean;
      checked?: boolean;
      onClick: () => void;
    }
  | { id: string; type: 'separator' };

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

interface ContextMenuProps {
  menu: ContextMenuState | null;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ menu, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointer = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('scroll', onClose, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [menu, onClose]);

  useEffect(() => {
    if (!menu || !panelRef.current) return;
    const el = panelRef.current;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = menu.x;
    let top = menu.y;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [menu]);

  if (!menu) return null;

  return createPortal(
    <div
      ref={panelRef}
      className={styles.menu}
      data-skip-app-context-menu
      role="menu"
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.items.map((item) => {
        if ('type' in item && item.type === 'separator') {
          return <div key={item.id} className={styles.separator} role="separator" />;
        }
        const row = item as Extract<ContextMenuItem, { label: string }>;
        return (
          <button
            key={row.id}
            type="button"
            role="menuitem"
            className={[
              styles.item,
              row.danger ? styles.danger : '',
              row.disabled ? styles.disabled : '',
              row.checked ? styles.checked : '',
            ]
              .filter(Boolean)
              .join(' ')}
            disabled={row.disabled}
            onClick={() => {
              if (row.disabled) return;
              row.onClick();
              onClose();
            }}
          >
            {row.icon ? (
              <span className={styles.icon}>
                <LucideIcon name={row.icon as any} size={14} />
              </span>
            ) : (
              <span className={styles.iconPlaceholder} />
            )}
            <span className={styles.label}>{row.label}</span>
            {row.checked ? <LucideIcon name="Check" size={14} className={styles.check} /> : null}
          </button>
        );
      })}
    </div>,
    document.body
  );
};
