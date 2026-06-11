const dev =
  typeof import.meta !== 'undefined' &&
  Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

/** No-op in production builds unless localStorage artbastard-debug=1 */
export function isDebugEnabled(): boolean {
  if (dev) return true;
  try {
    return localStorage.getItem('artbastard-debug') === '1';
  } catch {
    return false;
  }
}

export function setDebugEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem('artbastard-debug', '1');
    } else {
      localStorage.removeItem('artbastard-debug');
    }
  } catch {
    /* ignore */
  }
}

export const debugLog = {
  log: (...args: unknown[]) => {
    if (isDebugEnabled()) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDebugEnabled()) console.warn(...args);
  },
  info: (...args: unknown[]) => {
    if (isDebugEnabled()) console.info(...args);
  },
};
