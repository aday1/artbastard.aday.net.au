import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store';
import styles from './DmxActivityGlow.module.scss';

const LEVEL_CONFIG = {
  low: { cooldownMs: 220, releaseMs: 180, opacity: 0.12 },
  medium: { cooldownMs: 130, releaseMs: 240, opacity: 0.2 },
  high: { cooldownMs: 80, releaseMs: 320, opacity: 0.3 },
} as const;

type GlowLevel = keyof typeof LEVEL_CONFIG;

const getChangedEnergy = (previous: number[], next: number[]) => {
  let changed = 0;
  let delta = 0;

  for (let i = 0; i < next.length; i += 1) {
    const before = previous[i] ?? 0;
    const after = next[i] ?? 0;
    if (before === after) continue;
    changed += 1;
    delta += Math.abs(after - before);
  }

  if (!changed) return 0;
  return Math.min(1, (changed / 16) + (delta / 2048));
};

export const DmxActivityGlow: React.FC = () => {
  const dmxChannels = useStore((state) => state.dmxChannels);
  const dmxVisualEffects = useStore((state) => state.uiSettings?.dmxVisualEffects ?? 'medium');
  const [activity, setActivity] = useState(0);
  const previousChannelsRef = useRef<number[]>(dmxChannels);
  const lastGlowRef = useRef(0);
  const releaseTimerRef = useRef<number | null>(null);

  const config = useMemo(() => {
    if (dmxVisualEffects === 'off') return null;
    return LEVEL_CONFIG[dmxVisualEffects as GlowLevel] ?? LEVEL_CONFIG.medium;
  }, [dmxVisualEffects]);

  useEffect(() => {
    if (!config) {
      setActivity(0);
      previousChannelsRef.current = dmxChannels;
      return undefined;
    }

    const energy = getChangedEnergy(previousChannelsRef.current, dmxChannels);
    previousChannelsRef.current = dmxChannels;

    if (!energy) return undefined;

    const now = window.performance.now();
    if (now - lastGlowRef.current < config.cooldownMs) return undefined;
    lastGlowRef.current = now;

    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current);
    }

    setActivity(Math.max(0.35, energy));
    releaseTimerRef.current = window.setTimeout(() => {
      setActivity(0);
      releaseTimerRef.current = null;
    }, config.releaseMs);

    return undefined;
  }, [config, dmxChannels]);

  useEffect(() => {
    return () => {
      if (releaseTimerRef.current !== null) {
        window.clearTimeout(releaseTimerRef.current);
      }
    };
  }, []);

  if (!config) return null;

  const opacity = Number((config.opacity * activity).toFixed(3));
  const scale = Number((0.55 + activity * 0.45).toFixed(3));
  const glowReach = Math.round(34 + 52 * scale);
  const glowWide = Math.round(72 + 96 * scale);

  return (
    <div
      aria-hidden="true"
      className={`${styles.glow} ${activity > 0 ? styles.active : ''}`}
      data-dmx-activity-glow
      style={{
        '--dmx-glow-core-opacity': Number((opacity * 0.65).toFixed(3)),
        '--dmx-glow-mid-opacity': Number((opacity * 0.22).toFixed(3)),
        '--dmx-glow-warm-opacity': Number((opacity * 0.14).toFixed(3)),
        '--dmx-glow-edge-opacity': Number((opacity * 0.75).toFixed(3)),
        '--dmx-glow-wide-opacity': Number((opacity * 0.28).toFixed(3)),
        '--dmx-glow-reach': `${glowReach}px`,
        '--dmx-glow-wide': `${glowWide}px`,
      } as React.CSSProperties}
    />
  );
};
