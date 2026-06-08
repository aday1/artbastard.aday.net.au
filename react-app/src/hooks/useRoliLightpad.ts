import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RoliTouchCallback,
  composeLedFrame,
  connectRoliLightpad,
  disconnectRoliLightpad,
  getRoliStatus,
  sendLedFrame,
  setOnDeviceChange,
  setOnTouch,
} from '../engines/roliLightpad';

export interface UseRoliLightpadResult {
  connected: boolean;
  deviceName: string | null;
  handshakeDone: boolean;
  /** Subscribe to touch events from the Lightpad. Replaces any prior handler. */
  onTouch: (cb: RoliTouchCallback | null) => void;
  /** Build + send a 15x15 LED frame (throttled to ~25Hz). */
  sendFrame: typeof composeLedFrame extends (...a: any) => infer R
    ? (opts: Parameters<typeof composeLedFrame>[0]) => boolean
    : never;
}

/**
 * Connects to a Roli Lightpad Block once on mount, auto-maps the first matching
 * Web MIDI port, and exposes touch input + LED output.
 *
 * SysEx is requested via a *separate* MIDI access call (the global
 * `useGlobalBrowserMidi` hook does not enable SysEx).
 */
export function useRoliLightpad(): UseRoliLightpadResult {
  const [connected, setConnected] = useState<boolean>(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [handshakeDone, setHandshakeDone] = useState<boolean>(false);
  const touchRef = useRef<RoliTouchCallback | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOnDeviceChange((info) => {
      if (cancelled) return;
      setConnected(info.connected);
      setDeviceName(info.inputName ?? info.outputName ?? null);
      // Handshake completes ~300ms after output binds; poll briefly.
      setTimeout(() => {
        if (!cancelled) setHandshakeDone(getRoliStatus().handshakeDone);
      }, 350);
    });
    setOnTouch((ev) => touchRef.current?.(ev));
    connectRoliLightpad().then((ok) => {
      if (cancelled) return;
      const status = getRoliStatus();
      setConnected(ok || status.connected);
      setDeviceName(status.inputName ?? status.outputName ?? null);
      setTimeout(() => {
        if (!cancelled) setHandshakeDone(getRoliStatus().handshakeDone);
      }, 400);
    });
    return () => {
      cancelled = true;
      setOnTouch(null);
      setOnDeviceChange(null);
      // Keep the MIDI access alive in case another mount wants it; only release
      // listeners. Full disconnect on full app teardown happens implicitly.
    };
  }, []);

  const onTouch = useCallback((cb: RoliTouchCallback | null) => {
    touchRef.current = cb;
  }, []);

  const sendFrame = useCallback((opts: Parameters<typeof composeLedFrame>[0]) => {
    return sendLedFrame(composeLedFrame(opts));
  }, []);

  return { connected, deviceName, handshakeDone, onTouch, sendFrame } as UseRoliLightpadResult;
}

export { disconnectRoliLightpad };
