import { useEffect } from 'react';
import { startApc40Screensaver, stopApc40Screensaver } from '../engines/apc40Screensaver';

export function useApc40ScreensaverManager(): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const syncVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void startApc40Screensaver();
      } else {
        stopApc40Screensaver();
      }
    };

    document.addEventListener('visibilitychange', syncVisibility);
    syncVisibility();
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      stopApc40Screensaver();
    };
  }, []);
}