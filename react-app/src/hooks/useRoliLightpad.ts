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
  reconnectRoliLightpad,
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
  /** Build + send a 15x15 LED frame to the matched block, or an exact device id. */
  sendFrame: (opts: Parameters<typeof composeLedFrame>[0], deviceId?: string) => boolean;
  /** Downsample a screen canvas to 15x15 and send it to the matched block. */
  sendCanvasFrame: (
    canvas: HTMLCanvasElement | null,
    opts?: Parameters<typeof composeFrameFromCanvas>[1]
  ) => boolean;
  /** Send a raw RGBA 15x15 buffer (typed) to the matched block. */
  sendRawFrame: (pixels: Uint8ClampedArray | Uint8Array, deviceId?: string, forceFullFrame?: boolean) => boolean;
  /** Blank the matched block's LEDs immediately (bypasses throttle). */
  clearFrame: () => boolean;
}

const ROLI_DEVICE_CHANGE_EVENT = 'roli-device-change';
const ROLI_TOUCH_EVENT = 'roli-touch';

function dispatchRoliDeviceChange(list?: RoliDeviceInfo[]): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ROLI_DEVICE_CHANGE_EVENT, {
    detail: Array.isArray(list) ? list : getRoliDevices(),
  }));
}

function dispatchRoliTouch(ev: Parameters<RoliTouchCallback>[0]): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ROLI_TOUCH_EVENT, { detail: ev }));
}

function installRoliEngineFanout(): void {
  setOnDeviceChange((list) => dispatchRoliDeviceChange(list));
  setOnHandshakeDone(() => dispatchRoliDeviceChange());
  setOnTouch((ev) => dispatchRoliTouch(ev));
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
  const lastRescanAtRef = useRef(0);
  const serverRoliClaimedRef = useRef(false);

  const matched = useMemo(
    () => devices.find((d) => d.role === role) ?? null,
    [devices, role]
  );

  useEffect(() => {
    let cancelled = false;

    const applyServerRoliStatus = (status: any) => {
      const claimed = Boolean(status?.connected && (status?.inputName || status?.outputName));
      serverRoliClaimedRef.current = claimed;
      if (claimed) {
        disconnectRoliLightpad();
        setDevices(getRoliDevices());
      }
    };

    const cachedStatus = (window as any).__artbastardServerRoliStatus;
    if (cachedStatus) applyServerRoliStatus(cachedStatus);

    fetch('/api/roli/server/status')
      .then((response) => response.ok ? response.json() : null)
      .then((status) => status && applyServerRoliStatus(status))
      .catch(() => undefined);

    const handleServerRoliStatus = (event: Event) => applyServerRoliStatus((event as CustomEvent).detail);
    window.addEventListener('serverRoliStatus', handleServerRoliStatus);

    const handleDeviceChange = (event?: Event) => {
      if (cancelled) return;
      const detail = (event as CustomEvent<RoliDeviceInfo[] | undefined> | undefined)?.detail;
      setDevices(Array.isArray(detail) ? detail : getRoliDevices());
    };
    const handleTouchEvent = (e: Event) => {
      const ev = (e as CustomEvent).detail as Parameters<RoliTouchCallback>[0];
      if (!ev || ev.role !== role) return;
      touchRef.current?.(ev);
    };

    installRoliEngineFanout();

    window.addEventListener(ROLI_DEVICE_CHANGE_EVENT, handleDeviceChange);
    window.addEventListener(ROLI_TOUCH_EVENT, handleTouchEvent);

    const isRoliStateStale = () => {
      const current = getRoliDevices();
      return current.length === 0 || current.some((d) => !d.handshakeDone || d.lastError);
    };

    const finishConnect = () => {
      if (cancelled) return;
      setDevices(getRoliDevices());
      const status = getRoliStatus();
      const controller = describeDetectedMidiController(
        status.inputName ?? status.outputName ?? 'ROLI Lightpad BLOCK',
        'browser'
      );
      if (controller && status.connected) dispatchConnectedMidiController(controller);
    };

    const connectApprovedRoli = (forceRescan = false) => {
      if (serverRoliClaimedRef.current) return;
      if (forceRescan || isRoliStateStale()) {
        const now = Date.now();
        if (now - lastRescanAtRef.current > 1000) {
          lastRescanAtRef.current = now;
          if (reconnectRoliLightpad()) {
            finishConnect();
            return;
          }
        }
      }
      connectRoliLightpad().then(() => {
        finishConnect();
      });
    };

    const handleConnectRoli = () => connectApprovedRoli(true);
    const handleMaybeStaleBrowserResume = () => {
      if (document.visibilityState === 'hidden') return;
      if (isRoliStateStale()) connectApprovedRoli(true);
    };
    window.addEventListener(MIDI_CONNECT_ROLI_EVENT, handleConnectRoli);
    window.addEventListener('focus', handleMaybeStaleBrowserResume);
    window.addEventListener('online', handleMaybeStaleBrowserResume);
    window.addEventListener('pageshow', handleMaybeStaleBrowserResume);
    document.addEventListener('visibilitychange', handleMaybeStaleBrowserResume);
    // Auto-connect on mount. SysEx is now granted by useGlobalBrowserMidi at
    // app load and the MIDIAccess object is shared via setRoliMidiAccess, so
    // no separate user approval is needed for the engine to enumerate ROLI
    // ports. The detection banner remains as a manual re-handshake trigger.
    connectApprovedRoli();

    return () => {
      cancelled = true;
      window.removeEventListener('serverRoliStatus', handleServerRoliStatus);
      window.removeEventListener(ROLI_DEVICE_CHANGE_EVENT, handleDeviceChange);
      window.removeEventListener(ROLI_TOUCH_EVENT, handleTouchEvent);
      window.removeEventListener(MIDI_CONNECT_ROLI_EVENT, handleConnectRoli);
      window.removeEventListener('focus', handleMaybeStaleBrowserResume);
      window.removeEventListener('online', handleMaybeStaleBrowserResume);
      window.removeEventListener('pageshow', handleMaybeStaleBrowserResume);
      document.removeEventListener('visibilitychange', handleMaybeStaleBrowserResume);
      // Leave stable engine-level fanout installed — other mounts may still
      // rely on it. Full teardown happens via disconnectRoliLightpad().
    };
  }, [role]);

  const onTouch = useCallback((cb: RoliTouchCallback | null) => {
    touchRef.current = cb;
  }, []);

  const sendFrame = useCallback(
    (opts: Parameters<typeof composeLedFrame>[0], deviceId?: string) => {
      return sendLedFrame(composeLedFrame(opts), deviceId ? { deviceId } : { role });
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
    (pixels: Uint8ClampedArray | Uint8Array, deviceId?: string, forceFullFrame = false) => sendLedFrame(
      pixels,
      deviceId ? { deviceId, forceFullFrame } : { role, forceFullFrame }
    ),
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
