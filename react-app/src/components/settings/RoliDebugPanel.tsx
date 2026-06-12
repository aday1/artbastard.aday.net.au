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
  ROLI_GRID_COLS,
  ROLI_GRID_ROWS,
  type RoliDeviceInfo,
  type RoliDebugEvent,
} from '../../engines/roliLightpad';
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

  const sysexOk = isRoliSysExEnabled();

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
