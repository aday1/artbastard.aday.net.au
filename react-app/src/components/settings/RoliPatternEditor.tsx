import React, { useMemo, useState } from 'react';
import {
  ROLI_GRID_COLS,
  ROLI_GRID_ROWS,
  clearLeds,
  getRoliDevices,
  sendLedFrame,
} from '../../engines/roliLightpad';
import styles from './RoliPatternEditor.module.scss';

const STORAGE_KEY = 'artbastard.roli.pattern.v1';
const CELL_COUNT = ROLI_GRID_COLS * ROLI_GRID_ROWS;
const EMPTY = '#000000';
const DEFAULT_SWATCHES = ['#ff2d55', '#ff9f0a', '#ffd60a', '#32d74b', '#64d2ff', '#0a84ff', '#bf5af2', '#ffffff'];

const normalizeColor = (value: unknown) => {
  if (typeof value !== 'string') return EMPTY;
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : EMPTY;
};

const loadPattern = (): string[] => {
  if (typeof window === 'undefined') return Array(CELL_COUNT).fill(EMPTY);
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return Array(CELL_COUNT).fill(EMPTY);
    return Array.from({ length: CELL_COUNT }, (_, index) => normalizeColor(parsed[index]));
  } catch {
    return Array(CELL_COUNT).fill(EMPTY);
  }
};

const savePattern = (pixels: string[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pixels));
};

const hexToRgb = (hex: string): [number, number, number] => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const buildFrame = (pixels: string[]) => {
  const frame = new Uint8ClampedArray(CELL_COUNT * 4);
  pixels.forEach((hex, index) => {
    const [r, g, b] = hexToRgb(hex);
    frame[index * 4] = r;
    frame[index * 4 + 1] = g;
    frame[index * 4 + 2] = b;
    frame[index * 4 + 3] = hex === EMPTY ? 0 : 255;
  });
  return frame;
};

export const RoliPatternEditor: React.FC = () => {
  const [pixels, setPixels] = useState<string[]>(loadPattern);
  const [activeColor, setActiveColor] = useState(DEFAULT_SWATCHES[0]);
  const [eraseMode, setEraseMode] = useState(false);
  const [painting, setPainting] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const devices = getRoliDevices();

  const paintedCount = useMemo(() => pixels.filter((pixel) => pixel !== EMPTY).length, [pixels]);

  const paintCell = (index: number) => {
    setPixels((prev) => {
      const next = [...prev];
      next[index] = eraseMode ? EMPTY : activeColor;
      savePattern(next);
      return next;
    });
  };

  const clearPattern = () => {
    const next = Array(CELL_COUNT).fill(EMPTY);
    setPixels(next);
    savePattern(next);
  };

  const fillPattern = () => {
    const next = Array(CELL_COUNT).fill(activeColor);
    setPixels(next);
    savePattern(next);
  };

  const sendPattern = () => {
    sendLedFrame(buildFrame(pixels), { deviceId: deviceId || undefined, forceFullFrame: true });
  };

  const blankDevice = () => {
    clearLeds({ deviceId: deviceId || undefined });
  };

  return (
    <section className={styles.editor} aria-label="ROLI draw pattern editor">
      <div className={styles.header}>
        <div>
          <strong>Draw Pattern</strong>
          <span>{paintedCount}/{CELL_COUNT} lit pixels</span>
        </div>
        <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
          <option value="">Primary block</option>
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.outputName || device.inputName || device.deviceId}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.controls}>
        <input type="color" value={activeColor} onChange={(event) => setActiveColor(event.target.value)} />
        <div className={styles.swatches}>
          {DEFAULT_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Use ${swatch}`}
              className={activeColor === swatch && !eraseMode ? styles.activeSwatch : ''}
              style={{ backgroundColor: swatch }}
              onClick={() => {
                setActiveColor(swatch);
                setEraseMode(false);
              }}
            />
          ))}
        </div>
        <button type="button" className={eraseMode ? styles.activeButton : ''} onClick={() => setEraseMode((value) => !value)}>
          Erase
        </button>
        <button type="button" onClick={fillPattern}>Fill</button>
        <button type="button" onClick={clearPattern}>Clear grid</button>
        <button type="button" onClick={sendPattern}>Send</button>
        <button type="button" onClick={blankDevice}>Blank LEDs</button>
      </div>

      <div
        className={styles.grid}
        onPointerLeave={() => setPainting(false)}
        onPointerUp={() => setPainting(false)}
      >
        {pixels.map((pixel, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Pixel ${index + 1}`}
            className={pixel !== EMPTY ? styles.litCell : ''}
            style={{ backgroundColor: pixel }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setPainting(true);
              paintCell(index);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              setPainting(false);
            }}
            onPointerCancel={(event) => {
              if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              setPainting(false);
            }}
            onPointerEnter={() => {
              if (painting) paintCell(index);
            }}
          />
        ))}
      </div>
    </section>
  );
};

export default RoliPatternEditor;
