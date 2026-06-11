import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../store';
import type { AppearanceSettings } from '../utils/themeUtils';

const SAVE_DELAY_MS = 500;

/** Debounced POST of appearance to server; flushes on unmount. */
export function useDebouncedAppearanceSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveAppearanceToServer = useStore((s) => s.saveAppearanceToServer);

  const flushSave = useCallback(
    (overrides?: Partial<AppearanceSettings>) => {
      const state = useStore.getState();
      const presetId = localStorage.getItem('themePresetId') || 'reason-rack';
      void saveAppearanceToServer({
        theme: overrides?.theme ?? state.theme,
        darkMode: overrides?.darkMode ?? state.darkMode,
        themePresetId: overrides?.themePresetId ?? presetId,
        themeColors: overrides?.themeColors ?? state.themeColors,
      });
    },
    [saveAppearanceToServer]
  );

  const scheduleSave = useCallback(
    (overrides?: Partial<AppearanceSettings>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        flushSave(overrides);
      }, SAVE_DELAY_MS);
    },
    [flushSave]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return { scheduleSave, flushSave };
}
