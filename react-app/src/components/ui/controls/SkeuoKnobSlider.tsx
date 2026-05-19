import React, { useId, useMemo } from 'react';
import styles from './SkeuoKnobSlider.module.scss';

export interface SkeuoKnobSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  label?: string;
  onChange: (value: number) => void;
  className?: string;
}

const KNOB_DEG_RANGE = 135;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function valueToDeg(value: number, min: number, max: number): number {
  const span = max - min;
  if (span <= 0) return 0;
  const t = (value - min) / span;
  return -KNOB_DEG_RANGE + t * KNOB_DEG_RANGE * 2;
}

export const SkeuoKnobSlider: React.FC<SkeuoKnobSliderProps> = ({
  value,
  min,
  max,
  step = 1,
  disabled = false,
  label,
  onChange,
  className = '',
}) => {
  const inputId = useId().replace(/:/g, '');
  const deg = valueToDeg(value, min, max);
  const tickCount = 21;

  const tickLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    for (let i = 0; i < tickCount; i++) {
      const tickDeg = -KNOB_DEG_RANGE + (i / (tickCount - 1)) * KNOB_DEG_RANGE * 2;
      const active = tickDeg <= deg + 0.5;
      lines.push(
        <line
          key={tickDeg}
          className={active ? styles.tickActive : undefined}
          style={{ '--deg': `${tickDeg}deg` } as React.CSSProperties}
          x1="300"
          y1="30"
          x2="300"
          y2="70"
        />
      );
    }
    return lines;
  }, [deg]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(clamp(parseFloat(e.target.value), min, max));
  };

  return (
    <div className={`${styles.wrap} ${className} ${disabled ? styles.disabled : ''}`}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <div className={styles.knobHost}>
        <input
          id={inputId}
          type="range"
          className={styles.input}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={handleInput}
          onInput={handleInput}
          aria-label={label ?? 'Speed'}
        />
        <svg className={styles.svg} viewBox="0 0 600 600" aria-hidden>
          <defs>
            <filter id={`${inputId}-inset`}>
              <feOffset in="SourceAlpha" />
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feFlood result="color" floodColor="#000" floodOpacity="0.45" />
              <feComposite in2="blur" operator="out" />
              <feComposite in="color" operator="in" />
              <feComposite in2="SourceGraphic" operator="in" />
            </filter>
          </defs>
          <circle className={styles.circle} cx="300" cy="300" r="200" />
          <g className={styles.gradate}>{tickLines}</g>
          <g
            className={styles.sliderWrap}
            style={{ transform: `rotate(${deg}deg)`, filter: `url(#${inputId}-inset)` }}
          >
            <circle className={styles.sliderShadow} cx="300" cy="130" r="10" />
            <circle className={styles.slider} cx="300" cy="130" r="10" />
          </g>
        </svg>
      </div>
      <span className={styles.readout}>{value}</span>
    </div>
  );
};
