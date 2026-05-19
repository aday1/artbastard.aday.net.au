export type PopupOpenKind = 'window' | 'tab' | 'same-tab';

export interface PopupOpenResult {
  kind: PopupOpenKind;
  /** Set when kind is `window` (for postMessage handoff). */
  window: Window | null;
}

export interface OpenPopupSurfaceOptions {
  url: string;
  windowName: string;
  width: number;
  height: number;
  /** Bias window to the right side of the available screen (second monitor friendly). */
  preferSecondScreen?: boolean;
}

function resolveWindowPosition(
  width: number,
  height: number,
  preferSecondScreen: boolean
): { left: number; top: number } {
  const screenInfo = window.screen as Screen & { availLeft?: number };
  const availLeft = screenInfo.availLeft ?? 0;
  const availWidth = window.screen.availWidth;
  const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
  if (!preferSecondScreen) {
    return {
      left: Math.max(0, Math.round((availWidth - width) / 2) + availLeft),
      top,
    };
  }
  const left = Math.max(
    availLeft,
    availLeft + availWidth - width - 24
  );
  return { left, top };
}

export function openPopupSurface(options: OpenPopupSurfaceOptions): PopupOpenResult {
  const { url, windowName, width, height, preferSecondScreen = false } = options;
  const { left, top } = resolveWindowPosition(width, height, preferSecondScreen);
  const features = [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'resizable=yes',
    'scrollbars=yes',
    'toolbar=no',
    'menubar=no',
    'location=no',
  ].join(',');

  let popup: Window | null = null;
  try {
    popup = window.open(url, windowName, features);
  } catch {
    popup = null;
  }

  if (popup) {
    popup.focus();
    return { kind: 'window', window: popup };
  }

  const tab = window.open(url, '_blank');
  if (tab) {
    return { kind: 'tab', window: null };
  }

  window.location.href = url;
  return { kind: 'same-tab', window: null };
}

export function getMobileSurfaceUrl(): string {
  return `${window.location.origin}${window.location.pathname}#/mobile`;
}

export function openMobileSurface(): PopupOpenResult {
  return openPopupSurface({
    url: getMobileSurfaceUrl(),
    windowName: 'ArtBastardMobile',
    width: 480,
    height: 800,
    preferSecondScreen: false,
  });
}
