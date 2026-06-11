import React, { useMemo } from 'react';
import styles from './DmxTickChannelMeter.module.scss';

const TICK_STEPS = 9;

export interface DmxTickChannelMeterProps {
  value: number;
  min?: number;
  max?: number;
  label: string;
  sublabel?: string;
  active?: boolean;
  className?: string;
}

function shrink(value: number, min: number, max: number): number {
  const span = max - min;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (value - min) / span));
}

export const DmxTickChannelMeter: React.FC<DmxTickChannelMeterProps> = ({
  value,
  min = 0,
  max = 255,
  label,
  sublabel,
  active = false,
  className = '',
}) => {
  const k = shrink(value, min, max);
  const fillPct = k * 100;
  const indicatorY = 100 - fillPct;

  const ticks = useMemo(() => {
    const lines: React.ReactNode[] = [];
    for (let i = 1; i <= TICK_STEPS; i++) {
      const y = 100 - i * 10;
      const short = i % 2 === 0;
      lines.push(
        <line
          key={i}
          x1={short ? '33%' : '50%'}
          y1={`${y}%`}
          x2="100%"
          y2={`${y}%`}
          className={styles.tickLine}
        />
      );
    }
    return lines;
  }, []);

  return (
    <div
      className={[styles.meter, active ? styles.active : '', className].filter(Boolean).join(' ')}
      title={`${label} ${value}`}
      style={
        {
          '--fill-pct': `${fillPct}%`,
          '--indicator-y': `${indicatorY}%`,
        } as React.CSSProperties
      }
    >
      <div className={styles.fill} aria-hidden />
      <svg className={styles.tickSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {ticks}
      </svg>
      <svg className={styles.indicatorSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <line
          x1="0%"
          y1={`${indicatorY}%`}
          x2="100%"
          y2={`${indicatorY}%`}
          className={styles.indicatorLine}
        />
      </svg>
      <span className={styles.valueReadout}>{value}</span>
      <div className={styles.labels}>
        <span className={styles.label}>{label}</span>
        {sublabel ? <span className={styles.sublabel}>{sublabel}</span> : null}
      </div>
    </div>
  );
};
