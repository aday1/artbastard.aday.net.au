import React, { useCallback, useEffect, useState } from 'react';
import {
  DEMO_PATTERNS,
  DemoPatternId,
  getApc40DemoSpeed,
  isApc40DemoRunning,
  isApc40DemoShuffling,
  setApc40DemoSpeed,
  startApc40Demo,
  startApc40DemoShuffle,
  stopApc40Demo,
} from '../../engines/apc40Demoscene';
import {
  isFlourishesEnabled,
  setFlourishesEnabled,
} from '../../engines/apc40Flourishes';
import {
  APC40_FLOURISH_KIND_LABELS,
  APC40_FLOURISH_KINDS,
  APC40_FLOURISH_PATTERN_OPTIONS,
  getApc40FlourishSettings,
  setApc40FlourishPattern,
  setApc40RandomFlourishes,
} from '../../engines/apc40FlourishSettings';
import {
  getApc40ScreensaverConfig,
  setApc40ScreensaverConfig,
} from '../../engines/apc40Screensaver';
import {
  isApc40XyCrosshairEnabled,
  setApc40XyCrosshairEnabled,
} from '../../engines/apc40XyCrosshair';
import styles from './Apc40Demoscene.module.scss';

/**
 * Easter-egg demoscene tester for the APC40. Lives near the hardware-surface
 * card in the MIDI/OSC setup so a curious user pokes "Test" and the grid
 * (and activator strip) come alive.
 */
const SPEED_STEPS = [0.25, 0.5, 1, 2, 4] as const;
const SCREENSAVER_ROTATE_STEPS = [4000, 8000, 16000, 30000] as const;

export const Apc40Demoscene: React.FC = () => {
  const [active, setActive] = useState<DemoPatternId | null>(null);
  const [shuffling, setShuffling] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(() => getApc40DemoSpeed());
  const [flourishes, setFlourishes] = useState<boolean>(() => isFlourishesEnabled());
  const [flourishSettings, setFlourishSettings] = useState(() => getApc40FlourishSettings());
  const [screensaver, setScreensaver] = useState(() => getApc40ScreensaverConfig());
  const [xyCrosshair, setXyCrosshair] = useState<boolean>(() => isApc40XyCrosshairEnabled());

  // Keep UI in sync if the engine stops on its own (e.g. page navigation).
  useEffect(() => {
    const handle = window.setInterval(() => {
      const running = isApc40DemoRunning();
      if (!running) {
        if (active != null) setActive(null);
        if (shuffling) setShuffling(false);
      } else if (isApc40DemoShuffling() !== shuffling) {
        setShuffling(isApc40DemoShuffling());
      }
    }, 500);
    return () => window.clearInterval(handle);
  }, [active, shuffling]);

  useEffect(() => () => stopApc40Demo(), []);

  const startPattern = useCallback(
    async (id: DemoPatternId) => {
      setActive(id);
      setShuffling(false);
      const ok = await startApc40Demo({
        patternId: id,
        speed,
        onStop: () => setActive(null),
      });
      if (!ok) setActive(null);
    },
    [speed],
  );

  const handleStop = useCallback(() => {
    stopApc40Demo();
    setActive(null);
    setShuffling(false);
  }, []);

  const handleShuffle = useCallback(async () => {
    if (shuffling) {
      stopApc40Demo();
      setActive(null);
      setShuffling(false);
      return;
    }
    setShuffling(true);
    const ok = await startApc40DemoShuffle({
      speed,
      onStop: () => {
        setShuffling(false);
        setActive(null);
      },
    });
    if (!ok) setShuffling(false);
  }, [shuffling, speed]);

  const handleSpeed = useCallback((next: number) => {
    setSpeed(next);
    setApc40DemoSpeed(next);
  }, []);

  const handleFlourishes = useCallback(() => {
    const next = !flourishes;
    setFlourishes(next);
    setFlourishesEnabled(next);
  }, [flourishes]);

  const handleRandomFlourishes = useCallback(() => {
    setFlourishSettings(setApc40RandomFlourishes(!flourishSettings.random));
  }, [flourishSettings.random]);

  const handleFlourishPattern = useCallback((kind: (typeof APC40_FLOURISH_KINDS)[number], patternId: DemoPatternId) => {
    setFlourishSettings(setApc40FlourishPattern(kind, patternId));
  }, []);

  const handleScreensaverEnabled = useCallback(() => {
    setScreensaver(setApc40ScreensaverConfig({ enabled: !screensaver.enabled }));
  }, [screensaver.enabled]);

  const handleScreensaverRotate = useCallback((rotateMs: number) => {
    setScreensaver(setApc40ScreensaverConfig({ rotateMs }));
  }, []);

  const handleScreensaverSpeed = useCallback((next: number) => {
    setScreensaver(setApc40ScreensaverConfig({ speed: next }));
  }, []);

  const handleXyCrosshair = useCallback(() => {
    const next = !xyCrosshair;
    setXyCrosshair(next);
    setApc40XyCrosshairEnabled(next);
  }, [xyCrosshair]);

  const statusLabel = shuffling
    ? `shuffle · ${active ?? '…'}`
    : active
      ? `running · ${active}`
      : 'idle';

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>
          <span className={styles.sparkle}>✦</span>
          APC40 Demoscene · Test
        </span>
        <span className={`${styles.status} ${active || shuffling ? styles.live : ''}`}>
          {statusLabel}
        </span>
      </div>

      <div className={styles.subtitle}>
        LED animations on the 5×8 clip grid and activator strip. Pure easter egg —
        hit Stop and normal feedback resumes.
      </div>

      <div className={styles.patterns}>
        {DEMO_PATTERNS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={active === p.id ? styles.active : ''}
            onClick={() => startPattern(p.id)}
            title={p.renderStrip ? `${p.label} (grid + strip)` : `${p.label} (grid)`}
          >
            {p.label}
            {p.renderStrip ? ' ✦' : ''}
          </button>
        ))}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={shuffling ? styles.active : ''}
          onClick={handleShuffle}
        >
          {shuffling ? 'Shuffle: ON' : 'Shuffle'}
        </button>
        <button
          type="button"
          className={flourishes ? styles.active : ''}
          onClick={handleFlourishes}
          title="Auto-fire LED flourishes on fixture select, crossfade, blackout, etc."
        >
          {flourishes ? 'Flourishes: ON' : 'Flourishes: OFF'}
        </button>
        <button
          type="button"
          className={flourishSettings.random ? styles.active : ''}
          onClick={handleRandomFlourishes}
          title="Use curated random animations for each flourish kind"
        >
          {flourishSettings.random ? 'Random flourishes: ON' : 'Random flourishes: OFF'}
        </button>
        <button
          type="button"
          className={xyCrosshair ? styles.active : ''}
          onClick={handleXyCrosshair}
          title="Mirror SuperControl XY movement as a crosshair on the APC40 clip grid"
        >
          {xyCrosshair ? 'XY crosshair: ON' : 'XY crosshair: OFF'}
        </button>
        <button
          type="button"
          className={styles.danger}
          onClick={handleStop}
          disabled={!active && !shuffling}
        >
          Stop
        </button>
      </div>

      <div className={styles.settingsGrid}>
        {APC40_FLOURISH_KINDS.map((kind) => (
          <label key={kind} className={styles.field}>
            <span>{APC40_FLOURISH_KIND_LABELS[kind]}</span>
            <select
              value={flourishSettings.patterns[kind]}
              onChange={(event) => handleFlourishPattern(kind, event.target.value as DemoPatternId)}
              disabled={flourishSettings.random}
            >
              {APC40_FLOURISH_PATTERN_OPTIONS[kind].map((patternId) => {
                const pattern = DEMO_PATTERNS.find((candidate) => candidate.id === patternId);
                return (
                  <option key={patternId} value={patternId}>
                    {pattern?.label ?? patternId}
                  </option>
                );
              })}
            </select>
          </label>
        ))}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={screensaver.enabled ? styles.active : ''}
          onClick={handleScreensaverEnabled}
        >
          {screensaver.enabled ? 'Screensaver: ON' : 'Screensaver: OFF'}
        </button>
        {SCREENSAVER_ROTATE_STEPS.map((rotateMs) => (
          <button
            key={rotateMs}
            type="button"
            className={screensaver.rotateMs === rotateMs ? styles.active : ''}
            onClick={() => handleScreensaverRotate(rotateMs)}
            title={`${rotateMs / 1000}s`}
          >
            {rotateMs / 1000}s
          </button>
        ))}
      </div>

      <div className={styles.actions}>
        <span style={{ alignSelf: 'center', fontSize: '0.7rem', opacity: 0.75 }}>
          Saver speed
        </span>
        {SPEED_STEPS.map((step) => (
          <button
            key={step}
            type="button"
            className={Math.abs(screensaver.speed - step) < 0.01 ? styles.active : ''}
            onClick={() => handleScreensaverSpeed(step)}
            title={`${step}×`}
          >
            {step === 1 ? '1×' : `${step}×`}
          </button>
        ))}
      </div>

      <div className={styles.actions}>
        <span style={{ alignSelf: 'center', fontSize: '0.7rem', opacity: 0.75 }}>
          Speed
        </span>
        {SPEED_STEPS.map((step) => (
          <button
            key={step}
            type="button"
            className={Math.abs(speed - step) < 0.01 ? styles.active : ''}
            onClick={() => handleSpeed(step)}
            title={`${step}×`}
          >
            {step === 1 ? '1×' : `${step}×`}
          </button>
        ))}
      </div>

      <div className={styles.note}>
        Requires an APC40 plugged in and the browser MIDI permission granted.
        Patterns marked ✦ also light the activator row. Shuffle rotates every ~8s.
        Flourishes use the selected animation unless random mode is enabled.
      </div>
    </div>
  );
};

export default Apc40Demoscene;
