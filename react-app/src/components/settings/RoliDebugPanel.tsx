import React, { useEffect, useState, useCallback } from 'react';
import {
  getRoliDevices,
  getRoliDebugLog,
  subscribeRoliDebugLog,
  forceRoliHandshake,
  sendLedFrame,
  clearLeds,
  setRoliDeviceRole,
  isRoliSysExEnabled,
  registerVirtualRoliDevice,
  unregisterVirtualRoliDevice,
  reconnectRoliLightpad,
  ROLI_GRID_COLS,
  ROLI_GRID_ROWS,
  type RoliDeviceInfo,
  type RoliDebugEvent,
} from '../../engines/roliLightpad';
import { pairRoliOverBluetooth } from '../../engines/roliBleTransport';
import { RoliPatternEditor } from './RoliPatternEditor';
import styles from './RoliDebugPanel.module.scss';

const formatTime = (ts: number): string => {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
};

const formatBytes = (bytes?: number[]): string => {
  if (!bytes || bytes.length === 0) return '';
  return '[' + bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ') + ']';
};

const TRANSPORT_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  usb: { label: '🔌 USB', color: '#a7f3d0', bg: 'rgba(34,197,94,0.18)' },
  bluetooth: { label: '📡 Bluetooth', color: '#bfdbfe', bg: 'rgba(59,130,246,0.22)' },
  'ble-bridge': { label: '🔁 BLE Bridge', color: '#fde68a', bg: 'rgba(250,204,21,0.18)' },
  unknown: { label: '? Unknown', color: '#cbd5e1', bg: 'rgba(148,163,184,0.18)' },
};

const shortId = (id: string): string => {
  if (id.length <= 8) return id;
  return id.slice(0, 4) + '…' + id.slice(-3);
};

const buildSolidColorFrame = (r: number, g: number, b: number): Uint8ClampedArray => {
  const pixels = new Uint8ClampedArray(ROLI_GRID_COLS * ROLI_GRID_ROWS * 4);
  for (let i = 0; i < ROLI_GRID_COLS * ROLI_GRID_ROWS; i++) {
    pixels[i * 4] = r;
    pixels[i * 4 + 1] = g;
    pixels[i * 4 + 2] = b;
    pixels[i * 4 + 3] = 255;
  }
  return pixels;
};

export const RoliDebugPanel: React.FC = () => {
  const [devices, setDevices] = useState<RoliDeviceInfo[]>(() => getRoliDevices());
  const [log, setLog] = useState<RoliDebugEvent[]>(() => getRoliDebugLog());

  // Poll device state at 10Hz for live touch readouts. The engine's
  // setOnTouch is a singleton owned by useRoliLightpad — we can't subscribe
  // to it from here without trampling the global hook.
  useEffect(() => {
    const handle = window.setInterval(() => {
      setDevices(getRoliDevices());
    }, 100);
    return () => window.clearInterval(handle);
  }, []);

  useEffect(() => {
    const unsub = subscribeRoliDebugLog((events) => setLog(events));
    return unsub;
  }, []);

  const handleForceHandshake = useCallback((deviceId: string) => {
    forceRoliHandshake(deviceId);
  }, []);

  const handlePaintTest = useCallback((deviceId: string) => {
    const frame = buildSolidColorFrame(220, 30, 30);
    sendLedFrame(frame, { deviceId });
    window.setTimeout(() => clearLeds({ deviceId }), 600);
  }, []);

  const handleBlank = useCallback((deviceId: string) => {
    clearLeds({ deviceId });
  }, []);

  const handleSwapRole = useCallback((dev: RoliDeviceInfo) => {
    const next = dev.role === 'primary' ? 'colour-wheel' : 'primary';
    setRoliDeviceRole(dev.deviceId, next);
    setDevices(getRoliDevices());
  }, []);

  const [blePairing, setBlePairing] = useState(false);
  const [bleError, setBleError] = useState<string | null>(null);
  const [pairedBle, setPairedBle] = useState<Map<string, () => void>>(new Map());

  const handlePairBluetooth = useCallback(async () => {
    setBleError(null);
    setBlePairing(true);
    try {
      const paired = await pairRoliOverBluetooth();
      const id = registerVirtualRoliDevice({
        id: paired.id,
        name: paired.name,
        input: paired.input,
        output: paired.output,
        transport: 'bluetooth',
      });
      setPairedBle((prev) => {
        const next = new Map(prev);
        next.set(id, paired.disconnect);
        return next;
      });
      setDevices(getRoliDevices());
    } catch (err) {
      setBleError((err as Error).message || 'Pairing cancelled or failed');
    } finally {
      setBlePairing(false);
    }
  }, []);

  const handleUnpairBluetooth = useCallback((deviceId: string) => {
    const teardown = pairedBle.get(deviceId);
    teardown?.();
    unregisterVirtualRoliDevice(deviceId);
    setPairedBle((prev) => {
      const next = new Map(prev);
      next.delete(deviceId);
      return next;
    });
    setDevices(getRoliDevices());
  }, [pairedBle]);

  const handleReconnect = useCallback(() => {
    reconnectRoliLightpad();
    setDevices(getRoliDevices());
  }, []);

  const sysexOk = isRoliSysExEnabled();
  const webBluetoothAvailable = typeof navigator !== 'undefined' && Boolean((navigator as any).bluetooth);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>
          ✦ ROLI Debug
        </span>
        <span className={styles.count}>
          {devices.length} block{devices.length === 1 ? '' : 's'} connected
        </span>
        <span
          className={styles.sysexBadge}
          title={
            sysexOk
              ? 'SysEx granted — ROLI handshake can run'
              : 'SysEx NOT granted — ROLI handshake will fail. Click the URL-bar lock icon → Reset permissions → reload, then accept the MIDI + SysEx prompt.'
          }
          style={{ color: sysexOk ? '#7cffaf' : '#ff7777', marginLeft: 8 }}
        >
          SysEx {sysexOk ? '✓' : '✗'}
        </span>
      </div>

      <div className={styles.subtitle}>
        Live touch + handshake state per Lightpad. Primary block drives PAN/TILT;
        Colour block drives the colour wheel. Swap to flip the assignment.
      </div>

      <RoliPatternEditor />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.4rem 0.6rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleReconnect}
          title="Clear stale ROLI topology state, re-scan Web MIDI ports, and re-run the joined-block handshake"
          style={{
            padding: '0.35rem 0.7rem',
            background: 'rgba(34,197,94,0.18)',
            border: '1px solid rgba(34,197,94,0.45)',
            color: '#a7f3d0',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          Reconnect / Rescan
        </button>
        <button
          type="button"
          onClick={handlePairBluetooth}
          disabled={blePairing || !webBluetoothAvailable}
          title={
            webBluetoothAvailable
              ? 'Open the browser pairing dialog and connect a ROLI block over BLE-MIDI'
              : 'Web Bluetooth not available in this browser'
          }
          style={{
            padding: '0.35rem 0.7rem',
            background: 'rgba(59,130,246,0.22)',
            border: '1px solid rgba(59,130,246,0.5)',
            color: '#bfdbfe',
            borderRadius: 4,
            cursor: webBluetoothAvailable && !blePairing ? 'pointer' : 'not-allowed',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          {blePairing ? 'Pairing…' : '📡 Pair Bluetooth ROLI'}
        </button>
        {!webBluetoothAvailable && (
          <span style={{ fontSize: '0.72rem', color: '#fde68a' }}>
            Web Bluetooth requires Chrome/Edge on Windows/Mac/Linux/Android.
          </span>
        )}
        {bleError && (
          <span style={{ fontSize: '0.78rem', color: '#ff7777' }}>⚠ {bleError}</span>
        )}
      </div>

      <div className={styles.deviceList}>
        {devices.length === 0 ? (
          <div className={styles.empty}>
            No ROLI blocks detected. Plug one in and grant browser MIDI permission.
          </div>
        ) : (
          devices.map((dev) => {
            const touching = dev.isTouching;
            const touchText = touching
              ? `x:${dev.lastX.toFixed(2)} y:${dev.lastY.toFixed(2)} z:${dev.lastZ.toFixed(2)}`
              : 'idle';
            return (
              <div key={dev.deviceId} className={styles.deviceRow}>
                <div className={styles.deviceMeta}>
                  <span className={styles.deviceName}>
                    <span
                      className={`${styles.statusDot} ${dev.handshakeDone ? styles.ready : ''}`}
                      title={dev.handshakeDone ? 'handshake complete' : 'handshake pending'}
                    />
                    {dev.outputName || dev.inputName || 'Lightpad'}
                  </span>
                  <span className={styles.deviceId} title={dev.deviceId}>
                    {shortId(dev.deviceId)}
                  </span>
                  <span
                    title={`Transport: ${dev.transport}`}
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.4rem',
                      borderRadius: 3,
                      marginLeft: 6,
                      color: (TRANSPORT_BADGE[dev.transport] ?? TRANSPORT_BADGE.unknown).color,
                      background: (TRANSPORT_BADGE[dev.transport] ?? TRANSPORT_BADGE.unknown).bg,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {(TRANSPORT_BADGE[dev.transport] ?? TRANSPORT_BADGE.unknown).label}
                  </span>
                  {dev.lastError && (
                    <span
                      style={{ color: '#ff7777', fontSize: '0.78em', marginLeft: 6 }}
                      title={dev.lastError}
                    >
                      ⚠ {dev.lastError}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                  <span className={styles.rolePill}>
                    {dev.role === 'primary' ? 'Primary' : 'Colour'}
                  </span>
                  <span style={{ fontSize: '0.7em', color: '#9aa', whiteSpace: 'nowrap' }}>
                    → {dev.role === 'primary' ? 'PAN / TILT' : 'COLOR WHEEL'}
                  </span>
                </div>

                <span className={`${styles.touchReadout} ${touching ? styles.live : ''}`}>
                  {touchText}
                </span>

                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => handleSwapRole(dev)}
                    title="Swap PAN/TILT ↔ COLOR WHEEL between the two blocks"
                  >
                    Swap
                  </button>
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => handleForceHandshake(dev.deviceId)}
                    title="Re-run the ACK-driven handshake sequence"
                  >
                    Handshake
                  </button>
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => handlePaintTest(dev.deviceId)}
                    disabled={!dev.handshakeDone}
                    title="Light all 225 LEDs red for 600 ms"
                  >
                    Paint test
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.danger}`}
                    onClick={() => handleBlank(dev.deviceId)}
                    disabled={!dev.handshakeDone}
                  >
                    Blank
                  </button>
                  {pairedBle.has(dev.deviceId) && (
                    <button
                      type="button"
                      className={`${styles.actionButton} ${styles.danger}`}
                      onClick={() => handleUnpairBluetooth(dev.deviceId)}
                      title="Disconnect this Bluetooth ROLI"
                    >
                      Unpair
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={styles.logHeader}>
        <span>SysEx log (last {log.length} events)</span>
      </div>
      <pre className={styles.log}>
        {log.length === 0 ? (
          <span className={styles.logEmpty}>
            No SysEx activity yet. Plug a block in or click Handshake.
          </span>
        ) : (
          log
            .slice()
            .reverse()
            .map((ev, i) => (
              <div key={`${ev.ts}-${i}`}>
                {formatTime(ev.ts)}{'  '}
                <span className={`${styles.kind} ${styles[ev.kind] ?? ''}`}>
                  {ev.kind.toUpperCase()}
                </span>
                {'  '}
                {shortId(ev.deviceId).padEnd(10)}
                {ev.bytes ? ' ' + formatBytes(ev.bytes) : ''}
                {ev.note ? '  ' + ev.note : ''}
              </div>
            ))
        )}
      </pre>
    </div>
  );
};

export default RoliDebugPanel;
