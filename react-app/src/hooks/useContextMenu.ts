import { useCallback, useState } from 'react';
import type { ContextMenuItem, ContextMenuState } from '../components/ui/ContextMenu';

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  const openMenu = useCallback((event: React.MouseEvent, items: ContextMenuItem[]) => {
    event.preventDefault();
    event.stopPropagation();
    const usable = items.filter((item) => {
      if ('type' in item && item.type === 'separator') return true;
      return !!(item as { label?: string }).label;
    });
    if (!usable.length) return;
    setMenu({ x: event.clientX, y: event.clientY, items: usable });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  return { menu, openMenu, closeMenu };
}
