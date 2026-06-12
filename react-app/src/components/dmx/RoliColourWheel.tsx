import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store';
import { useRoliLightpad } from '../../hooks/useRoliLightpad';
import {
  colourFromTouch,
  composeColourWheelFrame,
  paintColourWheel,
} from '../../engines/roliColourWheel';
import type { Fixture } from '../../store';
import styles from './RoliColourWheel.module.scss';

type ColourTriplet = { r: number; g: number; b: number; hex: string } | null;

const findRgbChannels = (fixture: Fixture) => {
  const lookup: Record<string, number | undefined> = {};
  fixture.channels.forEach((ch) => {
    const t = (ch.type || '').toLowerCase();
    if ((t === 'red' || t === 'r') && lookup.r == null) lookup.r = ch.dmxAddress;
    if ((t === 'green' || t === 'g') && lookup.g == null) lookup.g = ch.dmxAddress;
    if ((t === 'blue' || t === 'b') && lookup.b == null) lookup.b = ch.dmxAddress;
  });
  return lookup;
};

export const RoliColourWheel: React.FC = () => {
  const roli = useRoliLightpad({ role: 'colour-wheel' });
  const selectedIds = useStore((s) => s.selectedFixtures);
  const fixtures = useStore((s) => s.fixtures);
  const setDmxChannelValue = useStore((s) => s.setDmxChannelValue);

  const [colour, setColour] = useState<ColourTriplet>(null);
  const lastTouchAtRef = useRef<number>(0);

  // Selected fixtures resolved to objects that actually have RGB channels.
  const rgbTargets = useMemo(() => {
    const targets: Array<{ fixture: Fixture; r?: number; g?: number; b?: number }> = [];
    for (const id of selectedIds) {
      const fixture = fixtures.find((f) => f.id === id);
      if (!fixture) continue;
      const ch = findRgbChannels(fixture);
      if (ch.r != null || ch.g != null || ch.b != null) {
        targets.push({ fixture, r: ch.r, g: ch.g, b: ch.b });
      }
    }
    return targets;
  }, [selectedIds, fixtures]);

  // Repaint the wheel once on handshake and again whenever the engine
  // reports a new device list (e.g. the colour-wheel block reconnected).
  useEffect(() => {
    if (!roli.handshakeDone) return;
    paintColourWheel();
  }, [roli.handshakeDone, roli.devices]);

  // Touch handler — convert touch coords to HSV colour and write RGB DMX.
  useEffect(() => {
    roli.onTouch((ev) => {
      if (ev.phase === 'end') return; // wheel stays painted; no clear on lift
      if (ev.z < 0.05) return;
      const c = colourFromTouch(ev.x, ev.y, 1);
      lastTouchAtRef.current = Date.now();
      setColour({ r: c.r, g: c.g, b: c.b, hex: c.hex });
      for (const t of rgbTargets) {
        if (t.r != null) setDmxChannelValue(t.r, c.r);
        if (t.g != null) setDmxChannelValue(t.g, c.g);
        if (t.b != null) setDmxChannelValue(t.b, c.b);
      }
    });
    return () => roli.onTouch(null);
  }, [roli, rgbTargets, setDmxChannelValue]);

  const handleRepaint = useCallback(() => {
    paintColourWheel();
  }, []);

  // Render a small 1:1 preview of the wheel pattern in the panel so the user
  // can see what the physical block looks like, even when it's not visible.
  const previewRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = previewRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const buf = composeColourWheelFrame();
    const img = ctx.createImageData(15, 15);
    img.data.set(buf);
    const tmp = document.createElement('canvas');
    tmp.width = 15;
    tmp.height = 15;
    tmp.getContext('2d')?.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(tmp, 0, 0, cv.width, cv.height);
  }, []);

  const statusClass = roli.connected
    ? roli.handshakeDone
      ? styles.live
      : styles.idle
    : styles.idle;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>ROLI Colour Wheel</span>
        <span className={`${styles.status} ${statusClass}`}>
          {roli.connected
            ? roli.handshakeDone
              ? 'live'
              : 'waiting'
            : 'no block'}
        </span>
      </div>

      <div className={styles.row}>
        <canvas
          ref={previewRef}
          width={60}
          height={60}
          className={styles.swatch}
          style={{ imageRendering: 'pixelated', padding: 0 }}
        />
        <div
          className={styles.swatch}
          style={{ backgroundColor: colour?.hex ?? '#101321' }}
          aria-label="Current colour swatch"
        />
        <div className={styles.info}>
          <span className={styles.hex}>{colour?.hex ?? '—'}</span>
          <span className={styles.triplet}>
            {colour ? `R ${colour.r}  G ${colour.g}  B ${colour.b}` : 'touch the wheel to paint'}
          </span>
        </div>
      </div>

      <div className={styles.targets}>
        {rgbTargets.length > 0 ? (
          <>Targets: {rgbTargets.map((t) => t.fixture.name).join(', ')}</>
        ) : (
          <span className={styles.none}>Select RGB fixtures to drive their colour.</span>
        )}
      </div>

      <div className={styles.actions}>
        <button type="button" onClick={handleRepaint} disabled={!roli.handshakeDone}>
          Repaint wheel
        </button>
      </div>
    </div>
  );
};

export default RoliColourWheel;
