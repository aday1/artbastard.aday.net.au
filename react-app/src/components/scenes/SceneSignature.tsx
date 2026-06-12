import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Fixture, Scene } from '../../store';
import { computeSceneDiff } from '../../selectors/sceneDiff';
import styles from './SceneSignature.module.scss';

interface SceneSignatureProps {
  scene: Scene;
  previousScene?: Scene | null;
  fixtures: Fixture[];
  channelNames?: string[];
  topValueCount?: number;
}

const HUE_BY_TYPE: Record<string, number> = {
  red: 0,
  green: 120,
  blue: 220,
  white: 60,
  dimmer: 45,
  strobe: 300,
  pan: 200,
  pan_fine: 200,
  tilt: 280,
  tilt_fine: 280,
  color_wheel: 330,
  gobo: 160,
  gobo_wheel: 160,
  focus: 180,
  zoom: 190,
  frost: 175,
  prism: 320,
  prism_rotation: 320,
  speed: 90,
  macro: 30,
  effect: 15,
  lamp: 50,
  reset: 0,
};

const channelTypeForIndex = (fixtures: Fixture[], index: number): string | null => {
  const dmx = index + 1;
  for (const f of fixtures) {
    const start = f.startAddress;
    const end = start + f.channels.length - 1;
    if (dmx >= start && dmx <= end) {
      return f.channels[dmx - start]?.type ?? null;
    }
  }
  return null;
};

const fixtureNameForIndex = (fixtures: Fixture[], index: number): string | null => {
  const dmx = index + 1;
  for (const f of fixtures) {
    const start = f.startAddress;
    const end = start + f.channels.length - 1;
    if (dmx >= start && dmx <= end) return f.name;
  }
  return null;
};

const fixtureNameById = (fixtures: Fixture[], id: string): string => {
  return fixtures.find((f) => f.id === id)?.name ?? id;
};

const hsvToRgb = (h: number, s: number, v: number): [number, number, number] => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
};

const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 28;

export const SceneSignature: React.FC<SceneSignatureProps> = ({
  scene,
  previousScene,
  fixtures,
  channelNames,
  topValueCount = 4,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const node = wrapperRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  const diff = useMemo(
    () => computeSceneDiff(previousScene, scene, fixtures),
    [scene, previousScene, fixtures],
  );

  const changedFixtureNames = useMemo(() => {
    const ids = new Set<string>();
    diff.addedFixtures.forEach((id) => ids.add(id));
    diff.removedFixtures.forEach((id) => ids.add(id));
    diff.changedChannels.forEach((ch) => {
      const name = fixtureNameForIndex(fixtures, ch);
      if (name) {
        const f = fixtures.find((x) => x.name === name);
        if (f) ids.add(f.id);
      }
    });
    return Array.from(ids).map((id) => fixtureNameById(fixtures, id));
  }, [diff, fixtures]);

  const topValues = useMemo(() => {
    const values = scene.channelValues ?? [];
    const changedSet = new Set(diff.changedChannels);
    const lit = values
      .map((v, i) => ({ i, v }))
      .filter((p) => p.v > 0)
      .sort((a, b) => {
        const aChanged = changedSet.has(a.i) ? 1 : 0;
        const bChanged = changedSet.has(b.i) ? 1 : 0;
        if (aChanged !== bChanged) return bChanged - aChanged;
        return b.v - a.v;
      })
      .slice(0, topValueCount);
    return lit;
  }, [scene.channelValues, diff.changedChannels, topValueCount]);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const values = scene.channelValues ?? [];
    const len = Math.max(values.length, 1);
    const img = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
    for (let px = 0; px < CANVAS_WIDTH; px++) {
      const ch = Math.floor((px / CANVAS_WIDTH) * len);
      const v = values[ch] ?? 0;
      const type = channelTypeForIndex(fixtures, ch);
      const hue = type != null ? HUE_BY_TYPE[type] ?? 210 : 210;
      const intensity = v / 255;
      const sat = type === 'dimmer' || type == null ? 0.15 : 0.85;
      const val = 0.12 + intensity * 0.88;
      const [r, g, b] = hsvToRgb(hue, sat, val);
      for (let y = 0; y < CANVAS_HEIGHT; y++) {
        const idx = (y * CANVAS_WIDTH + px) * 4;
        img.data[idx + 0] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [visible, scene.channelValues, fixtures]);

  if (!visible) {
    return <div ref={wrapperRef} className={styles.placeholder} aria-hidden="true" />;
  }

  return (
    <div ref={wrapperRef} className={styles.signature}>
      <div className={styles.changes}>
        <span className={styles.label}>Changes:</span>
        {changedFixtureNames.length > 0 ? (
          changedFixtureNames.map((n, i) => <span key={`${n}-${i}`}>{n}</span>)
        ) : (
          <span className={styles.none}>same as previous</span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        className={styles.heatmap}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
      />
      <div className={styles.values}>
        {topValues.length > 0 ? (
          topValues.map(({ i, v }) => {
            const label =
              channelNames?.[i] && !/^Channel\s+\d+$|^CH\s+\d+$/.test(channelNames[i])
                ? channelNames[i]
                : `CH ${i + 1}`;
            return (
              <div key={i} className={styles.pair}>
                <span className={styles.channel}>{label}</span>
                <span className={styles.value}>{v}</span>
              </div>
            );
          })
        ) : (
          <span className={styles.empty}>blackout</span>
        )}
      </div>
    </div>
  );
};

export default SceneSignature;
