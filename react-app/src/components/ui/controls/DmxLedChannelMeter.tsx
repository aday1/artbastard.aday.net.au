import React, { useMemo } from 'react';
import styles from './DmxLedChannelMeter.module.scss';

const DEFAULT_LED_COUNT = 6;
const RED_ZONE = 2;

export interface DmxLedChannelMeterProps {
  value: number;
  min?: number;
  max?: number;
  label: string;
  sublabel?: string;
  active?: boolean;
  ledCount?: number;
  className?: string;
}

function level(value: number, min: number, max: number, ledCount: number): number {
  const span = max - min;
  if (span <= 0) return 0;
  const t = Math.min(1, Math.max(0, (value - min) / span));
  return Math.round(t * ledCount);
}

export const DmxLedChannelMeter: React.FC<DmxLedChannelMeterProps> = ({
  value,
  min = 0,
  max = 255,
  label,
  sublabel,
  active = false,
  ledCount = DEFAULT_LED_COUNT,
  className = '',
}) => {
  const lit = level(value, min, max, ledCount);

  const leds = useMemo(() => {
    return Array.from({ length: ledCount }, (_, i) => {
      const on = i < lit;
      const red = i < RED_ZONE;
      return (
        <div
          key={i}
          className={[
            styles.led,
            red ? styles.red : styles.green,
            on ? styles.on : styles.off,
          ].join(' ')}
          aria-hidden
        />
      );
    });
  }, [ledCount, lit]);

  return (
    <div
      className={[styles.meter, active ? styles.active : '', className].filter(Boolean).join(' ')}
      title={`${label} ${value}`}
    >
      <div className={styles.ledBank} role="img" aria-label={`${label} level ${lit} of ${ledCount}`}>
        {leds}
      </div>
      <span className={styles.valueReadout}>{value}</span>
      <div className={styles.labels}>
        <span className={styles.label}>{label}</span>
        {sublabel ? <span className={styles.sublabel}>{sublabel}</span> : null}
      </div>
    </div>
  );
};
