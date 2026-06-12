import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RoliDeviceInfo,
  RoliRole,
  RoliTouchCallback,
  clearLeds,
  composeFrameFromCanvas,
  composeLedFrame,
  connectRoliLightpad,
  disconnectRoliLightpad,
  getRoliDevices,
  getRoliStatus,
  sendLedFrame,
  setOnDeviceChange,
  setOnHandshakeDone,
  setOnTouch,
} from '../engines/roliLightpad';
import {
  MIDI_CONNECT_ROLI_EVENT,
  describeDetectedMidiController,
  dispatchConnectedMidiController,
} from '../midi/detectedMidiController';

export interface UseRoliLightpadOptions {
  /**
   * Role of the physical block this hook instance cares about. When set, touch
   * events from other roles are filtered out, and LED sends route to the
   * matching block. Defaults to 'primary' (back-compat with single-device use).
   */
  role?: RoliRole;
}

export interface UseRoliLightpadResult {
  /** True when at least one block matching the requested role is connected. */
  connected: boolean;
  /** Name of the matched block's input/output port, or null. */
  deviceName: string | null;
  /** Handshake state of the matched block. */
  handshakeDone: boolean;
  /** Every ROLI block currently visible to the engine (regardless of role). */
  devices: RoliDeviceInfo[];
  /** Subscribe to touch events from the matched block. Replaces prior handler. */
  onTouch: (cb: RoliTouchCallback | null) => void;
  /** Build + send a 15x15 LED frame to the matched block (throttled to ~25Hz). */
  sendFrame: (opts: Parameters<typeof composeLedFrame>[0]) => boolean;
  /** Downsample a screen canvas to 15x15 and send it to the matched block. */
  sendCanvasFrame: (
    canvas: HTMLCanvasElement | null,
    opts?: Parameters<typeof composeFrameFromCanvas>[1]
  ) => boolean;
  /** Send a raw RGBA 15x15 buffer (typed) to the matched block. */
  sendRawFrame: (pixels: Uint8ClampedArray | Uint8Array) => boolean;
  /** Blank the matched block's LEDs immediately (bypasses throttle). */
  clearFrame: () => boolean;
}

/**
 * Subscribes to a Roli Lightpad block of a given role and exposes touch +
 * LED output. Multiple instances can coexist (e.g. one for the primary XY
 * pad and one for the colour-wheel block).
 *
 * SysEx is requested via a *separate* MIDI access call (the global
 * `useGlobalBrowserMidi` hook does not enable SysEx).
 */
export function useRoliLightpad(options: UseRoliLightpadOptions = {}): UseRoliLightpadResult {
  const role: RoliRole = options.role ?? 'primary';
  const [devices, setDevices] = useState<RoliDeviceInfo[]>(() => getRoliDevices());
  const touchRef = useRef<RoliTouchCallback | null>(null);

  const matched = useMemo(
    () => devices.find((d) => d.role === role) ?? null,
    [devices, role]
  );

  useEffect(() => {
    let cancelled = false;

    // setOnDeviceChange / setOnHandshakeDone / setOnTouch are singletons on the
    // engine — mounting multiple hook instances must NOT clobber each other.
    // We register fanout callbacks here per-mount; the engine itself only
    // remembers the most recent. To support multiple instances, the engine
    // delivers events to a single listener and we re-fan them via window
    // events so every hook instance can hear them.
    const handleDeviceChange = () => {
      if (cancelled) return;
      setDevices(getRoliDevices());
    };
    const handleTouchEvent = (e: Event) => {
      const ev = (e as CustomEvent).detail as Parameters<RoliTouchCallback>[0];
      if (!ev || ev.role !== role) return;
      touchRef.current?.(ev);
    };

    setOnDeviceChange((list) => {
      if (cancelled) return;
      setDevices(list);
      window.dispatchEvent(new CustomEvent('roli-device-change'));
    });
    setOnHandshakeDone(() => {
      if (cancelled) return;
      setDevices(getRoliDevices());
      window.dispatchEvent(new CustomEvent('roli-device-change'));
    });
    setOnTouch((ev) => {
      window.dispatchEvent(new CustomEvent('roli-touch', { detail: ev }));
    });

    window.addEventListener('roli-device-change', handleDeviceChange);
    window.addEventListener('roli-touch', handleTouchEvent);

    const connectApprovedRoli = () => {
      connectRoliLightpad().then(() => {
        if (cancelled) return;
        setDevices(getRoliDevices());
        const status = getRoliStatus();
        const controller = describeDetectedMidiController(
          status.inputName ?? status.outputName ?? 'ROLI Lightpad BLOCK',
          'browser'
        );
        if (controller && status.connected) dispatchConnectedMidiController(controller);
      });
    };

    const handleConnectRoli = () => connectApprovedRoli();
    window.addEventListener(MIDI_CONNECT_ROLI_EVENT, handleConnectRoli);
    // Auto-connect on mount. SysEx is now granted by useGlobalBrowserMidi at
    // app load and the MIDIAccess object is shared via setRoliMidiAccess, so
    // no separate user approval is needed for the engine to enumerate ROLI
    // ports. The detection banner remains as a manual re-handshake trigger.
    connectApprovedRoli();

    return () => {
      cancelled = true;
      window.removeEventListener('roli-device-change', handleDeviceChange);
      window.removeEventListener('roli-touch', handleTouchEvent);
      window.removeEventListener(MIDI_CONNECT_ROLI_EVENT, handleConnectRoli);
      // Leave engine-level callbacks installed — other mounts may still rely
      // on them. Full teardown happens via disconnectRoliLightpad().
    };
  }, [role]);

  const onTouch = useCallback((cb: RoliTouchCallback | null) => {
    touchRef.current = cb;
  }, []);

  const sendFrame = useCallback(
    (opts: Parameters<typeof composeLedFrame>[0]) => {
      return sendLedFrame(composeLedFrame(opts), { role });
    },
    [role]
  );

  const sendCanvasFrame = useCallback(
    (canvas: HTMLCanvasElement | null, opts?: Parameters<typeof composeFrameFromCanvas>[1]) => {
      return sendLedFrame(composeFrameFromCanvas(canvas, opts), { role });
    },
    [role]
  );

  const sendRawFrame = useCallback(
    (pixels: Uint8ClampedArray | Uint8Array) => sendLedFrame(pixels, { role }),
    [role]
  );

  const clearFrame = useCallback(() => clearLeds({ role }), [role]);

  return {
    connected: matched != null,
    deviceName: matched?.inputName ?? matched?.outputName ?? null,
    handshakeDone: matched?.handshakeDone ?? false,
    devices,
    onTouch,
    sendFrame,
    sendCanvasFrame,
    sendRawFrame,
    clearFrame,
  };
}

export { disconnectRoliLightpad };
