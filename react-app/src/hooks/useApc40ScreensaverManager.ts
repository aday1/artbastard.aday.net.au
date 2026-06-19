import { useEffect } from 'react';
import { startApc40Screensaver, stopApc40Screensaver } from '../engines/apc40Screensaver';

async function setServerApc40ScreensaverHidden(hidden: boolean): Promise<void> {
  const path = hidden ? '/api/screensaver/apc40/browser-hidden' : '/api/screensaver/apc40/browser-visible';
  try {
    await fetch(path, { method: 'POST' });
  } catch {
    // Server path is best-effort when browser Web MIDI cannot own the APC.
  }
}

export function useApc40ScreensaverManager(): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const syncVisibility = async () => {
      if (document.visibilityState === 'hidden') {
        const startedInBrowser = await startApc40Screensaver();
        if (!startedInBrowser) {
          await setServerApc40ScreensaverHidden(true);
        } else {
          await setServerApc40ScreensaverHidden(false);
        }
        return;
      }

      stopApc40Screensaver();
      await setServerApc40ScreensaverHidden(false);
    };

    document.addEventListener('visibilitychange', syncVisibility);
    void syncVisibility();
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      stopApc40Screensaver();
      void setServerApc40ScreensaverHidden(false);
    };
  }, []);
}
