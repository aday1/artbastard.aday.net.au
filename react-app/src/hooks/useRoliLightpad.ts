import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RoliTouchCallback,
  composeLedFrame,
  connectRoliLightpad,
  disconnectRoliLightpad,
  getRoliStatus,
  sendLedFrame,
  setOnDeviceChange,
  setOnHandshakeDone,
  setOnTouch,
} from '../engines/roliLightpad';
import {
  MIDI_CONNECT_ROLI_EVENT,
  ROLI_LIGHTPAD_CONNECT_APPROVED_KEY,
  describeDetectedMidiController,
  dispatchConnectedMidiController,
} from '../midi/detectedMidiController';

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
 * Subscribes to Roli Lightpad state and connects only after user approval.
 * Exposes touch input + LED output after the detected-device prompt is accepted.
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
      // Don't trust the polling alone — clear the flag immediately on
      // device-change so we don't keep sending into a stale handshake state.
      setHandshakeDone(getRoliStatus().handshakeDone);
    });
    setOnHandshakeDone((done) => {
      if (cancelled) return;
      setHandshakeDone(done);
    });
    setOnTouch((ev) => touchRef.current?.(ev));
    const connectApprovedRoli = () => {
      connectRoliLightpad().then((ok) => {
        if (cancelled) return;
        const status = getRoliStatus();
        setConnected(ok || status.connected);
        setDeviceName(status.inputName ?? status.outputName ?? null);
        setHandshakeDone(status.handshakeDone);
        const controller = describeDetectedMidiController(status.inputName ?? status.outputName ?? 'ROLI Lightpad BLOCK', 'browser');
        if (controller && (ok || status.connected)) dispatchConnectedMidiController(controller);
      });
    };

    const handleConnectRoli = () => connectApprovedRoli();
    window.addEventListener(MIDI_CONNECT_ROLI_EVENT, handleConnectRoli);
    if (localStorage.getItem(ROLI_LIGHTPAD_CONNECT_APPROVED_KEY) === 'true') connectApprovedRoli();
    return () => {
      cancelled = true;
      setOnTouch(null);
      setOnDeviceChange(null);
      setOnHandshakeDone(null);
      window.removeEventListener(MIDI_CONNECT_ROLI_EVENT, handleConnectRoli);
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
