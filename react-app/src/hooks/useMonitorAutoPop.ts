/**
 * Shared collapse / dismiss / auto-pop behaviour for the floating
 * MIDI / OSC / DMX monitors.
 *
 * Defaults:
 *  - First-ever mount: panel is COLLAPSED (small handle pinned to its corner)
 *    and NOT dismissed. The user sees a tiny chip until activity arrives.
 *  - First signal in this session: if the user has never manually touched the
 *    panel, auto-expand + flash so they notice. Subsequent signals just flash.
 *  - User collapse OR dismiss is sticky — the auto-pop will not fire again on
 *    that monitor until they call Reset Layout from settings.
 *
 * Persistence:
 *  - `${key}Collapsed` — 'true' / 'false'. Absent => default true.
 *  - `${key}Dismissed` — 'true' / 'false'. Absent => false.
 *  - `${key}UserInteracted` — 'true' once the user has clicked
 *    Collapse / Dismiss. Locks auto-pop off forever (until Reset Layout).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseMonitorAutoPopArgs {
  key: string;
  hasSignal: boolean;
  flashDurationMs?: number;
}

interface UseMonitorAutoPopResult {
  isCollapsed: boolean;
  isDismissed: boolean;
  flashActive: boolean;
  setCollapsedByUser: (next: boolean) => void;
  dismissByUser: () => void;
  triggerFlash: () => void;
}

const readBool = (key: string, fallback: boolean): boolean => {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return raw === 'true';
  } catch {
    return fallback;
  }
};

const writeBool = (key: string, value: boolean): void => {
  try { localStorage.setItem(key, value ? 'true' : 'false'); } catch { /* ignore */ }
};

const removeKey = (key: string): void => {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
};

export function useMonitorAutoPop({
  key,
  hasSignal,
  flashDurationMs = 200,
}: UseMonitorAutoPopArgs): UseMonitorAutoPopResult {
  const collapsedKey = `${key}Collapsed`;
  const dismissedKey = `${key}Dismissed`;
  const userKey = `${key}UserInteracted`;

  // Minimised by default on first ever load.
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => readBool(collapsedKey, true));
  const [isDismissed, setIsDismissed] = useState<boolean>(() => readBool(dismissedKey, false));
  const [flashActive, setFlashActive] = useState<boolean>(false);

  const userInteractedRef = useRef<boolean>(readBool(userKey, false));
  const hasAutoPoppedRef = useRef<boolean>(false);
  const prevSignalRef = useRef<boolean>(hasSignal);
  const flashTimerRef = useRef<number | null>(null);

  // Auto-pop on the first signal of this session, IF the user has never
  // manually closed/minimised the panel. Subsequent signals just flash.
  useEffect(() => {
    if (!hasSignal) {
      prevSignalRef.current = false;
      return;
    }
    const wasIdle = !prevSignalRef.current;
    prevSignalRef.current = true;
    if (!wasIdle) return;

    if (!userInteractedRef.current && !hasAutoPoppedRef.current) {
      hasAutoPoppedRef.current = true;
      if (isDismissed) {
        setIsDismissed(false);
        writeBool(dismissedKey, false);
      }
      if (isCollapsed) {
        setIsCollapsed(false);
        writeBool(collapsedKey, false);
      }
    }

    if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current);
    setFlashActive(true);
    flashTimerRef.current = window.setTimeout(() => setFlashActive(false), flashDurationMs);
  }, [hasSignal, isCollapsed, isDismissed, collapsedKey, dismissedKey, flashDurationMs]);

  useEffect(() => () => {
    if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current);
  }, []);

  // Reset-Layout from Settings → restore visibility + clear sticky lock.
  useEffect(() => {
    const onReset = () => {
      userInteractedRef.current = false;
      hasAutoPoppedRef.current = false;
      removeKey(collapsedKey);
      removeKey(dismissedKey);
      removeKey(userKey);
      setIsCollapsed(true);
      setIsDismissed(false);
    };
    window.addEventListener('resetLayout', onReset);
    return () => window.removeEventListener('resetLayout', onReset);
  }, [collapsedKey, dismissedKey, userKey]);

  const setCollapsedByUser = useCallback((next: boolean) => {
    setIsCollapsed(next);
    writeBool(collapsedKey, next);
    userInteractedRef.current = true;
    writeBool(userKey, true);
  }, [collapsedKey, userKey]);

  const dismissByUser = useCallback(() => {
    setIsDismissed(true);
    writeBool(dismissedKey, true);
    userInteractedRef.current = true;
    writeBool(userKey, true);
  }, [dismissedKey, userKey]);

  const triggerFlash = useCallback(() => {
    if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current);
    setFlashActive(true);
    flashTimerRef.current = window.setTimeout(() => setFlashActive(false), flashDurationMs);
  }, [flashDurationMs]);

  return {
    isCollapsed,
    isDismissed,
    flashActive,
    setCollapsedByUser,
    dismissByUser,
    triggerFlash,
  };
}
