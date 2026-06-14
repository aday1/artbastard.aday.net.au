import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store';
import { useRoliLightpad } from '../../hooks/useRoliLightpad';
import {
  colourFromTouch,
  composeColourWheelFrame,
  paintColourWheel,
} from '../../engines/roliColourWheel';
import {
  fixtureHasColorWheel,
  getFirstFixtureColorWheelSlots,
  nearestColorWheelSlotFromHue,
} from '../../fixtures/colorWheelSlots';
import styles from './RoliColourWheel.module.scss';

type ColourTriplet = { r: number; g: number; b: number; hex: string } | null;

export const ROLI_RGB_STRIP_CHANGE_EVENT = 'artbastard:roli-rgb-strip-change';

export const RoliColourWheel: React.FC = () => {
  const roli = useRoliLightpad({ role: 'colour-wheel' });
  const selectedIds = useStore((s) => s.selectedFixtures);
  const fixtures = useStore((s) => s.fixtures);
  const applySuperControlMidi = useStore((s) => s.applySuperControlMidi);

  const [colour, setColour] = useState<ColourTriplet>(null);
  const lastTouchAtRef = useRef<number>(0);
  const liveCursorRef = useRef<{ x: number; y: number } | null>(null);

  // Selected fixtures resolved to objects that actually have RGB channels.
  const rgbTargets = useMemo(() => {
    const targets: Array<{ id: string; name: string }> = [];
    for (const id of selectedIds) {
      const fixture = fixtures.find((f) => f.id === id);
      if (!fixture) continue;
      const hasRgb = fixture.channels.some((ch) => {
        const t = (ch.type || '').toLowerCase();
        return t === 'red' || t === 'r' || t === 'green' || t === 'g' || t === 'blue' || t === 'b';
      });
      if (hasRgb) {
        targets.push({ id: fixture.id, name: fixture.name });
      }
    }
    return targets;
  }, [selectedIds, fixtures]);

  const colorWheelTargets = useMemo(() => {
    return selectedIds
      .map((id) => fixtures.find((fixture) => fixture.id === id))
      .filter((fixture): fixture is NonNullable<typeof fixture> => Boolean(fixture && fixtureHasColorWheel(fixture)));
  }, [selectedIds, fixtures]);

  const colorWheelSlots = useMemo(() => getFirstFixtureColorWheelSlots(colorWheelTargets), [colorWheelTargets]);

  // Repaint the strip once on handshake and again whenever the engine
  // reports a new device list (e.g. the colour-wheel block reconnected).
  useEffect(() => {
    if (!roli.handshakeDone) return;
    liveCursorRef.current = null;
    paintColourWheel();
  }, [roli.handshakeDone, roli.devices]);

  // Touch handler — convert touch coords to RGB colour and write RGB DMX.
  // Also tracks a live cursor on the strip: bright pixel follows the finger
  // while pressed, and stays painted at the release spot ("locked colour").
  useEffect(() => {
    const handleColourTouch = (ev: {
      x: number;
      y: number;
      z: number;
      phase: 'start' | 'move' | 'end';
      role?: string;
      sourceTransport?: string;
    }) => {
      if (!ev || (ev.sourceTransport !== 'server' && ev.role && ev.role !== 'colour-wheel')) return;
      if (ev.phase === 'end') {
        liveCursorRef.current = null;
        if (ev.sourceTransport !== 'server') paintColourWheel();
        return;
      }
      if (ev.z < 0.05) return;
      const c = colourFromTouch(ev.x, ev.y, 1);
      const nearestWheelSlot = nearestColorWheelSlotFromHue(colorWheelSlots, c.h, c.s, { r: c.r, g: c.g, b: c.b });
      lastTouchAtRef.current = Date.now();
      liveCursorRef.current = { x: ev.x, y: ev.y };
      setColour({
        r: nearestWheelSlot ? parseInt(nearestWheelSlot.hex.slice(1, 3), 16) : c.r,
        g: nearestWheelSlot ? parseInt(nearestWheelSlot.hex.slice(3, 5), 16) : c.g,
        b: nearestWheelSlot ? parseInt(nearestWheelSlot.hex.slice(5, 7), 16) : c.b,
        hex: nearestWheelSlot?.hex ?? c.hex,
      });
      if (nearestWheelSlot) {
        applySuperControlMidi('color_wheel', nearestWheelSlot.value);
      }
      window.dispatchEvent(new CustomEvent(ROLI_RGB_STRIP_CHANGE_EVENT, {
        detail: {
          r: c.r,
          g: c.g,
          b: c.b,
          colorWheelValue: nearestWheelSlot?.value,
          colorWheelLabel: nearestWheelSlot?.label,
        },
      }));
      if (ev.sourceTransport !== 'server') paintColourWheel({ cursor: liveCursorRef.current, cursorColor: [255, 255, 255, 255] });
    };

    roli.onTouch(handleColourTouch);
    const handleServerRoliTouch = (event: Event) => handleColourTouch((event as CustomEvent).detail);
    window.addEventListener('serverRoliTouch', handleServerRoliTouch);
    return () => {
      roli.onTouch(null);
      window.removeEventListener('serverRoliTouch', handleServerRoliTouch);
    };
  }, [applySuperControlMidi, colorWheelSlots, roli]);

  const handleRepaint = useCallback(() => {
    liveCursorRef.current = null;
    paintColourWheel();
  }, []);

  // Render a small preview of the strip pattern in the panel so the user
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
        <span className={styles.title}>ROLI RGB Strip</span>
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
          width={96}
          height={48}
          className={`${styles.swatch} ${styles.surfacePreview}`}
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
            {colour
              ? colorWheelSlots.length > 0
                ? `nearest wheel slot ${colour.hex}`
                : `R ${colour.r}  G ${colour.g}  B ${colour.b}`
              : 'touch the strip to paint'}
          </span>
        </div>
      </div>

      <div className={styles.targets}>
        {colorWheelTargets.length > 0 ? (
          <>Wheel targets: {colorWheelTargets.map((t) => t.name).join(', ')}</>
        ) : rgbTargets.length > 0 ? (
          <>Targets: {rgbTargets.map((t) => t.name).join(', ')}</>
        ) : (
          <span className={styles.none}>Select RGB or color-wheel fixtures to drive their colour.</span>
        )}
      </div>

      <div className={styles.actions}>
        <button type="button" onClick={handleRepaint} disabled={!roli.handshakeDone}>
          Repaint strip
        </button>
      </div>
    </div>
  );
};

export default RoliColourWheel;
