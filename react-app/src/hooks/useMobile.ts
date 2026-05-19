import { useState, useEffect } from 'react';

const detectTouch = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    (typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0))
  );
};

const initialWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;

/**
 * Canonical responsive breakpoints used across the app. Keep in sync
 * with the SCSS tokens in styles/design-system.scss.
 *
 *   phone    : <  640 (one-handed phone use, single column)
 *   tablet   : 641 - 1279 (covers iPad portrait AND landscape, plus
 *               smaller-than-laptop touch devices like the Surface Go)
 *   desktop  : >= 1280 (true laptop / monitor real estate; original
 *               sidebar chrome)
 *
 * Older versions of this hook treated 1024 as the desktop boundary,
 * which left iPad landscape (1180px) stranded with the dense desktop
 * chrome despite being a touch device. 1280 lines up better with the
 * shape of modern hardware and is the single source of truth for:
 *   - Layout -> mobile chrome vs sidebar chrome
 *   - RouterContext -> default landing route
 *   - App.tsx -> toast container position
 *   - store -> Sparkles default
 */
export const PHONE_BP = 640;
export const TABLET_BP = 1280;

export const useMobile = () => {
  const [isMobile, setIsMobile] = useState<boolean>(initialWidth < PHONE_BP);
  const [isTablet, setIsTablet] = useState<boolean>(
    initialWidth >= PHONE_BP && initialWidth < TABLET_BP
  );
  const [isTouch, setIsTouch] = useState<boolean>(detectTouch());
  const [screenWidth, setScreenWidth] = useState<number>(initialWidth);

  useEffect(() => {
    // Check screen size and device type
    const checkDevice = () => {
      const width = window.innerWidth;
      setScreenWidth(width);

      setIsMobile(width < PHONE_BP);
      setIsTablet(width >= PHONE_BP && width < TABLET_BP);
      setIsTouch(detectTouch());
    };

    // Re-check on mount in case the viewport changed before hydration.
    checkDevice();

    // Listen for resize events
    window.addEventListener('resize', checkDevice);
    
    // Listen for orientation changes
    window.addEventListener('orientationchange', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  return {
    isMobile,
    isTablet,
    isTouch,
    isMobileOrTablet: isMobile || isTablet,
    screenWidth
  };
};

